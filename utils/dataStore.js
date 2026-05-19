/**
 * JSON 파일 기반 데이터 저장소 유틸리티
 * 모든 JSON 데이터 파일의 읽기/쓰기를 중앙 관리
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Storage } = require('@google-cloud/storage');

const isGCP = !!process.env.GOOGLE_CLOUD_PROJECT;
// GCP App Engine 환경에서는 파일 시스템이 읽기 전용이므로 쓰기 가능한 /tmp 디렉토리 사용
const BASE_DIR = isGCP ? os.tmpdir() : path.join(__dirname, '..');
const DATA_DIR = path.join(BASE_DIR, 'data');
const CONFIG_DIR = path.join(BASE_DIR, 'config');

// 디렉토리가 없으면 생성 (/tmp 초기화 대비)
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });

// GCP 환경일 경우 배포된 원본 파일들을 /tmp 로 초기 복사 (최초 실행 시)
if (isGCP) {
  const repoDataDir = path.join(__dirname, '..', 'data');
  const repoConfigDir = path.join(__dirname, '..', 'config');
  const filesToCopy = [
    { name: 'employers.json', src: repoDataDir, dest: DATA_DIR },
    { name: 'drivers.json', src: repoDataDir, dest: DATA_DIR },
    { name: 'attendance.json', src: repoDataDir, dest: DATA_DIR },
    { name: 'payments.json', src: repoDataDir, dest: DATA_DIR },
    { name: 'schedules.json', src: repoDataDir, dest: DATA_DIR },
    { name: 'push_subscriptions.json', src: repoDataDir, dest: DATA_DIR },
    { name: 'pay-settings.json', src: repoConfigDir, dest: CONFIG_DIR }
  ];
  for (const f of filesToCopy) {
    const destPath = path.join(f.dest, f.name);
    if (!fs.existsSync(destPath)) {
      const srcPath = path.join(f.src, f.name);
      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
      } else {
        fs.writeFileSync(destPath, f.name.includes('settings') ? '{}' : '[]', 'utf-8');
      }
    }
  }
}

// in-memory string cache to prevent GC spikes and memory leak from fs.readFileSync
const stringCache = {};

let storage, bucket;
const bucketName = process.env.GCS_BUCKET || (isGCP ? `${process.env.GOOGLE_CLOUD_PROJECT}.appspot.com` : null);

if (bucketName) {
  storage = new Storage();
  bucket = storage.bucket(bucketName);
  console.log(`[GCS] Storage 연동 활성화 (버킷: ${bucketName})`);
} else {
  console.log(`[GCS] 버킷 환경변수가 없으므로 로컬 파일 시스템만 사용합니다.`);
}

/**
 * 서버 시작 시 GCP 버킷에서 최신 데이터 다운로드 (백그라운드 동기화)
 */
async function syncFromCloud() {
  if (!bucket) return;
  const files = ['employers.json', 'drivers.json', 'attendance.json', 'payments.json', 'pay-settings.json', 'schedules.json', 'push_subscriptions.json'];
  for (const file of files) {
    const isConfig = file === 'pay-settings.json';
    const dir = isConfig ? CONFIG_DIR : DATA_DIR;
    const filePath = path.join(dir, file);
    try {
      const [exists] = await bucket.file(file).exists();
      if (exists) {
        await bucket.file(file).download({ destination: filePath });
        console.log(`[GCS] ${file} downloaded successfully.`);
        // Cache the downloaded file
        stringCache[file] = fs.readFileSync(filePath, 'utf-8');
      } else {
        console.log(`[GCS] ${file} does not exist. (First run)`);
      }
    } catch (err) {
      console.error(`[GCS] Fatal error downloading ${file}:`, err.message);
      // Throw error on download failure to prevent starting with empty data
      throw err;
    }
  }
}

/**
 * 6시간마다 현재 데이터를 GCS에 백업하여 메모리 부족 등 재실행 시 데이터 유실 방지
 */
async function exportToCloudAll() {
  if (!bucket) return;
  console.log(`[GCS] 주기적 데이터 백업 시작 (6시간 간격)...`);
  const files = ['employers.json', 'drivers.json', 'attendance.json', 'payments.json', 'pay-settings.json', 'schedules.json', 'push_subscriptions.json'];
  for (const file of files) {
    let raw = stringCache[file];
    if (!raw) {
      const isConfig = file === 'pay-settings.json';
      const dir = isConfig ? CONFIG_DIR : DATA_DIR;
      const filePath = path.join(dir, file);
      if (fs.existsSync(filePath)) {
        try {
          raw = fs.readFileSync(filePath, 'utf-8');
          stringCache[file] = raw;
        } catch (e) {}
      }
    }
    
    if (raw) {
      try {
        await bucket.file(file).save(raw);
        console.log(`[GCS] ${file} 주기적 백업 완료.`);
      } catch (err) {
        console.error(`[GCS] ${file} 주기적 백업 실패:`, err.message);
      }
    }
  }
}

// 6시간마다 백업 스케줄러 등록
if (bucket) {
  setInterval(exportToCloudAll, 6 * 60 * 60 * 1000);
}

/**
 * JSON 파일 읽기
 */
function readJSON(filename, isConfig = false) {
  if (stringCache[filename]) {
    try {
      return JSON.parse(stringCache[filename]);
    } catch (e) {
      console.error(`Error parsing cached ${filename}:`, e.message);
    }
  }

  const dir = isConfig ? CONFIG_DIR : DATA_DIR;
  const filePath = path.join(dir, filename);
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    stringCache[filename] = raw;
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err.message);
    const fallback = isConfig ? {} : [];
    stringCache[filename] = JSON.stringify(fallback);
    return fallback;
  }
}

/**
 * JSON 파일 쓰기
 */
function writeJSON(filename, data, isConfig = false) {
  const jsonString = JSON.stringify(data, null, 2);
  stringCache[filename] = jsonString;

  const dir = isConfig ? CONFIG_DIR : DATA_DIR;
  const filePath = path.join(dir, filename);
  const tempPath = filePath + '.tmp';
  try {
    // Atomic write: write to temp file then rename to prevent empty files
    fs.writeFileSync(tempPath, jsonString, 'utf-8');
    fs.renameSync(tempPath, filePath);
    
    // 이전에 있던 즉각적인 GCS 업로드는 메모리 릭 및 성능 저하 방지를 위해 제거.
    // 대신 주기적인 exportToCloudAll 스케줄러가 6시간마다 백업을 수행합니다.
    
    return true;
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err.message);
    return false;
  }
}

/**
 * 급여 설정 읽기
 */
function getPaySettings() {
  return readJSON('pay-settings.json', true);
}

/**
 * 급여 설정 저장
 */
function savePaySettings(settings) {
  return writeJSON('pay-settings.json', settings, true);
}

/**
 * 특정 날짜가 필리핀 공휴일인지 확인
 */
function isHoliday(dateStr) {
  const settings = getPaySettings();
  return settings.philippineHolidays && settings.philippineHolidays.includes(dateStr);
}

/**
 * 특정 날짜가 일요일인지 확인
 */
function isSunday(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.getDay() === 0;
}

/**
 * dayType 결정: 공휴일 또는 일요일이면 'holiday', 아니면 'weekday'
 */
function getDayType(dateStr) {
  if (isHoliday(dateStr) || isSunday(dateStr)) {
    return 'holiday';
  }
  return 'weekday';
}

/**
 * 간단한 ID 생성 (uuid 대체용)
 */
function generateId(prefix = '') {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return prefix ? `${prefix}-${timestamp}${random}` : `${timestamp}${random}`;
}

module.exports = {
  readJSON,
  writeJSON,
  getPaySettings,
  savePaySettings,
  isHoliday,
  isSunday,
  getDayType,
  generateId,
  syncFromCloud
};

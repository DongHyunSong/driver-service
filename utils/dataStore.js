/**
 * JSON file-based data store utility.
 * Centrally manages read/write operations for all JSON data files.
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { Storage } = require('@google-cloud/storage');

const isGCP = !!(process.env.GOOGLE_CLOUD_PROJECT || process.env.K_SERVICE || process.env.GAE_SERVICE);
// In GCP environment (App Engine / Cloud Run), the local filesystem is read-only or ephemeral, so use the writable /tmp directory.
const BASE_DIR = isGCP ? os.tmpdir() : path.join(__dirname, '..');
const DATA_DIR = path.join(BASE_DIR, 'data');
const CONFIG_DIR = path.join(BASE_DIR, 'config');

// 디렉토리가 없으면 생성 (/tmp 초기화 대비)
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });

// For GCP environment, copy the deployed template files to /tmp on the first run.
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

let storage = new Storage();
let bucket = null;

/**
 * Initialize GCS storage and bucket configuration.
 * Dynamically resolves the project ID from metadata server or environment if not explicitly set.
 */
async function initGCS() {
  let bName = process.env.GCS_BUCKET;
  if (!bName) {
    let projId = process.env.GOOGLE_CLOUD_PROJECT;
    if (!projId) {
      try {
        projId = await storage.getProjectId();
        console.log(`[GCS] Dynamically retrieved project ID: ${projId}`);
      } catch (err) {
        console.log(`[GCS] Failed to retrieve project ID dynamically:`, err.message);
      }
    }
    if (projId) {
      bName = `${projId}.appspot.com`;
    }
  }

  if (bName) {
    bucket = storage.bucket(bName);
    console.log(`[GCS] Storage integration active (Bucket: ${bName})`);
  } else {
    console.log(`[GCS] No GCS bucket configured. Using local filesystem only.`);
  }
}



/**
 * Sync latest data files from GCS bucket at server startup
 */
async function syncFromCloud() {
  await initGCS();
  if (!bucket) {
    console.log('[GCS] Skipping sync. GCS integration is disabled.');
    return;
  }

  const files = ['employers.json', 'drivers.json', 'attendance.json', 'payments.json', 'pay-settings.json', 'schedules.json', 'push_subscriptions.json'];
  try {
    for (const file of files) {
      const isConfig = file === 'pay-settings.json';
      const dir = isConfig ? CONFIG_DIR : DATA_DIR;
      const filePath = path.join(dir, file);
      const [exists] = await bucket.file(file).exists();
      if (exists) {
        await bucket.file(file).download({ destination: filePath });
        console.log(`[GCS] ${file} downloaded successfully.`);
        // Cache the downloaded file
        stringCache[file] = fs.readFileSync(filePath, 'utf-8');
      } else {
        console.log(`[GCS] ${file} does not exist in bucket (first run).`);
      }
    }

  } catch (err) {
    console.error(`[GCS] Failed to sync data from GCS bucket:`, err.message);
    console.error(`[GCS] Please ensure that the GCS bucket exists and the Cloud Run service account has 'Storage Object Admin' permissions.`);
    console.error(`[GCS] GCS integration is disabled. Falling back to local filesystem (data will NOT persist across restarts).`);
    bucket = null;
  }
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
 * Write data to a JSON file and upload immediately to GCS.
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
    
    // Immediately upload to GCS to prevent data loss on stateless container restarts (e.g., on Cloud Run)
    if (bucket) {
      bucket.file(filename).save(jsonString)
        .then(() => {
          console.log(`[GCS] Successfully backed up ${filename} immediately.`);
        })
        .catch(err => {
          console.error(`[GCS] Immediate backup failed for ${filename}:`, err.message);
        });
    }
    
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
 * Save payroll settings.
 */
function savePaySettings(settings) {
  return writeJSON('pay-settings.json', settings, true);
}

/**
 * Check if a specific date is a Philippine holiday.
 */
function isHoliday(dateStr) {
  const settings = getPaySettings();
  return settings.philippineHolidays && settings.philippineHolidays.includes(dateStr);
}

/**
 * Check if a specific date is a Sunday.
 */
function isSunday(dateStr) {
  const date = new Date(dateStr + 'T00:00:00');
  return date.getDay() === 0;
}

/**
 * Determine the day type: 'holiday' if it is a Sunday or holiday, otherwise 'weekday'.
 */
function getDayType(dateStr) {
  if (isHoliday(dateStr) || isSunday(dateStr)) {
    return 'holiday';
  }
  return 'weekday';
}

/**
 * Generate a simple unique ID (alternative to uuid).
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

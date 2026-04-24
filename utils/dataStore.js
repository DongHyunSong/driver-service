/**
 * JSON 파일 기반 데이터 저장소 유틸리티
 * 모든 JSON 데이터 파일의 읽기/쓰기를 중앙 관리
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const CONFIG_DIR = path.join(__dirname, '..', 'config');

/**
 * JSON 파일 읽기
 */
function readJSON(filename, isConfig = false) {
  const dir = isConfig ? CONFIG_DIR : DATA_DIR;
  const filePath = path.join(dir, filename);
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err.message);
    return isConfig ? {} : [];
  }
}

/**
 * JSON 파일 쓰기
 */
function writeJSON(filename, data, isConfig = false) {
  const dir = isConfig ? CONFIG_DIR : DATA_DIR;
  const filePath = path.join(dir, filename);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
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
  generateId
};

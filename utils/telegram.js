/**
 * Telegram Bot API Utility
 * Centrally manages sending notifications and backup files to a Telegram chat.
 */

const { readJSON, getPaySettings } = require('./dataStore');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '8862571434:AAHGPJKf7HCXzLFv_EvCXAnNUza412zjW2M';
const CHAT_ID = process.env.TELEGRAM_CHAT_ID || '-1003975486610';

/**
 * Send backup snapshot file via Telegram Bot.
 * @param {Object} snapshot - The full backup JSON snapshot object
 * @returns {Promise<Object>} - Fetch response JSON
 */
async function sendTelegramBackup(snapshot) {
  if (!BOT_TOKEN || !CHAT_ID) {
    throw new Error('TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID environment variables are not configured.');
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const filename = `driver-attendance-backup-${todayStr}.json`;

  try {
    const formData = new FormData();
    formData.append('chat_id', CHAT_ID);
    
    // Create a Blob from the snapshot JSON string
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    formData.append('document', blob, filename);
    formData.append('caption', `🚗 *[Driver Payment] Data Backup*\n📅 Date: ${todayStr}\n⏰ Exported At: ${snapshot.exportedAt}`);

    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`, {
      method: 'POST',
      body: formData
    });

    const result = await res.json();
    if (!res.ok) {
      throw new Error(result.description || 'Failed to send document to Telegram.');
    }

    console.log('[Telegram] Backup file sent successfully.');
    return result;
  } catch (err) {
    console.error('[Telegram] Failed to send backup file:', err.message);
    throw err;
  }
}

/**
 * Send driver attendance notification via Telegram Bot in Korean.
 * @param {Object} driver - Driver object
 * @param {Object} record - Attendance record object
 * @param {String} action - 'checkin' | 'checkout' | 'manual'
 * @returns {Promise<Object>} - Fetch response JSON or null
 */
async function sendAttendanceTelegram(driver, record, action) {
  if (!BOT_TOKEN || !CHAT_ID) {
    return null;
  }

  const timeFormatOptions = { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Manila' };
  let message = '';

  if (action === 'checkin') {
    const inTime = new Date(record.clockIn).toLocaleTimeString('ko-KR', timeFormatOptions);
    message = `👔 *[드라이버 출근 알림]*\n\n👤 *드라이버*: ${driver.name}\n📅 *날짜*: ${record.date}\n⏰ *출근 시간*: ${inTime}`;
  } else if (action === 'checkout') {
    const inTime = new Date(record.clockIn).toLocaleTimeString('ko-KR', timeFormatOptions);
    const outTime = new Date(record.clockOut).toLocaleTimeString('ko-KR', timeFormatOptions);
    message = `👔 *[드라이버 퇴근 알림]*\n\n👤 *드라이버*: ${driver.name}\n📅 *날짜*: ${record.date}\n⏰ *출근 시간*: ${inTime}\n⏰ *퇴근 시간*: ${outTime}\n⏱ *총 근무 시간*: ${record.hoursWorked}시간 (OT: ${record.otHours}시간)`;
  } else if (action === 'manual') {
    message = `👔 *[드라이버 근태 수동 기록 알림]*\n\n👤 *드라이버*: ${driver.name}\n📅 *날짜*: ${record.date}\n⏱ *총 근무 시간*: ${record.hoursWorked}시간 (OT: ${record.otHours}시간)\n📝 *메모*: ${record.note || '없음'}`;
  } else {
    return null;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: 'Markdown'
      })
    });

    const result = await res.json();
    if (!res.ok) {
      throw new Error(result.description || 'Failed to send message to Telegram.');
    }

    console.log(`[Telegram] Attendance notification sent successfully for ${driver.name}.`);
    return result;
  } catch (err) {
    console.error('[Telegram] Failed to send attendance notification:', err.message);
    return null;
  }
}

const isConfigured = !!(BOT_TOKEN && CHAT_ID);

module.exports = { sendTelegramBackup, sendAttendanceTelegram, isConfigured };

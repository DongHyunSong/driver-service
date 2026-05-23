/**
 * Telegram Bot API Utility
 * Centrally manages sending notifications and backup files to a Telegram chat.
 */

const { readJSON, getPaySettings } = require('./dataStore');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

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

module.exports = { sendTelegramBackup };

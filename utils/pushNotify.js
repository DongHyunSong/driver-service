/**
 * Push Notification Scheduler
 * Scans upcoming schedules and fires push notifications
 * 2 hours before and 30 minutes before each schedule.
 */

const webpush = require('web-push');
const { readJSON } = require('./dataStore');

const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY  || 'BIk5yd83x6sFtwVVqTxmsbg0h_-b5DKQ39twmp96nM8BODNyo9b60yDtqI32B63ZyBm7dyorTcP7MSa3v6x_HY8';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'pymb3_mG6CwQhYMhO80FfF7ZNYhCZhL5tQG7_IpRbm0';

webpush.setVapidDetails(
  'mailto:admin@driver-attendance.app',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// Track which notifications have already been sent (in-memory; resets on restart — acceptable for short-interval schedules)
const sentNotifications = new Set();

/**
 * Send a push notification to all subscriptions for a given driverId.
 */
async function sendToDriver(driverId, payload) {
  const subs = readJSON('push_subscriptions.json').filter(s => s.driverId === driverId);
  if (subs.length === 0) return;

  const payloadStr = JSON.stringify(payload);
  for (const s of subs) {
    try {
      await webpush.sendNotification(s.subscription, payloadStr);
    } catch (err) {
      // 410 Gone = subscription expired; log and continue
      console.warn(`[Push] Failed for driver ${driverId}:`, err.statusCode || err.message);
    }
  }
}

/**
 * Main scheduler — called every minute.
 * Checks schedules within the next 2h5min window to find ones to notify.
 */
function checkAndSendScheduleNotifications() {
  const nowManila = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' }));
  const schedules = readJSON('schedules.json');

  for (const sch of schedules) {
    if (!sch.date || !sch.time) continue;

    // Build schedule datetime in Manila time
    const [year, month, day] = sch.date.split('-').map(Number);
    const [hour, minute]     = sch.time.split(':').map(Number);
    const schTime = new Date(year, month - 1, day, hour, minute, 0);

    const diffMinutes = (schTime - nowManila) / 60000;

    // 2-hour notification: fire when diffMinutes is between 119 and 121 minutes
    const key2h = `${sch.id}:2h`;
    if (diffMinutes >= 119 && diffMinutes < 121 && !sentNotifications.has(key2h)) {
      sentNotifications.add(key2h);
      sendToDriver(sch.driverId, {
        title: '📅 Schedule in 2 Hours',
        body: `${sch.time} — ${sch.pickupPerson || 'Pickup'}\n${sch.pickupLocation || ''} → ${sch.destination || ''}`,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: key2h,
        data: { scheduleId: sch.id, date: sch.date, time: sch.time }
      });
    }

    // 30-minute notification: fire when diffMinutes is between 29 and 31 minutes
    const key30m = `${sch.id}:30m`;
    if (diffMinutes >= 29 && diffMinutes < 31 && !sentNotifications.has(key30m)) {
      sentNotifications.add(key30m);
      sendToDriver(sch.driverId, {
        title: '⏰ Schedule in 30 Minutes!',
        body: `${sch.time} — ${sch.pickupPerson || 'Pickup'}\n${sch.pickupLocation || ''} → ${sch.destination || ''}`,
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        tag: key30m,
        data: { scheduleId: sch.id, date: sch.date, time: sch.time }
      });
    }
  }

  // Cleanup old entries (keep only ones from the last 48h to prevent unbounded growth)
  if (sentNotifications.size > 5000) {
    const arr = [...sentNotifications];
    arr.slice(0, 1000).forEach(k => sentNotifications.delete(k));
  }
}

/**
 * Start the scheduler — runs every 60 seconds.
 */
function startPushScheduler() {
  console.log('[Push] Schedule notification scheduler started.');
  // Run once immediately, then every minute
  checkAndSendScheduleNotifications();
  setInterval(checkAndSendScheduleNotifications, 60 * 1000);
}

module.exports = { startPushScheduler, sendToDriver };

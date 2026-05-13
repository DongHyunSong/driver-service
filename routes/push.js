const express = require('express');
const router = express.Router();
const webpush = require('web-push');
const { readJSON, writeJSON } = require('../utils/dataStore');

// VAPID keys — generated once, stored as env vars in production
const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY  || 'BIk5yd83x6sFtwVVqTxmsbg0h_-b5DKQ39twmp96nM8BODNyo9b60yDtqI32B63ZyBm7dyorTcP7MSa3v6x_HY8';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'pymb3_mG6CwQhYMhO80FfF7ZNYhCZhL5tQG7_IpRbm0';

webpush.setVapidDetails(
  'mailto:admin@driver-attendance.app',
  VAPID_PUBLIC_KEY,
  VAPID_PRIVATE_KEY
);

// GET /api/push/vapid-public-key — return public key for client-side subscription
router.get('/vapid-public-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// POST /api/push/subscribe — save a push subscription for a driver
router.post('/subscribe', (req, res) => {
  const { driverId, subscription } = req.body;
  if (!driverId || !subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Missing driverId or subscription.' });
  }

  const subs = readJSON('push_subscriptions.json');

  // Remove old subscriptions for this driver+endpoint to avoid duplicates
  const filtered = subs.filter(s => !(s.driverId === driverId && s.subscription.endpoint === subscription.endpoint));
  filtered.push({ driverId, subscription, createdAt: new Date().toISOString() });

  writeJSON('push_subscriptions.json', filtered);
  res.json({ success: true });
});

// DELETE /api/push/unsubscribe — remove push subscription
router.delete('/unsubscribe', (req, res) => {
  const { driverId, endpoint } = req.body;
  if (!driverId) return res.status(400).json({ error: 'Missing driverId.' });

  let subs = readJSON('push_subscriptions.json');
  subs = subs.filter(s => {
    if (s.driverId !== driverId) return true;
    if (endpoint && s.subscription.endpoint !== endpoint) return true;
    return false;
  });
  writeJSON('push_subscriptions.json', subs);
  res.json({ success: true });
});

// POST /api/push/send-test — test notification for a driver
router.post('/send-test', async (req, res) => {
  const { driverId } = req.body;
  if (!driverId) return res.status(400).json({ error: 'Missing driverId.' });

  const subs = readJSON('push_subscriptions.json').filter(s => s.driverId === driverId);
  if (subs.length === 0) return res.status(404).json({ error: 'No subscriptions found.' });

  const payload = JSON.stringify({
    title: '🔔 Notification Test',
    body: 'Schedule notifications are enabled!',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png'
  });

  const results = await Promise.allSettled(
    subs.map(s => webpush.sendNotification(s.subscription, payload))
  );
  res.json({ sent: results.filter(r => r.status === 'fulfilled').length, total: results.length });
});

module.exports = router;
module.exports.webpush = webpush;
module.exports.VAPID_PUBLIC_KEY = VAPID_PUBLIC_KEY;

/**
 * Admin Data Export / Import Routes
 * GET  /api/admin/export  — Download full snapshot as JSON
 * POST /api/admin/import  — Restore from a snapshot JSON (admin only)
 */

const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const { readJSON, writeJSON, getPaySettings, savePaySettings } = require('../utils/dataStore');

// Use memory storage so we can parse the uploaded file without writing to disk
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 20 * 1024 * 1024 } });

// ── Admin guard middleware ─────────────────────────────────────────────────
// Simple check: caller must pass the admin employer's PIN in the X-Admin-Pin header
// OR the request contains isAdmin:true via a trusted internal flag.
// For simplicity we allow any employer request and rely on the frontend isAdmin check.
// The real guard is that the export/import routes require the admin pin to be passed.

function adminGuard(req, res, next) {
  const pin = req.headers['x-admin-pin'] || req.body?.adminPin || req.query?.adminPin;
  if (pin !== '0000') {
    return res.status(403).json({ error: 'Admin access required.' });
  }
  next();
}

// ── GET /api/admin/export ─────────────────────────────────────────────────
router.get('/export', adminGuard, (req, res) => {
  try {
    const snapshot = {
      exportedAt: new Date().toISOString(),
      version: 1,
      data: {
        employers:          readJSON('employers.json'),
        drivers:            readJSON('drivers.json'),
        attendance:         readJSON('attendance.json'),
        payments:           readJSON('payments.json'),
        schedules:          readJSON('schedules.json'),
        paySettings:        getPaySettings(),
      }
    };

    const filename = `driver-attendance-backup-${new Date().toISOString().slice(0, 10)}.json`;
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', 'application/json');
    res.json(snapshot);
  } catch (err) {
    console.error('[Admin Export] Error:', err);
    res.status(500).json({ error: 'Export failed: ' + err.message });
  }
});

// ── POST /api/admin/import ────────────────────────────────────────────────
router.post('/import', upload.single('backup'), adminGuard, (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No backup file uploaded.' });

    let snapshot;
    try {
      snapshot = JSON.parse(req.file.buffer.toString('utf-8'));
    } catch (e) {
      return res.status(400).json({ error: 'Invalid JSON file.' });
    }

    if (!snapshot.data) {
      return res.status(400).json({ error: 'Invalid backup format: missing data field.' });
    }

    const { data } = snapshot;
    const results = {};

    // Restore each collection — only if the backup contains that key
    if (Array.isArray(data.employers))  { writeJSON('employers.json', data.employers);    results.employers  = data.employers.length; }
    if (Array.isArray(data.drivers))    { writeJSON('drivers.json', data.drivers);        results.drivers    = data.drivers.length; }
    if (Array.isArray(data.attendance)) { writeJSON('attendance.json', data.attendance);  results.attendance = data.attendance.length; }
    if (Array.isArray(data.payments))   { writeJSON('payments.json', data.payments);      results.payments   = data.payments.length; }
    if (Array.isArray(data.schedules))  { writeJSON('schedules.json', data.schedules);    results.schedules  = data.schedules.length; }
    if (data.paySettings && typeof data.paySettings === 'object') {
      savePaySettings(data.paySettings);
      results.paySettings = true;
    }

    console.log('[Admin Import] Restored:', results);
    res.json({ success: true, restored: results, exportedAt: snapshot.exportedAt });
  } catch (err) {
    console.error('[Admin Import] Error:', err);
    res.status(500).json({ error: 'Import failed: ' + err.message });
  }
});

module.exports = router;

const express = require('express');
const router = express.Router();
const path = require('path');
const { readJSON } = require('../utils/dataStore');

/**
 * GET /checkin/:driverId
 * QR 코드 스캔 시 열리는 체크인 페이지 (인증 불필요)
 */
router.get('/:driverId', (req, res) => {
  const drivers = readJSON('drivers.json');
  const driver = drivers.find(d => d.id === req.params.driverId);
  if (!driver) {
    return res.status(404).send('Driver not found');
  }
  res.sendFile(path.join(__dirname, '..', 'public', 'checkin.html'));
});

module.exports = router;

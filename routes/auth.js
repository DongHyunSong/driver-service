const express = require('express');
const router = express.Router();
const { readJSON } = require('../utils/dataStore');

/**
 * POST /api/auth/login
 * PIN 기반 로그인 (고용인/드라이버 구분)
 * Body: { role: 'employer' | 'driver', pin: '1234' }
 */
router.post('/login', (req, res) => {
  const { role, userId, pin } = req.body;

  if (!role || !pin || !userId) {
    return res.status(400).json({ error: '필요한 정보(role, userId, pin)가 누락되었습니다.' });
  }

  if (role === 'employer') {
    const employers = readJSON('employers.json');
    const employer = employers.find(e => e.id === userId && e.pin === pin);
    if (!employer) {
      return res.status(401).json({ error: 'Invalid PIN' });
    }
    return res.json({
      success: true,
      role: 'employer',
      user: {
        id: employer.id,
        name: employer.name,
        email: employer.email,
        driverIds: employer.driverIds
      }
    });
  }

  if (role === 'driver') {
    const drivers = readJSON('drivers.json');
    const driver = drivers.find(d => d.id === userId && d.pin === pin);
    if (!driver) {
      return res.status(401).json({ error: 'Invalid PIN' });
    }
    return res.json({
      success: true,
      role: 'driver',
      user: {
        id: driver.id,
        name: driver.name,
        phone: driver.phone,
        employerId: driver.employerId
      }
    });
  }

  return res.status(400).json({ error: 'Invalid role. Use "employer" or "driver".' });
});

module.exports = router;

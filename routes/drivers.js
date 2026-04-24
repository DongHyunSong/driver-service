const express = require('express');
const router = express.Router();
const { readJSON, writeJSON, generateId } = require('../utils/dataStore');

/**
 * GET /api/drivers
 * 드라이버 목록 조회 (employerId 필터 가능)
 */
router.get('/', (req, res) => {
  let drivers = readJSON('drivers.json');
  if (req.query.employerId) {
    const employers = readJSON('employers.json');
    const emp = employers.find(e => e.id === req.query.employerId);
    if (emp && !emp.isAdmin) {
      drivers = drivers.filter(d => emp.driverIds && emp.driverIds.includes(d.id));
    }
  }
  const safe = drivers.map(({ pin, ...rest }) => rest);
  res.json(safe);
});

/**
 * GET /api/drivers/:id
 * 특정 드라이버 조회
 */
router.get('/:id', (req, res) => {
  const drivers = readJSON('drivers.json');
  const driver = drivers.find(d => d.id === req.params.id);
  if (!driver) {
    return res.status(404).json({ error: 'Driver not found' });
  }
  const { pin, ...safe } = driver;
  res.json(safe);
});

/**
 * POST /api/drivers
 * 드라이버 등록
 * Body: { name, phone, pin, employerId }
 */
router.post('/', (req, res) => {
  const { name, phone, pin, employerId } = req.body;
  if (!name || !pin || !employerId) {
    return res.status(400).json({ error: 'name, pin, employerId는 필수입니다.' });
  }

  const drivers = readJSON('drivers.json');
  const newDriver = {
    id: generateId('drv'),
    name,
    phone: phone || '',
    pin,
    employerId,
    createdAt: new Date().toISOString()
  };

  drivers.push(newDriver);
  writeJSON('drivers.json', drivers);

  // 고용인의 driverIds에도 추가
  const employers = readJSON('employers.json');
  const empIndex = employers.findIndex(e => e.id === employerId);
  if (empIndex !== -1) {
    if (!employers[empIndex].driverIds.includes(newDriver.id)) {
      employers[empIndex].driverIds.push(newDriver.id);
      writeJSON('employers.json', employers);
    }
  }

  const { pin: _, ...safe } = newDriver;
  res.status(201).json(safe);
});

/**
 * PUT /api/drivers/:id
 * 드라이버 정보 수정
 */
router.put('/:id', (req, res) => {
  const drivers = readJSON('drivers.json');
  const index = drivers.findIndex(d => d.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Driver not found' });
  }

  const { name, phone, pin } = req.body;
  if (name) drivers[index].name = name;
  if (phone !== undefined) drivers[index].phone = phone;
  if (pin) drivers[index].pin = pin;

  writeJSON('drivers.json', drivers);
  const { pin: _, ...safe } = drivers[index];
  res.json(safe);
});

module.exports = router;

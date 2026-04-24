const express = require('express');
const router = express.Router();
const { readJSON, writeJSON, generateId } = require('../utils/dataStore');

/**
 * GET /api/employers
 * 고용인 전체 목록 조회
 */
router.get('/', (req, res) => {
  const employers = readJSON('employers.json');
  // PIN은 제외하고 반환
  const safe = employers.map(({ pin, ...rest }) => rest);
  res.json(safe);
});

/**
 * GET /api/employers/:id
 * 특정 고용인 조회
 */
router.get('/:id', (req, res) => {
  const employers = readJSON('employers.json');
  const employer = employers.find(e => e.id === req.params.id);
  if (!employer) {
    return res.status(404).json({ error: 'Employer not found' });
  }
  const { pin, ...safe } = employer;
  res.json(safe);
});

/**
 * POST /api/employers
 * 고용인 등록
 * Body: { name, email, pin }
 */
router.post('/', (req, res) => {
  const { name, email, pin } = req.body;
  if (!name || !pin) {
    return res.status(400).json({ error: 'name과 pin은 필수입니다.' });
  }

  const employers = readJSON('employers.json');
  const newEmployer = {
    id: generateId('emp'),
    name,
    email: email || '',
    pin,
    driverIds: [],
    createdAt: new Date().toISOString()
  };

  employers.push(newEmployer);
  writeJSON('employers.json', employers);

  const { pin: _, ...safe } = newEmployer;
  res.status(201).json(safe);
});

/**
 * PUT /api/employers/:id
 * 고용인 정보 수정
 */
router.put('/:id', (req, res) => {
  const employers = readJSON('employers.json');
  const index = employers.findIndex(e => e.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Employer not found' });
  }

  const { name, email, pin, driverIds } = req.body;
  if (name) employers[index].name = name;
  if (email !== undefined) employers[index].email = email;
  if (pin) employers[index].pin = pin;
  if (driverIds) employers[index].driverIds = driverIds;

  writeJSON('employers.json', employers);
  const { pin: _, ...safe } = employers[index];
  res.json(safe);
});

module.exports = router;

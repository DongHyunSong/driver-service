const express = require('express');
const router = express.Router();
const { readJSON, writeJSON, generateId } = require('../utils/dataStore');

// GET /api/schedules
router.get('/', (req, res) => {
  const { driverId, month } = req.query;
  let schedules = readJSON('schedules.json');
  if (driverId) schedules = schedules.filter(s => s.driverId === driverId);
  if (month) schedules = schedules.filter(s => s.date.startsWith(month));
  schedules.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.time.localeCompare(b.time);
  });
  res.json(schedules);
});

// POST /api/schedules
router.post('/', (req, res) => {
  const { driverId, date, time, pickupLocation, pickupPerson, destination, note } = req.body;
  if (!driverId || !date || !time) return res.status(400).json({ error: 'Missing required fields.' });

  const schedules = readJSON('schedules.json');
  const newSchedule = {
    id: generateId('sch'),
    driverId, date, time, pickupLocation, pickupPerson, destination, note,
    createdAt: new Date().toISOString()
  };
  schedules.push(newSchedule);
  writeJSON('schedules.json', schedules);
  res.status(201).json(newSchedule);
});

// PUT /api/schedules/:id
router.put('/:id', (req, res) => {
  const schedules = readJSON('schedules.json');
  const index = schedules.findIndex(s => s.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Schedule not found.' });

  const { date, time, pickupLocation, pickupPerson, destination, note } = req.body;
  if (date) schedules[index].date = date;
  if (time) schedules[index].time = time;
  if (pickupLocation !== undefined) schedules[index].pickupLocation = pickupLocation;
  if (pickupPerson !== undefined) schedules[index].pickupPerson = pickupPerson;
  if (destination !== undefined) schedules[index].destination = destination;
  if (note !== undefined) schedules[index].note = note;

  schedules[index].updatedAt = new Date().toISOString();
  writeJSON('schedules.json', schedules);
  res.json(schedules[index]);
});

// DELETE /api/schedules/:id
router.delete('/:id', (req, res) => {
  let schedules = readJSON('schedules.json');
  const index = schedules.findIndex(s => s.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Schedule not found.' });

  schedules.splice(index, 1);
  writeJSON('schedules.json', schedules);
  res.json({ success: true });
});

module.exports = router;

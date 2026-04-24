const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');
const { readJSON, writeJSON, generateId, getDayType, getPaySettings } = require('../utils/dataStore');
const { sendAttendanceEmail } = require('../utils/email');

// ── 헬퍼: clockIn/clockOut으로 hoursWorked, otHours 계산 ──────────────
function calcHours(clockIn, clockOut) {
  if (!clockIn || !clockOut) return { hoursWorked: 0, otHours: 0 };
  const settings = getPaySettings();
  const base = settings.baseHoursPerDay || 8;
  const diffMs = new Date(clockOut) - new Date(clockIn);
  const hours = Math.max(0, diffMs / (1000 * 60 * 60));
  const otHours = Math.max(0, hours - base);
  return {
    hoursWorked: Math.round(hours * 100) / 100,
    otHours: Math.round(otHours * 100) / 100
  };
}

// ── GET /api/attendance ───────────────────────────────────────────────
router.get('/', (req, res) => {
  const { driverId, month } = req.query;
  if (!driverId) return res.status(400).json({ error: 'driverId는 필수입니다.' });

  let records = readJSON('attendance.json');
  records = records.filter(r => r.driverId === driverId);
  if (month) records = records.filter(r => r.date.startsWith(month));
  records.sort((a, b) => a.date.localeCompare(b.date));
  res.json(records);
});

// ── POST /api/attendance/checkin  (QR 스캔 → 출근) ───────────────────
router.post('/checkin', (req, res) => {
  const { driverId } = req.body;
  if (!driverId) return res.status(400).json({ error: 'driverId는 필수입니다.' });

  // 드라이버 존재 확인
  const drivers = readJSON('drivers.json');
  const driver = drivers.find(d => d.id === driverId);
  if (!driver) return res.status(404).json({ error: 'Driver not found' });

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const records = readJSON('attendance.json');

  // 오늘 기록 확인
  let record = records.find(r => r.driverId === driverId && r.date === today);

  if (record) {
    if (record.clockIn && !record.clockOut) {
      // 이미 출근 기록 있음 → 아직 퇴근 안 함
      return res.status(409).json({
        error: 'Already checked in. Please check out.',
        status: 'checked_in',
        clockIn: record.clockIn
      });
    }
    if (record.clockIn && record.clockOut) {
      return res.status(409).json({
        error: 'Already checked in and out today.',
        status: 'completed',
        clockIn: record.clockIn,
        clockOut: record.clockOut
      });
    }
  }

  const dayType = getDayType(today);

  if (record) {
    // 기록은 있는데 clockIn이 없는 경우 (수동 등록된 경우)
    const idx = records.indexOf(record);
    records[idx].clockIn = now.toISOString();
    records[idx].clockOut = null;
    records[idx].hoursWorked = 0;
    records[idx].otHours = 0;
    records[idx].worked = true;
    records[idx].dayType = dayType;
    writeJSON('attendance.json', records);

    const employers = readJSON('employers.json');
    const employer = employers.find(e => e.id === driver.employerId);
    if (employer) sendAttendanceEmail(employer, driver, records[idx], 'checkin');

    return res.json({ success: true, status: 'checked_in', record: records[idx] });
  }

  // 새 기록 생성
  const newRecord = {
    id: generateId('att'),
    driverId,
    date: today,
    dayType,
    worked: true,
    clockIn: now.toISOString(),
    clockOut: null,
    hoursWorked: 0,
    otHours: 0,
    note: '',
    createdAt: now.toISOString()
  };
  records.push(newRecord);
  writeJSON('attendance.json', records);

  const employers = readJSON('employers.json');
  const employer = employers.find(e => e.id === driver.employerId);
  if (employer) sendAttendanceEmail(employer, driver, newRecord, 'checkin');

  res.status(201).json({ success: true, status: 'checked_in', record: newRecord });
});

// ── POST /api/attendance/checkout  (QR 스캔 → 퇴근) ─────────────────
router.post('/checkout', (req, res) => {
  const { driverId } = req.body;
  if (!driverId) return res.status(400).json({ error: 'driverId는 필수입니다.' });

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const records = readJSON('attendance.json');
  const idx = records.findIndex(r => r.driverId === driverId && r.date === today);

  if (idx === -1 || !records[idx].clockIn) {
    return res.status(400).json({ error: 'No check-in record found for today. Please check in first.', status: 'not_checked_in' });
  }

  if (records[idx].clockOut) {
    return res.status(409).json({ error: 'Already checked out today.', status: 'completed', clockOut: records[idx].clockOut });
  }

  const clockOut = now.toISOString();
  const { hoursWorked, otHours } = calcHours(records[idx].clockIn, clockOut);

  records[idx].clockOut = clockOut;
  records[idx].hoursWorked = hoursWorked;
  records[idx].otHours = otHours;
  records[idx].updatedAt = clockOut;

  writeJSON('attendance.json', records);

  const drivers = readJSON('drivers.json');
  const driver = drivers.find(d => d.id === driverId);
  if (driver) {
    const employers = readJSON('employers.json');
    const employer = employers.find(e => e.id === driver.employerId);
    if (employer) sendAttendanceEmail(employer, driver, records[idx], 'checkout');
  }

  res.json({ success: true, status: 'checked_out', record: records[idx] });
});

// ── GET /api/attendance/status/:driverId  (오늘 현재 상태) ────────────
router.get('/status/:driverId', (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  const records = readJSON('attendance.json');
  const record = records.find(r => r.driverId === req.params.driverId && r.date === today);

  if (!record) return res.json({ status: 'not_checked_in', date: today });
  if (record.clockIn && !record.clockOut) return res.json({ status: 'checked_in', clockIn: record.clockIn, date: today });
  if (record.clockIn && record.clockOut) return res.json({ status: 'completed', clockIn: record.clockIn, clockOut: record.clockOut, hoursWorked: record.hoursWorked, date: today });
  res.json({ status: 'not_checked_in', date: today });
});

// ── GET /api/attendance/qr/:driverId  (QR코드 이미지 반환) ───────────
router.get('/qr/:driverId', async (req, res) => {
  const { driverId } = req.params;
  console.log(`[QR] Generating for driver: ${driverId}`);
  const drivers = readJSON('drivers.json');
  const driver = drivers.find(d => d.id === driverId);
  if (!driver) return res.status(404).json({ error: 'Driver not found' });

  // 호스트 자동 감지 (GCP 배포 시 실제 도메인으로 동작)
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.get('host');
  const checkinUrl = `${protocol}://${host}/checkin/${driverId}`;

  try {
    const qrDataUrl = await QRCode.toDataURL(checkinUrl, {
      width: 300,
      margin: 2,
      color: { dark: '#6366f1', light: '#ffffff' }
    });
    res.json({ qrDataUrl, checkinUrl, driverName: driver.name });
  } catch (err) {
    res.status(500).json({ error: 'QR 생성 실패' });
  }
});

// ── POST /api/attendance  (수동 등록 — 고용인용) ────────────────────
router.post('/', (req, res) => {
  const { driverId, date, hoursWorked, clockIn, clockOut, note } = req.body;
  if (!driverId || !date) return res.status(400).json({ error: 'driverId와 date는 필수입니다.' });

  const records = readJSON('attendance.json');
  const existing = records.find(r => r.driverId === driverId && r.date === date);
  if (existing) {
    return res.status(409).json({ error: '해당 날짜에 이미 기록이 존재합니다. PUT으로 수정해주세요.', existingId: existing.id });
  }

  const settings = getPaySettings();
  const base = settings.baseHoursPerDay || 8;
  let hw = 0, ot = 0;

  if (clockIn && clockOut) {
    const calc = calcHours(clockIn, clockOut);
    hw = calc.hoursWorked;
    ot = calc.otHours;
  } else if (hoursWorked !== undefined) {
    hw = Number(hoursWorked);
    ot = Math.max(0, hw - base);
  }

  const dayType = getDayType(date);
  const newRecord = {
    id: generateId('att'),
    driverId, date, dayType,
    worked: true,
    clockIn: clockIn || null,
    clockOut: clockOut || null,
    hoursWorked: hw,
    otHours: ot,
    note: note || '',
    createdAt: new Date().toISOString()
  };

  records.push(newRecord);
  writeJSON('attendance.json', records);

  const drivers = readJSON('drivers.json');
  const driver = drivers.find(d => d.id === driverId);
  if (driver) {
    const employers = readJSON('employers.json');
    const employer = employers.find(e => e.id === driver.employerId);
    if (employer) sendAttendanceEmail(employer, driver, newRecord, 'manual');
  }

  res.status(201).json(newRecord);
});

// ── PUT /api/attendance/:id  (수정 — 고용인용) ───────────────────────
router.put('/:id', (req, res) => {
  const records = readJSON('attendance.json');
  const index = records.findIndex(r => r.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Record not found' });

  const { hoursWorked, clockIn, clockOut, worked, note, dayType } = req.body;
  const settings = getPaySettings();
  const base = settings.baseHoursPerDay || 8;

  if (worked !== undefined) records[index].worked = worked;
  if (dayType) records[index].dayType = dayType;
  if (note !== undefined) records[index].note = note;

  if (clockIn !== undefined) records[index].clockIn = clockIn;
  if (clockOut !== undefined) records[index].clockOut = clockOut;

  // clockIn+clockOut 있으면 자동 계산 우선
  if (records[index].clockIn && records[index].clockOut) {
    const calc = calcHours(records[index].clockIn, records[index].clockOut);
    records[index].hoursWorked = calc.hoursWorked;
    records[index].otHours = calc.otHours;
  } else if (hoursWorked !== undefined) {
    records[index].hoursWorked = Number(hoursWorked);
    records[index].otHours = Math.max(0, Number(hoursWorked) - base);
  }

  records[index].updatedAt = new Date().toISOString();
  writeJSON('attendance.json', records);

  const drivers = readJSON('drivers.json');
  const driver = drivers.find(d => d.id === records[index].driverId);
  if (driver) {
    const employers = readJSON('employers.json');
    const employer = employers.find(e => e.id === driver.employerId);
    if (employer) sendAttendanceEmail(employer, driver, records[index], 'manual');
  }

  res.json(records[index]);
});

// ── DELETE /api/attendance/:id ────────────────────────────────────────
router.delete('/:id', (req, res) => {
  let records = readJSON('attendance.json');
  const index = records.findIndex(r => r.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Record not found' });
  records.splice(index, 1);
  writeJSON('attendance.json', records);
  res.json({ success: true });
});

module.exports = router;

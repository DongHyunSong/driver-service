const express = require('express');
const router = express.Router();
const { readJSON, writeJSON, generateId, getPaySettings } = require('../utils/dataStore');

/**
 * GET /api/payments
 * 급여 내역 조회
 * Query: driverId, employerId, period (YYYY-MM)
 */
router.get('/', (req, res) => {
  const { driverId, employerId, period } = req.query;
  let payments = readJSON('payments.json');

  if (driverId) payments = payments.filter(p => p.driverId === driverId);
  if (employerId) payments = payments.filter(p => p.employerId === employerId);
  if (period) payments = payments.filter(p => p.period === period);

  // 최신순 정렬
  payments.sort((a, b) => b.period.localeCompare(a.period));
  res.json(payments);
});

/**
 * POST /api/payments/calculate
 * 월 급여 미리보기 계산
 * Body: { driverId, employerId, period (YYYY-MM) }
 */
router.post('/calculate', (req, res) => {
  const { driverId, employerId, period } = req.body;
  if (!driverId || !period) {
    return res.status(400).json({ error: 'driverId와 period는 필수입니다.' });
  }

  const settings = getPaySettings();
  const attendance = readJSON('attendance.json');

  // 해당 기간의 출근 기록 필터
  const monthRecords = attendance.filter(
    r => r.driverId === driverId && r.date.startsWith(period) && r.worked
  );

  // 평일/휴일 구분 집계
  let weekdayDays = 0, holidayDays = 0;
  let weekdayOtHours = 0, holidayOtHours = 0;

  monthRecords.forEach(r => {
    if (r.dayType === 'holiday') {
      holidayDays++;
      holidayOtHours += (r.otHours || 0);
    } else {
      weekdayDays++;
      weekdayOtHours += (r.otHours || 0);
    }
  });

  // 급여 계산
  const weekdayBase = weekdayDays * settings.weekday.dailyRate;
  const holidayBase = holidayDays * settings.holiday.dailyRate;
  const weekdayOtPay = weekdayOtHours * settings.weekday.otRatePerHour;
  const holidayOtPay = holidayOtHours * settings.holiday.otRatePerHour;
  const grossPay = weekdayBase + holidayBase + weekdayOtPay + holidayOtPay;

  const calculation = {
    driverId,
    employerId: employerId || null,
    period,
    totalDaysWorked: weekdayDays + holidayDays,
    weekdayDays,
    holidayDays,
    weekdayOtHours,
    holidayOtHours,
    breakdown: {
      weekdayBase,
      holidayBase,
      weekdayOtPay,
      holidayOtPay
    },
    grossPay,
    deductions: 0,
    netPay: grossPay,
    status: 'preview'
  };

  res.json(calculation);
});

/**
 * POST /api/payments/confirm
 * 급여 확정 및 지급 기록
 * Body: { driverId, employerId, period, deductions, note }
 */
router.post('/confirm', (req, res) => {
  const { driverId, employerId, period, deductions, note } = req.body;
  if (!driverId || !employerId || !period) {
    return res.status(400).json({ error: 'driverId, employerId, period는 필수입니다.' });
  }

  // 이미 확정된 급여가 있는지 확인
  const payments = readJSON('payments.json');
  const existing = payments.find(
    p => p.driverId === driverId && p.period === period && p.status === 'paid'
  );
  if (existing) {
    return res.status(409).json({ error: '해당 기간의 급여가 이미 지급 확정되었습니다.', existingId: existing.id });
  }

  // 급여 계산 다시 수행
  const settings = getPaySettings();
  const attendance = readJSON('attendance.json');
  const monthRecords = attendance.filter(
    r => r.driverId === driverId && r.date.startsWith(period) && r.worked
  );

  let weekdayDays = 0, holidayDays = 0;
  let weekdayOtHours = 0, holidayOtHours = 0;

  monthRecords.forEach(r => {
    if (r.dayType === 'holiday') {
      holidayDays++;
      holidayOtHours += (r.otHours || 0);
    } else {
      weekdayDays++;
      weekdayOtHours += (r.otHours || 0);
    }
  });

  const weekdayBase = weekdayDays * settings.weekday.dailyRate;
  const holidayBase = holidayDays * settings.holiday.dailyRate;
  const weekdayOtPay = weekdayOtHours * settings.weekday.otRatePerHour;
  const holidayOtPay = holidayOtHours * settings.holiday.otRatePerHour;
  const grossPay = weekdayBase + holidayBase + weekdayOtPay + holidayOtPay;
  const deductionAmount = Number(deductions) || 0;

  const payment = {
    id: generateId('pay'),
    driverId,
    employerId,
    period,
    totalDaysWorked: weekdayDays + holidayDays,
    weekdayDays,
    holidayDays,
    weekdayOtHours,
    holidayOtHours,
    breakdown: {
      weekdayBase,
      holidayBase,
      weekdayOtPay,
      holidayOtPay
    },
    grossPay,
    deductions: deductionAmount,
    netPay: grossPay - deductionAmount,
    note: note || '',
    status: 'paid',
    paidAt: new Date().toISOString()
  };

  payments.push(payment);
  writeJSON('payments.json', payments);
  res.status(201).json(payment);
});

/**
 * DELETE /api/payments/:id
 * 급여 지급 취소 (삭제)
 */
router.delete('/:id', (req, res) => {
  let payments = readJSON('payments.json');
  const index = payments.findIndex(p => p.id === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Payment record not found' });
  }
  payments.splice(index, 1);
  writeJSON('payments.json', payments);
  res.json({ success: true });
});

module.exports = router;

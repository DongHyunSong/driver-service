const express = require('express');
const router = express.Router();
const { getPaySettings, savePaySettings } = require('../utils/dataStore');

/**
 * GET /api/settings
 * 급여 설정 조회
 */
router.get('/', (req, res) => {
  const settings = getPaySettings();
  res.json(settings);
});

/**
 * PUT /api/settings
 * 급여 설정 수정
 * Body: 전체 또는 부분 settings 객체
 */
router.put('/', (req, res) => {
  const current = getPaySettings();
  const updated = { ...current, ...req.body };

  // 중첩 객체 병합 (weekday, holiday)
  if (req.body.weekday) {
    updated.weekday = { ...current.weekday, ...req.body.weekday };
  }
  if (req.body.holiday) {
    updated.holiday = { ...current.holiday, ...req.body.holiday };
  }

  const success = savePaySettings(updated);
  if (success) {
    res.json(updated);
  } else {
    res.status(500).json({ error: '설정 저장에 실패했습니다.' });
  }
});

module.exports = router;

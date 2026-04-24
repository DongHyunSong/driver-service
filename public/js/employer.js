/**
 * Driver Payment — Employer Module (한국어)
 * 고용인 모드: 대시보드, 출근관리(QR + 시간표시), 급여계산, 설정
 */

// ========================
// Tab Switching
// ========================
function switchEmployerTab(tabId) {
  document.querySelectorAll('#employer-tabs .tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });
  switch (tabId) {
    case 'emp-dashboard':  renderEmployerDashboard(); break;
    case 'emp-attendance': renderAttendanceCalendar(); break;
    case 'emp-salary':     renderSalaryCalc(); break;
    case 'emp-settings':   renderSettings(); break;
  }
}

// ========================
// Driver Selector
// ========================
async function getDrivers() {
  return api(`/drivers?employerId=${AppState.currentUser.id}`);
}

async function renderDriverSelector(onChangeTab) {
  let drivers = [];
  try { drivers = await getDrivers(); } catch (e) { return ''; }
  if (drivers.length <= 1) {
    if (drivers.length === 1 && !AppState.selectedDriverId) AppState.selectedDriverId = drivers[0].id;
    return '';
  }
  if (!AppState.selectedDriverId) AppState.selectedDriverId = drivers[0].id;
  return `
    <div class="driver-selector mb-md">
      <select class="form-select" onchange="AppState.selectedDriverId=this.value; ${onChangeTab}()">
        ${drivers.map(d => `
          <option value="${d.id}" ${d.id === AppState.selectedDriverId ? 'selected' : ''}>${d.name}</option>
        `).join('')}
      </select>
    </div>`;
}

// ========================
// Dashboard
// ========================
async function renderEmployerDashboard() {
  const content = document.getElementById('employer-content');
  content.innerHTML = `<div style="color:var(--text-muted);text-align:center;padding:40px">불러오는 중...</div>`;

  let drivers = [];
  try { drivers = await getDrivers(); } catch (e) {}

  let totalPayroll = 0;
  let driversHtml = '';

  for (const drv of drivers) {
    let monthAttendance = [];
    try { monthAttendance = await api(`/attendance?driverId=${drv.id}&month=${AppState.currentMonth}`); } catch (e) {}

    const worked = monthAttendance.filter(r => r.worked);
    const totalDays = worked.length;
    const totalOt   = worked.reduce((s, r) => s + (r.otHours || 0), 0);

    let grossPay = 0;
    try {
      const calc = await api('/payments/calculate', {
        method: 'POST',
        body: { driverId: drv.id, employerId: AppState.currentUser.id, period: AppState.currentMonth }
      });
      grossPay = calc.grossPay;
      totalPayroll += grossPay;
    } catch (e) {}

    // 오늘 상태
    let todayStatus = { status: 'not_checked_in' };
    try { todayStatus = await api(`/attendance/status/${drv.id}`); } catch (e) {}

    const statusDot = todayStatus.status === 'checked_in'  ? '🟢' :
                      todayStatus.status === 'completed'   ? '✅' : '⚪';

    driversHtml += `
      <div class="list-item" onclick="showQRModal('${drv.id}', '${drv.name}')">
        <div class="list-avatar">${drv.name.charAt(0).toUpperCase()}</div>
        <div class="list-info">
          <div class="list-name">${statusDot} ${drv.name}</div>
          <div class="list-meta">${totalDays}일 근무 · OT ${totalOt.toFixed(1)}h · ${formatCurrency(grossPay)}</div>
        </div>
        <div style="color:var(--text-muted)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9,18 15,12 9,6"/></svg>
        </div>
      </div>`;
  }

  content.innerHTML = `
    <div style="animation:fadeInUp .4s ease">
      <div class="flex-between mb-md">
        <h3>${formatMonthYear(AppState.currentMonth)}</h3>
        <div class="flex gap-sm">
          <button class="btn btn-ghost btn-sm" onclick="prevMonth();renderEmployerDashboard()">◀</button>
          <button class="btn btn-ghost btn-sm" onclick="nextMonth();renderEmployerDashboard()">▶</button>
        </div>
      </div>
      <div class="stat-grid">
        <div class="stat-card">
          <div class="stat-value">${drivers.length}</div>
          <div class="stat-label">드라이버 수</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${formatCurrency(totalPayroll)}</div>
          <div class="stat-label">이번 달 예상 합계</div>
        </div>
      </div>
      <div class="section-title">소속 드라이버</div>
      ${driversHtml || '<div class="empty-state"><p>등록된 드라이버가 없습니다.</p></div>'}
      <button class="btn btn-secondary btn-block mt-lg" onclick="showAddDriverModal()">+ 드라이버 추가</button>
    </div>`;
}

// ========================
// QR Code & Driver Menu Modal
// ========================
async function showQRModal(driverId, driverName) {
  AppState.selectedDriverId = driverId;
  const checkinUrl = `${window.location.origin}/checkin/${driverId}`;
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(checkinUrl)}`;
  
  showModal(`${driverName}`, `
    <div style="text-align:center">
      <div id="qr-container" style="margin-bottom:16px; min-height:220px; display:flex; align-items:center; justify-content:center;">
        <img src="${qrApiUrl}" alt="QR Code" style="border-radius:12px; background:#fff; padding:8px; width:220px; height:220px; box-shadow: var(--shadow-md);">
      </div>
      <div class="text-muted" style="font-size:var(--font-xs);margin-bottom:16px;word-break:break-all;">${checkinUrl}</div>
      
      <div class="flex gap-sm mb-lg">
        <a href="${qrApiUrl}" download="qr-${driverName}.png" target="_blank" class="btn btn-primary" style="flex:1;text-decoration:none;">
          ⬇ QR 보기/저장
        </a>
        <button class="btn btn-secondary" style="flex:1" onclick="copyCheckinUrl('${checkinUrl}')">
          🔗 링크 복사
        </button>
      </div>

      <div class="section-title">드라이버 관리</div>
      <div style="display:flex;flex-direction:column;gap:10px">
        <button class="btn btn-secondary btn-lg" onclick="closeModal();switchEmployerTab('emp-attendance')">
          📅 출근 기록 관리
        </button>
        <button class="btn btn-secondary btn-lg" onclick="closeModal();switchEmployerTab('emp-salary')">
          ₱ 급여 계산
        </button>
      </div>
    </div>
  `);
}

function copyCheckinUrl(url) {
  navigator.clipboard.writeText(url).then(() => showToast('링크가 복사되었습니다.', 'success'));
}

// ========================
// Add Driver Modal
// ========================
function showAddDriverModal() {
  showModal('드라이버 추가', `
    <div class="form-group">
      <label class="form-label">이름 (Name)</label>
      <input type="text" id="new-drv-name" class="form-input" placeholder="Juan Dela Cruz">
    </div>
    <div class="form-group">
      <label class="form-label">전화번호</label>
      <input type="tel" id="new-drv-phone" class="form-input" placeholder="09171234567">
    </div>
    <div class="form-group">
      <label class="form-label">PIN (4자리)</label>
      <input type="text" id="new-drv-pin" class="form-input" maxlength="4" inputmode="numeric" placeholder="0000">
    </div>
    <button class="btn btn-primary btn-block mt-md" onclick="addDriver()">등록</button>
  `);
}

async function addDriver() {
  const name  = document.getElementById('new-drv-name').value.trim();
  const phone = document.getElementById('new-drv-phone').value.trim();
  const pin   = document.getElementById('new-drv-pin').value.trim();
  if (!name || !pin) { showToast('이름과 PIN은 필수입니다.', 'error'); return; }
  try {
    const drv = await api('/drivers', { method: 'POST', body: { name, phone, pin, employerId: AppState.currentUser.id } });
    AppState.selectedDriverId = drv.id;
    closeModal();
    showToast('드라이버가 추가되었습니다.', 'success');
    renderEmployerDashboard();
  } catch (e) { showToast('등록 실패: ' + e.message, 'error'); }
}

// ========================
// Attendance Calendar
// ========================
async function renderAttendanceCalendar() {
  const content = document.getElementById('employer-content');
  const driverSel = await renderDriverSelector('renderAttendanceCalendar');

  if (!AppState.selectedDriverId) {
    content.innerHTML = '<div class="empty-state"><p>먼저 드라이버를 선택해주세요.</p></div>';
    return;
  }

  let attendance = [], driverName = '';
  try {
    attendance  = await api(`/attendance?driverId=${AppState.selectedDriverId}&month=${AppState.currentMonth}`);
    const drv   = await api(`/drivers/${AppState.selectedDriverId}`);
    driverName  = drv.name;
  } catch (e) {}

  const attMap = {};
  attendance.forEach(r => { attMap[r.date] = r; });

  const [year, month] = AppState.currentMonth.split('-').map(Number);
  const firstDay     = new Date(year, month - 1, 1).getDay();
  const daysInMonth  = new Date(year, month, 0).getDate();
  const today        = new Date().toISOString().slice(0, 10);
  const weekDays     = ['일','월','화','수','목','금','토'];

  let calHtml = weekDays.map(d => `<div class="calendar-weekday">${d}</div>`).join('');
  for (let i = 0; i < firstDay; i++) calHtml += '<div class="calendar-day empty"></div>';

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr  = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const rec      = attMap[dateStr];
    const isToday  = dateStr === today;
    const isSun    = new Date(year, month - 1, d).getDay() === 0;
    const isHol    = AppState.settings?.philippineHolidays?.includes(dateStr);
    let   cls      = 'calendar-day';
    if (isToday)            cls += ' today';
    if (rec?.worked)        cls += ' worked';
    if (isSun || isHol)     cls += ' holiday';

    const otBadge = rec?.otHours > 0
      ? `<span class="ot-badge">+${rec.otHours}h</span>` : '';

    calHtml += `
      <div class="${cls}" onclick="showAttendanceModal('${dateStr}')">
        <span>${d}</span>${otBadge}
      </div>`;
  }

  const worked     = attendance.filter(r => r.worked);
  const totalDays  = worked.length;
  const totalOt    = worked.reduce((s, r) => s + (r.otHours || 0), 0).toFixed(1);
  const weekdayCnt = worked.filter(r => r.dayType === 'weekday').length;
  const holidayCnt = worked.filter(r => r.dayType === 'holiday').length;

  // 일별 로그 (출퇴근 시각)
  const logHtml = worked.slice().reverse().map(r => `
    <div class="list-item" onclick="showAttendanceModal('${r.date}')">
      <div class="list-avatar" style="font-size:10px;${r.dayType==='holiday'?'background:linear-gradient(135deg,#ef4444,#f97316)':''}">${r.date.slice(8)}</div>
      <div class="list-info">
        <div class="list-name">${r.date} <span class="badge ${r.dayType==='holiday'?'badge-error':'badge-info'}">${r.dayType==='holiday'?'휴일':'평일'}</span></div>
        <div class="list-meta">
          ▶ ${r.clockIn  ? new Date(r.clockIn ).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}) : '수동입력'}
          &nbsp;→&nbsp;
          ${r.clockOut ? new Date(r.clockOut).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}) : '퇴근 전'}
          &nbsp;·&nbsp;${r.hoursWorked}h (OT:${r.otHours}h)
        </div>
      </div>
    </div>`).join('');

  content.innerHTML = `
    <div style="animation:fadeInUp .4s ease">
      ${driverSel}
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">${driverName}</div>
            <div class="card-subtitle">출근 기록</div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="showQRModal('${AppState.selectedDriverId}','${driverName}')">📱 QR</button>
        </div>
        <div class="calendar-header">
          <button class="btn btn-ghost btn-sm" onclick="prevMonth();renderAttendanceCalendar()">◀</button>
          <span class="calendar-title">${formatMonthYear(AppState.currentMonth)}</span>
          <button class="btn btn-ghost btn-sm" onclick="nextMonth();renderAttendanceCalendar()">▶</button>
        </div>
        <div class="calendar-grid">${calHtml}</div>
      </div>
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-value">${totalDays}</div><div class="stat-label">근무일수</div></div>
        <div class="stat-card"><div class="stat-value">${totalOt}h</div><div class="stat-label">OT 합계</div></div>
        <div class="stat-card"><div class="stat-value">${weekdayCnt}</div><div class="stat-label">평일</div></div>
        <div class="stat-card"><div class="stat-value">${holidayCnt}</div><div class="stat-label">휴일</div></div>
      </div>
      ${logHtml ? `<div class="section-title">일별 출퇴근 기록</div>${logHtml}` : ''}
      <button class="btn btn-secondary btn-block mt-md" onclick="showManualAttendanceModal()">+ 수동 입력</button>
    </div>`;
}

// ========================
// Attendance Modal (날짜 클릭)
// ========================
async function showAttendanceModal(dateStr) {
  let rec = null;
  try {
    const recs = await api(`/attendance?driverId=${AppState.selectedDriverId}&month=${dateStr.slice(0, 7)}`);
    rec = recs.find(r => r.date === dateStr) || null;
  } catch (e) {}

  const isSun  = new Date(dateStr + 'T00:00:00').getDay() === 0;
  const isHol  = AppState.settings?.philippineHolidays?.includes(dateStr);
  const auto   = (isSun || isHol) ? 'holiday' : 'weekday';
  const dayType = rec?.dayType || auto;

  // 시간 포맷 헬퍼
  const toLocalTime = iso => iso ? new Date(iso).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }) : '';

  const html = `
    <div class="mb-md flex-between">
      <strong>${dateStr}</strong>
      <span class="badge ${dayType==='holiday'?'badge-error':'badge-info'}">${dayType==='holiday'?'휴일':'평일'}</span>
    </div>
    ${rec ? `
      <div class="info-rows mb-md" style="background:var(--bg-input);border-radius:10px;overflow:hidden">
        <div class="info-row" style="padding:10px 14px;border-bottom:1px solid var(--border);font-size:var(--font-sm)">
          <span style="color:var(--text-muted)">출근</span>
          <span>${rec.clockIn ? new Date(rec.clockIn).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}) : '직접 입력'}</span>
        </div>
        <div class="info-row" style="padding:10px 14px;font-size:var(--font-sm)">
          <span style="color:var(--text-muted)">퇴근</span>
          <span>${rec.clockOut ? new Date(rec.clockOut).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit'}) : '퇴근 전'}</span>
        </div>
      </div>
    ` : ''}
    <div class="form-group">
      <label class="form-label">총 근무시간 (직접 수정)</label>
      <input type="number" id="modal-hours" class="form-input" value="${rec?.hoursWorked || 8}" min="0" max="24" step="0.5">
      <div class="text-muted mt-sm" style="font-size:var(--font-xs)">8시간 초과분은 자동으로 OT 적용</div>
    </div>
    <div class="form-group">
      <label class="form-label">메모</label>
      <input type="text" id="modal-note" class="form-input" value="${rec?.note || ''}" placeholder="특이사항">
    </div>
    <div class="flex gap-sm">
      <button class="btn btn-primary" style="flex:1" onclick="saveAttendance('${dateStr}','${rec?.id||''}')">
        ${rec ? '수정' : '저장'}
      </button>
      ${rec ? `<button class="btn btn-danger" onclick="deleteAttendance('${rec.id}')">삭제</button>` : ''}
    </div>`;

  showModal(rec ? '근무 기록 수정' : '근무 기록 입력', html);
}

function showManualAttendanceModal() {
  const today = new Date().toISOString().slice(0, 10);
  showModal('수동 출근 입력', `
    <div class="form-group">
      <label class="form-label">날짜</label>
      <input type="date" id="manual-date" class="form-input" value="${today}">
    </div>
    <div class="form-group">
      <label class="form-label">총 근무시간</label>
      <input type="number" id="modal-hours" class="form-input" value="8" min="0" max="24" step="0.5">
    </div>
    <div class="form-group">
      <label class="form-label">메모</label>
      <input type="text" id="modal-note" class="form-input" placeholder="특이사항">
    </div>
    <button class="btn btn-primary btn-block mt-md" onclick="saveManualAttendance()">저장</button>
  `);
}

async function saveManualAttendance() {
  const date        = document.getElementById('manual-date').value;
  const hoursWorked = parseFloat(document.getElementById('modal-hours').value);
  const note        = document.getElementById('modal-note').value;
  try {
    await api('/attendance', { method: 'POST', body: { driverId: AppState.selectedDriverId, date, hoursWorked, note } });
    closeModal(); showToast('저장되었습니다.', 'success');
    renderAttendanceCalendar();
  } catch (e) { showToast('저장 실패: ' + e.message, 'error'); }
}

async function saveAttendance(dateStr, recordId) {
  const hoursWorked = parseFloat(document.getElementById('modal-hours').value);
  const note        = document.getElementById('modal-note').value;
  try {
    if (recordId) {
      await api(`/attendance/${recordId}`, { method: 'PUT', body: { hoursWorked, note } });
    } else {
      await api('/attendance', { method: 'POST', body: { driverId: AppState.selectedDriverId, date: dateStr, hoursWorked, note } });
    }
    closeModal(); showToast('저장되었습니다.', 'success');
    renderAttendanceCalendar();
  } catch (e) { showToast('저장 실패: ' + e.message, 'error'); }
}

async function deleteAttendance(recordId) {
  try {
    await api(`/attendance/${recordId}`, { method: 'DELETE' });
    closeModal(); showToast('삭제되었습니다.', 'success');
    renderAttendanceCalendar();
  } catch (e) { showToast('삭제 실패: ' + e.message, 'error'); }
}

// ========================
// Salary Calculation
// ========================
async function renderSalaryCalc() {
  const content   = document.getElementById('employer-content');
  const driverSel = await renderDriverSelector('renderSalaryCalc');

  if (!AppState.selectedDriverId) {
    content.innerHTML = '<div class="empty-state"><p>먼저 드라이버를 선택해주세요.</p></div>';
    return;
  }

  let calc = null, driverName = '', paidPayment = null, settings = AppState.settings || {};
  try {
    const drv = await api(`/drivers/${AppState.selectedDriverId}`);
    driverName = drv.name;
    calc = await api('/payments/calculate', {
      method: 'POST',
      body: { driverId: AppState.selectedDriverId, employerId: AppState.currentUser.id, period: AppState.currentMonth }
    });
    const payments = await api(`/payments?driverId=${AppState.selectedDriverId}&period=${AppState.currentMonth}`);
    paidPayment = payments.find(p => p.status === 'paid') || null;
    settings = await api('/settings');
  } catch (e) {
    content.innerHTML = '<div class="empty-state"><p>급여 계산 중 오류가 발생했습니다.</p></div>';
    return;
  }

  const b = calc.breakdown;

  content.innerHTML = `
    <div style="animation:fadeInUp .4s ease">
      ${driverSel}
      <div class="flex-between mb-md">
        <h3>급여 계산</h3>
        <div class="flex gap-sm">
          <button class="btn btn-ghost btn-sm" onclick="prevMonth();renderSalaryCalc()">◀</button>
          <span style="font-weight:600">${formatMonthYear(AppState.currentMonth)}</span>
          <button class="btn btn-ghost btn-sm" onclick="nextMonth();renderSalaryCalc()">▶</button>
        </div>
      </div>
      <div class="payslip">
        <div class="payslip-header">
          <h3>${formatCurrency(calc.netPay)}</h3>
          <div style="opacity:.8;margin-top:4px">${driverName} · ${formatMonthYear(calc.period)}</div>
          ${paidPayment ? '<span class="badge badge-success" style="margin-top:8px">지급 완료</span>' : ''}
        </div>
        <div class="payslip-body">
          <div class="section-title">근무 내역</div>
          <div class="payslip-row"><span>총 근무일수</span><span>${calc.totalDaysWorked}일</span></div>
          <div class="payslip-row"><span>평일</span><span>${calc.weekdayDays}일</span></div>
          <div class="payslip-row"><span>휴일</span><span>${calc.holidayDays}일</span></div>
          <div class="payslip-row"><span>평일 OT</span><span>${calc.weekdayOtHours.toFixed(1)}h</span></div>
          <div class="payslip-row"><span>휴일 OT</span><span>${calc.holidayOtHours.toFixed(1)}h</span></div>
          <div class="section-title mt-lg">급여 상세</div>
          <div class="payslip-row">
            <span>평일 기본급 (${calc.weekdayDays}일 × ₱${settings?.weekday?.dailyRate})</span>
            <span>${formatCurrency(b.weekdayBase)}</span>
          </div>
          <div class="payslip-row">
            <span>휴일 기본급 (${calc.holidayDays}일 × ₱${settings?.holiday?.dailyRate})</span>
            <span>${formatCurrency(b.holidayBase)}</span>
          </div>
          <div class="payslip-row">
            <span>평일 OT (${calc.weekdayOtHours.toFixed(1)}h × ₱${settings?.weekday?.otRatePerHour})</span>
            <span>${formatCurrency(b.weekdayOtPay)}</span>
          </div>
          <div class="payslip-row">
            <span>휴일 OT (${calc.holidayOtHours.toFixed(1)}h × ₱${settings?.holiday?.otRatePerHour})</span>
            <span>${formatCurrency(b.holidayOtPay)}</span>
          </div>
          <div class="payslip-row"><span>공제</span><span class="text-error">-${formatCurrency(0)}</span></div>
          <div class="payslip-row total"><span>총 지급액</span><span class="text-success">${formatCurrency(calc.netPay)}</span></div>
        </div>
      </div>
      ${!paidPayment ? `
        <div class="form-group mt-lg">
          <label class="form-label">공제액 (₱)</label>
          <input type="number" id="deduction-amount" class="form-input" value="0" min="0" step="1" placeholder="0">
        </div>
        <div class="form-group">
          <label class="form-label">메모</label>
          <input type="text" id="payment-note" class="form-input" placeholder="급여 지급 메모 (선택)">
        </div>
        <button class="btn btn-success btn-block btn-lg" onclick="confirmPayment()">✓ 급여 지급 확정</button>
      ` : `
        <div class="card mt-md text-center">
          <span class="badge badge-success">지급 완료</span>
          <div class="text-muted mt-sm" style="font-size:var(--font-xs)">${new Date(paidPayment.paidAt).toLocaleString('ko-KR')}</div>
        </div>`}
    </div>`;
}

async function confirmPayment() {
  const deductions = parseFloat(document.getElementById('deduction-amount')?.value || 0);
  const note       = document.getElementById('payment-note')?.value || '';
  try {
    await api('/payments/confirm', {
      method: 'POST',
      body: { driverId: AppState.selectedDriverId, employerId: AppState.currentUser.id, period: AppState.currentMonth, deductions, note }
    });
    showToast('급여가 지급 확정되었습니다!', 'success');
    renderSalaryCalc();
  } catch (e) { showToast('급여 확정 실패: ' + e.message, 'error'); }
}

// ========================
// Settings
// ========================
async function renderSettings() {
  const content  = document.getElementById('employer-content');
  const settings = AppState.settings = await api('/settings');

  content.innerHTML = `
    <div style="animation:fadeInUp .4s ease">
      <h3 class="mb-lg">급여 설정</h3>
      <div class="section-title">기본 설정</div>
      <div class="settings-item">
        <span class="settings-label">월 기본 근무일수</span>
        <input type="number" class="settings-input" id="set-baseDays" value="${settings.baseDaysPerMonth}" min="1" max="31">
      </div>
      <div class="settings-item">
        <span class="settings-label">일 기본 근무시간 (OT 기준)</span>
        <input type="number" class="settings-input" id="set-baseHours" value="${settings.baseHoursPerDay}" min="1" max="24">
      </div>
      <div class="section-title mt-lg">평일 (Weekday)</div>
      <div class="settings-item">
        <span class="settings-label">일당</span>
        <div class="flex gap-sm" style="align-items:center"><span style="color:var(--text-muted)">₱</span>
        <input type="number" class="settings-input" id="set-wkDailyRate" value="${settings.weekday.dailyRate}" step="1"></div>
      </div>
      <div class="settings-item">
        <span class="settings-label">OT 시급</span>
        <div class="flex gap-sm" style="align-items:center"><span style="color:var(--text-muted)">₱</span>
        <input type="number" class="settings-input" id="set-wkOtRate" value="${settings.weekday.otRatePerHour}" step="0.01"></div>
      </div>
      <div class="section-title mt-lg">휴일 (Holiday / Sunday)</div>
      <div class="settings-item">
        <span class="settings-label">일당</span>
        <div class="flex gap-sm" style="align-items:center"><span style="color:var(--text-muted)">₱</span>
        <input type="number" class="settings-input" id="set-holDailyRate" value="${settings.holiday.dailyRate}" step="1"></div>
      </div>
      <div class="settings-item">
        <span class="settings-label">OT 시급</span>
        <div class="flex gap-sm" style="align-items:center"><span style="color:var(--text-muted)">₱</span>
        <input type="number" class="settings-input" id="set-holOtRate" value="${settings.holiday.otRatePerHour}" step="0.01"></div>
      </div>
      <button class="btn btn-primary btn-block btn-lg mt-lg" onclick="saveSettings()">설정 저장</button>

      <div class="section-title mt-lg">필리핀 공휴일 (${settings.philippineHolidays?.length || 0}일)</div>
      <div class="card" style="max-height:200px;overflow-y:auto">
        ${(settings.philippineHolidays || []).map(h => `
          <div class="payslip-row">
            <span>${h}</span>
            <button class="btn btn-ghost btn-sm text-error" onclick="removeHoliday('${h}')">✕</button>
          </div>`).join('')}
      </div>
      <div class="flex gap-sm mt-sm">
        <input type="date" id="new-holiday-date" class="form-input" style="flex:1">
        <button class="btn btn-secondary" onclick="addHoliday()">추가</button>
      </div>
    </div>`;
}

async function saveSettings() {
  try {
    const updated = await api('/settings', {
      method: 'PUT',
      body: {
        baseDaysPerMonth: parseInt(document.getElementById('set-baseDays').value),
        baseHoursPerDay:  parseInt(document.getElementById('set-baseHours').value),
        weekday: {
          dailyRate:     parseFloat(document.getElementById('set-wkDailyRate').value),
          otRatePerHour: parseFloat(document.getElementById('set-wkOtRate').value)
        },
        holiday: {
          dailyRate:     parseFloat(document.getElementById('set-holDailyRate').value),
          otRatePerHour: parseFloat(document.getElementById('set-holOtRate').value)
        }
      }
    });
    AppState.settings = updated;
    showToast('설정이 저장되었습니다.', 'success');
  } catch (e) { showToast('저장 실패: ' + e.message, 'error'); }
}

async function addHoliday() {
  const date     = document.getElementById('new-holiday-date').value;
  if (!date) return;
  const holidays = [...(AppState.settings.philippineHolidays || [])];
  if (holidays.includes(date)) { showToast('이미 등록된 공휴일입니다.', 'warning'); return; }
  holidays.push(date); holidays.sort();
  try {
    AppState.settings = await api('/settings', { method: 'PUT', body: { philippineHolidays: holidays } });
    showToast('공휴일이 추가되었습니다.', 'success'); renderSettings();
  } catch (e) { showToast('추가 실패: ' + e.message, 'error'); }
}

async function removeHoliday(date) {
  const holidays = (AppState.settings.philippineHolidays || []).filter(h => h !== date);
  try {
    AppState.settings = await api('/settings', { method: 'PUT', body: { philippineHolidays: holidays } });
    showToast('공휴일이 삭제되었습니다.', 'success'); renderSettings();
  } catch (e) { showToast('삭제 실패: ' + e.message, 'error'); }
}

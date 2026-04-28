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
          <div class="list-meta">${totalDays}일 근무 · OT ${totalOt.toFixed(1)}h</div>
        </div>
        <div style="color:var(--text-muted)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9,18 15,12 9,6"/></svg>
        </div>
      </div>`;
  }

  content.innerHTML = `
    <div style="animation:fadeInUp .4s ease">

      <div style="display:flex; justify-content:center; margin-bottom: var(--space-lg);">
        <div class="stat-card" style="width: 100%; max-width: 240px;">
          <div class="stat-value" style="font-size: var(--font-3xl);">${drivers.length}</div>
          <div class="stat-label">등록된 드라이버 수</div>
        </div>
      </div>
      <div class="section-title">소속 드라이버</div>
      ${driversHtml || '<div class="empty-state"><p>등록된 드라이버가 없습니다.</p></div>'}
      <button class="btn btn-secondary btn-block mt-lg" onclick="showRegisterModal('driver')">+ 드라이버 추가</button>
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
// Attendance Calendar & Table
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

  const isTable = AppState.attendanceView === 'table';

  // Toggle View Handler
  window.toggleAttendanceView = (view) => {
    AppState.attendanceView = view;
    renderAttendanceCalendar();
  };

  let viewContent = '';
  if (isTable) {
    viewContent = buildAttendanceTableHTML(AppState.currentMonth, attendance, AppState.settings, 'ko');
  } else {
    const [year, month] = AppState.currentMonth.split('-').map(Number);
    const firstDay     = new Date(year, month - 1, 1).getDay();
    const daysInMonth  = new Date(year, month, 0).getDate();
    const today        = new Date().toISOString().slice(0, 10);
    const weekDays     = ['일','월','화','수','목','금','토'];

    let calHtml = weekDays.map(d => `<div class="calendar-weekday">${d}</div>`).join('');
    for (let i = 0; i < firstDay; i++) calHtml += '<div class="calendar-day empty"></div>';

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr  = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const rec      = attendance.find(r => r.date === dateStr);
      const isToday  = dateStr === today;
      const isSun    = new Date(year, month - 1, d).getDay() === 0;
      const isHol    = AppState.settings?.philippineHolidays?.includes(dateStr);
      let   cls      = 'calendar-day';
      if (isToday)            cls += ' today';
      if (rec?.worked)        cls += ' worked';
      if (isSun || isHol)     cls += ' holiday';

      const otBadge = rec?.otHours > 0 ? `<span class="ot-badge">+${rec.otHours}h</span>` : '';
      const hoursWorked = rec?.hoursWorked ? `<div style="font-size: 10px; opacity: 0.8; margin-top: 4px;">(${rec.hoursWorked}h)</div>` : '';

      calHtml += `
        <div class="${cls}" onclick="showAttendanceModal('${dateStr}')">
          <span>${d}</span>${hoursWorked}${otBadge}
        </div>`;
    }
    viewContent = `<div class="calendar-grid">${calHtml}</div>`;
  }

  const worked     = attendance.filter(r => r.worked);
  const totalDays  = worked.length;
  const totalOt    = worked.reduce((s, r) => s + (r.otHours || 0), 0).toFixed(1);
  const weekdayCnt = worked.filter(r => r.dayType === 'weekday').length;
  const holidayCnt = worked.filter(r => r.dayType === 'holiday').length;

  // Excel Export Handler
  window.handleExcelExport = () => {
    exportAttendanceToExcel(AppState.currentMonth, attendance, AppState.settings, driverName, 'ko');
  };

  window.handleCSVExport = () => {
    exportAttendanceToCSV(AppState.currentMonth, attendance, AppState.settings, driverName, 'ko');
  };

  content.innerHTML = `
    <div style="animation:fadeInUp .4s ease">
      ${driverSel}
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">${driverName}</div>
            <div class="card-subtitle">출근 기록</div>
          </div>
          <div class="view-toggle">
            <button class="btn btn-sm ${!isTable ? 'active' : ''}" onclick="toggleAttendanceView('calendar')">달력</button>
            <button class="btn btn-sm ${isTable ? 'active' : ''}" onclick="toggleAttendanceView('table')">표</button>
          </div>
        </div>
        <div class="calendar-header">
          <button class="btn btn-ghost btn-sm" onclick="prevMonth();renderAttendanceCalendar()">◀</button>
          <span class="calendar-title">${formatMonthYear(AppState.currentMonth)}</span>
          <button class="btn btn-ghost btn-sm" onclick="nextMonth();renderAttendanceCalendar()">▶</button>
        </div>
        ${viewContent}
      </div>
      <div class="stat-grid">
        <div class="stat-card"><div class="stat-value">${totalDays}</div><div class="stat-label">근무일수</div></div>
        <div class="stat-card"><div class="stat-value">${totalOt}h</div><div class="stat-label">OT 합계</div></div>
        <div class="stat-card"><div class="stat-value">${weekdayCnt}</div><div class="stat-label">평일</div></div>
        <div class="stat-card"><div class="stat-value">${holidayCnt}</div><div class="stat-label">휴일</div></div>
      </div>
      <div class="section-title">기능</div>
      <div class="flex gap-sm">
        <button class="btn btn-secondary btn-block" onclick="handleExcelExport()">
          📊 Excel 다운로드 (.xlsx)
        </button>
        <button class="btn btn-secondary btn-block" onclick="handleCSVExport()">
          📄 CSV 다운로드 (.csv)
        </button>
      </div>
      ${AppState.currentUser.isAdmin ? `<button class="btn btn-secondary btn-block mt-md" onclick="showManualAttendanceModal()">+ 수동 입력</button>` : ''}
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
        <div class="info-row" style="padding:10px 14px;font-size:var(--font-sm)">
          <span style="color:var(--text-muted)">총 근무시간</span>
          <span>${rec.hoursWorked ? rec.hoursWorked + '시간' : '-'}</span>
        </div>
      </div>
    ` : '<div class="text-muted" style="text-align:center;padding:20px;">출퇴근 기록이 없습니다.</div>'}
    
    ${AppState.currentUser.isAdmin ? `
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
      </div>
    ` : ''}`;

  showModal(rec ? '근무 기록 확인' : '근무 기록', html);
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



/**
 * Driver Payment — Employer Module (한국어)
 * 고용인 모드: 대시보드, 출근관리(QR + 시간표시), 급여계산, 설정
 */

// ========================
// Time Input Auto-Formatter
// ========================
/**
 * 숫자만 입력받아 HH:mm 형식으로 자동 변환
 * 예: "0400" → "04:00", "17" → "17", "1730" → "17:30"
 */
function formatTimeInput(el) {
  // 숫자와 콜론만 허용
  let raw = el.value.replace(/[^\d:]/g, '');
  // 콜론 제거 후 순수 숫자 추출
  const digits = raw.replace(/:/g, '');
  let formatted = digits;
  if (digits.length >= 3) {
    formatted = digits.slice(0, 2) + ':' + digits.slice(2, 4);
  }
  el.value = formatted;
}

// ========================
// Tab Switching
// ========================
function switchEmployerTab(tabId) {
  document.querySelectorAll('#employer-tabs .tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });

  // Show admin tab only for Admin users
  const adminTabBtn = document.getElementById('tab-btn-admin');
  if (adminTabBtn) {
    adminTabBtn.style.display = AppState.currentUser?.isAdmin ? '' : 'none';
  }

  switch (tabId) {
    case 'emp-dashboard':  renderEmployerDashboard(); break;
    case 'emp-attendance': renderAttendanceCalendar(); break;
    case 'emp-schedule':   renderEmployerSchedule(); break;
    case 'emp-admin':      renderAdminPanel(); break;
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
  content.innerHTML = `<div style="color:var(--text-muted);text-align:center;padding:40px">Loading...</div>`;

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
          <div class="list-meta">${totalDays} days · OT ${totalOt.toFixed(1)}h</div>
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
          <div class="stat-label">Registered Drivers</div>
        </div>
      </div>
      <div class="section-title">My Drivers</div>
      ${driversHtml || '<div class="empty-state"><p>No registered drivers.</p></div>'}
      <button class="btn btn-secondary btn-block mt-lg" onclick="showRegisterModal('driver')">+ Add Driver</button>
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
          ⬇ View/Save QR
        </a>
        <button class="btn btn-secondary" style="flex:1" onclick="copyCheckinUrl('${checkinUrl}')">
          🔗 Copy Link
        </button>
      </div>

      <div class="section-title">Driver Management</div>
      <div style="display:flex;flex-direction:column;gap:10px">
        <button class="btn btn-secondary btn-lg" onclick="closeModal();switchEmployerTab('emp-attendance')">
          📅 Manage Attendance
        </button>
      </div>
    </div>
  `);
}

function copyCheckinUrl(url) {
  navigator.clipboard.writeText(url).then(() => showToast('Link copied.', 'success'));
}

// ========================
// Add Driver Modal
// ========================
function showAddDriverModal() {
  showModal('Add Driver', `
    <div class="form-group">
      <label class="form-label">Name</label>
      <input type="text" id="new-drv-name" class="form-input" placeholder="Juan Dela Cruz">
    </div>
    <div class="form-group">
      <label class="form-label">Phone</label>
      <input type="tel" id="new-drv-phone" class="form-input" placeholder="09171234567">
    </div>
    <div class="form-group">
      <label class="form-label">PIN (4 digits)</label>
      <input type="text" id="new-drv-pin" class="form-input" maxlength="4" inputmode="numeric" placeholder="0000">
    </div>
    <div class="flex gap-sm mt-md">
      <button class="btn btn-secondary" style="flex:1" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" style="flex:1" onclick="addDriver()">Register</button>
    </div>
  `);
}

async function addDriver() {
  const name  = document.getElementById('new-drv-name').value.trim();
  const phone = document.getElementById('new-drv-phone').value.trim();
  const pin   = document.getElementById('new-drv-pin').value.trim();
  if (!name || !pin) { showToast('Name and PIN are required.', 'error'); return; }
  try {
    const drv = await api('/drivers', { method: 'POST', body: { name, phone, pin, employerId: AppState.currentUser.id } });
    AppState.selectedDriverId = drv.id;
    closeModal();
    showToast('Driver added successfully.', 'success');
    renderEmployerDashboard();
  } catch (e) { showToast('Failed: ' + e.message, 'error'); }
}

// ========================
// Attendance Calendar & Table
// ========================
async function renderAttendanceCalendar() {
  const content = document.getElementById('employer-content');
  const driverSel = await renderDriverSelector('renderAttendanceCalendar');

  if (!AppState.selectedDriverId) {
    content.innerHTML = '<div class="empty-state"><p>Please select a driver first.</p></div>';
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
    const today        = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
    const weekDays     = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

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
            <div class="card-subtitle">Attendance Records</div>
          </div>
          <div class="view-toggle">
            <button class="btn btn-sm ${!isTable ? 'active' : ''}" onclick="toggleAttendanceView('calendar')">Calendar</button>
            <button class="btn btn-sm ${isTable ? 'active' : ''}" onclick="toggleAttendanceView('table')">Table</button>
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
        <div class="stat-card"><div class="stat-value">${totalDays}</div><div class="stat-label">Days Worked</div></div>
        <div class="stat-card"><div class="stat-value">${totalOt}h</div><div class="stat-label">Total OT</div></div>
        <div class="stat-card"><div class="stat-value">${weekdayCnt}</div><div class="stat-label">Weekday</div></div>
        <div class="stat-card"><div class="stat-value">${holidayCnt}</div><div class="stat-label">Holiday</div></div>
      </div>
      <div class="section-title">Functions</div>
      <div class="flex gap-sm">
        <button class="btn btn-secondary btn-block" onclick="handleExcelExport()">
          📊 Download Excel (.xlsx)
        </button>
        <button class="btn btn-secondary btn-block" onclick="handleCSVExport()">
          📄 Download CSV (.csv)
        </button>
      </div>
      ${AppState.currentUser.isAdmin ? `<button class="btn btn-secondary btn-block mt-md" onclick="showManualAttendanceModal()">+ Manual Entry</button>` : ''}
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
  const toLocalTime = iso => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  };
  // 입력 필드 표시용: HH:mm
  const getLocalTimeInputStr = iso => {
    if (!iso) return '';
    const d = new Date(iso);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  const html = `
    <div class="mb-md flex-between">
      <strong>${dateStr}</strong>
      <span class="badge ${dayType==='holiday'?'badge-error':'badge-info'}">${dayType==='holiday'?'Holiday':'Weekday'}</span>
    </div>
    ${rec ? `
      <div class="info-rows mb-md" style="background:var(--bg-input);border-radius:10px;overflow:hidden">
        <div class="info-row" style="padding:10px 14px;border-bottom:1px solid var(--border);font-size:var(--font-sm)">
          <span style="color:var(--text-muted)">Clock In</span>
          <span style="display:flex;align-items:center;gap:6px">
            <span>${rec.originalClockIn ? `${toLocalTime(rec.originalClockIn)} <span style="color:var(--text-muted);font-size:0.9em;">(Manual ${toLocalTime(rec.clockIn)})</span>` : (rec.clockIn ? toLocalTime(rec.clockIn) : 'Manual Entry')}</span>
            ${rec.clockInLocation ? `<a href="https://www.google.com/maps?q=${rec.clockInLocation.lat},${rec.clockInLocation.lng}" target="_blank" style="font-size:0.85em;color:var(--accent-primary);text-decoration:none" title="View on map">📍</a>` : ''}
          </span>
        </div>
        <div class="info-row" style="padding:10px 14px;border-bottom:1px solid var(--border);font-size:var(--font-sm)">
          <span style="color:var(--text-muted)">Clock Out</span>
          <span style="display:flex;align-items:center;gap:6px">
            <span>${rec.originalClockOut ? `${toLocalTime(rec.originalClockOut)} <span style="color:var(--text-muted);font-size:0.9em;">(Manual ${toLocalTime(rec.clockOut)})</span>` : (rec.clockOut ? toLocalTime(rec.clockOut) : 'Active')}</span>
            ${rec.clockOutLocation ? `<a href="https://www.google.com/maps?q=${rec.clockOutLocation.lat},${rec.clockOutLocation.lng}" target="_blank" style="font-size:0.85em;color:var(--accent-primary);text-decoration:none" title="View on map">📍</a>` : ''}
          </span>
        </div>
        <div class="info-row" style="padding:10px 14px;font-size:var(--font-sm)">
          <span style="color:var(--text-muted)">Hours Worked</span>
          <span>${rec.hoursWorked ? rec.hoursWorked + ' hours' : '-'}</span>
        </div>
      </div>
    ` : '<div class="text-muted" style="text-align:center;padding:20px;">No attendance records.</div>'}
    
    ${AppState.currentUser.isAdmin ? `
      <div class="form-group">
        <label class="form-label" style="margin-bottom:6px">Edit Clock In/Out</label>
        <div style="display:flex;gap:6px;align-items:center">
          <input type="text" id="modal-clockin" class="form-input" value="${getLocalTimeInputStr(rec?.clockIn)}" placeholder="HH:mm" inputmode="numeric" maxlength="5" oninput="formatTimeInput(this)" style="flex:1;min-width:0;font-size:12px;padding:6px 6px;text-align:center;letter-spacing:1px">
          <span style="color:var(--text-muted);flex-shrink:0;font-size:12px">→</span>
          <input type="text" id="modal-clockout" class="form-input" value="${getLocalTimeInputStr(rec?.clockOut)}" placeholder="HH:mm" inputmode="numeric" maxlength="5" oninput="formatTimeInput(this)" style="flex:1;min-width:0;font-size:12px;padding:6px 6px;text-align:center;letter-spacing:1px">
        </div>
        <div class="text-muted mt-sm" style="font-size:var(--font-xs)">Modifying times auto-calculates hours worked.</div>
      </div>
      <div class="form-group">
        <label class="form-label">Total Hours</label>
        <input type="number" id="modal-hours" class="form-input" value="${rec?.hoursWorked || 8}" min="0" max="24" step="0.5">
      </div>
      <div class="form-group">
        <label class="form-label">Note</label>
        <input type="text" id="modal-note" class="form-input" value="${rec?.note || ''}" placeholder="Remarks">
      </div>
      <div class="flex gap-sm">
        <button class="btn btn-secondary" style="flex:1" onclick="closeModal()">Cancel</button>
        <button class="btn btn-primary" style="flex:1" onclick="saveAttendance('${dateStr}','${rec?.id||''}')">
          ${rec ? 'Update' : 'Save'}
        </button>
        ${rec ? `<button class="btn btn-danger" onclick="deleteAttendance('${rec.id}')">Delete</button>` : ''}
      </div>
    ` : ''}` ;

  showModal(rec ? 'View Record' : 'Record', html);
}

function showManualAttendanceModal() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  showModal('Manual Entry', `
    <div class="form-group">
      <label class="form-label">Date</label>
      <input type="date" id="manual-date" class="form-input" value="${today}">
    </div>
    <div class="form-group">
      <label class="form-label" style="margin-bottom:6px">Clock In/Out</label>
      <div style="display:flex;gap:6px;align-items:center">
        <input type="text" id="modal-clockin" class="form-input" placeholder="HH:mm" inputmode="numeric" maxlength="5" oninput="formatTimeInput(this)" style="flex:1;min-width:0;font-size:12px;padding:6px 6px;text-align:center;letter-spacing:1px">
        <span style="color:var(--text-muted);flex-shrink:0;font-size:12px">→</span>
        <input type="text" id="modal-clockout" class="form-input" placeholder="HH:mm" inputmode="numeric" maxlength="5" oninput="formatTimeInput(this)" style="flex:1;min-width:0;font-size:12px;padding:6px 6px;text-align:center;letter-spacing:1px">
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">Total Hours</label>
      <input type="number" id="modal-hours" class="form-input" value="8" min="0" max="24" step="0.5">
    </div>
    <div class="form-group">
      <label class="form-label">Note</label>
      <input type="text" id="modal-note" class="form-input" placeholder="Remarks">
    </div>
    <div class="flex gap-sm mt-md">
      <button class="btn btn-secondary" style="flex:1" onclick="closeModal()">Cancel</button>
      <button class="btn btn-primary" style="flex:1" onclick="saveManualAttendance()">Save</button>
    </div>
  `);
}

async function saveManualAttendance() {
  const date        = document.getElementById('manual-date').value;
  const clockInTime = document.getElementById('modal-clockin').value;
  const clockOutTime = document.getElementById('modal-clockout').value;
  const hoursWorked = parseFloat(document.getElementById('modal-hours').value);
  const note        = document.getElementById('modal-note').value;

  // HH:mm 또는 HH:mm:ss 텍스트 직접 입력 파싱
  const toISO = (dateStr, timeStr) => {
    if (!timeStr || !timeStr.trim()) return undefined;
    const t = timeStr.trim();
    const parts = t.split(':');
    const normalized = parts.length === 2 ? `${t}:00` : t;
    const d = new Date(`${dateStr}T${normalized}`);
    if (isNaN(d.getTime())) { showToast(`Invalid time format: ${t} (e.g., 17:30:00)`, 'error'); return null; }
    return d.toISOString();
  };

  const clockIn  = toISO(date, clockInTime);
  const clockOut = toISO(date, clockOutTime);

  try {
    await api('/attendance', { method: 'POST', body: { driverId: AppState.selectedDriverId, date, clockIn, clockOut, hoursWorked, note } });
    closeModal(); showToast('Saved.', 'success');
    renderAttendanceCalendar();
  } catch (e) { showToast('Save failed: ' + e.message, 'error'); }
}

async function saveAttendance(dateStr, recordId) {
  const clockInTime  = document.getElementById('modal-clockin')?.value;
  const clockOutTime = document.getElementById('modal-clockout')?.value;
  const hoursWorked  = parseFloat(document.getElementById('modal-hours').value);
  const note         = document.getElementById('modal-note').value;

  // HH:mm 또는 HH:mm:ss 텍스트 직접 입력 파싱
  const toISO = (date, timeStr) => {
    if (!timeStr || !timeStr.trim()) return undefined;
    const t = timeStr.trim();
    const parts = t.split(':');
    const normalized = parts.length === 2 ? `${t}:00` : t;
    const d = new Date(`${date}T${normalized}`);
    if (isNaN(d.getTime())) { showToast(`Invalid time format: ${t} (e.g., 17:30:00)`, 'error'); return null; }
    return d.toISOString();
  };

  const clockIn  = toISO(dateStr, clockInTime);
  const clockOut = toISO(dateStr, clockOutTime);

  try {
    if (recordId) {
      await api(`/attendance/${recordId}`, { method: 'PUT', body: { clockIn, clockOut, hoursWorked, note } });
    } else {
      await api('/attendance', { method: 'POST', body: { driverId: AppState.selectedDriverId, date: dateStr, clockIn, clockOut, hoursWorked, note } });
    }
    closeModal(); showToast('Saved.', 'success');
    renderAttendanceCalendar();
  } catch (e) { showToast('Save failed: ' + e.message, 'error'); }
}

async function deleteAttendance(recordId) {
  try {
    await api(`/attendance/${recordId}`, { method: 'DELETE' });
    closeModal(); showToast('Deleted.', 'success');
    renderAttendanceCalendar();
  } catch (e) { showToast('Delete failed: ' + e.message, 'error'); }
}

// ========================
// Schedule Management (Employer)
// ========================
async function renderEmployerSchedule() {
  const content = document.getElementById('employer-content');
  const driverSel = await renderDriverSelector('renderEmployerSchedule');

  if (!AppState.selectedDriverId) {
    content.innerHTML = '<div class="empty-state"><p>Please select a driver first.</p></div>';
    return;
  }

  let schedules = [], driverName = '';
  try {
    schedules = await api(`/schedules?driverId=${AppState.selectedDriverId}&month=${AppState.currentMonth}`);
    const drv = await api(`/drivers/${AppState.selectedDriverId}`);
    driverName = drv.name;
  } catch (e) {}

  const [year, month] = AppState.currentMonth.split('-').map(Number);
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  const weekDays = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  let calHtml = weekDays.map(d => `<div class="calendar-weekday">${d}</div>`).join('');
  for (let i = 0; i < firstDay; i++) calHtml += '<div class="calendar-day empty"></div>';

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const daySchedules = schedules.filter(s => s.date === dateStr);
    const isToday = dateStr === today;
    const isSun = new Date(year, month - 1, d).getDay() === 0;
    const isHol = AppState.settings?.philippineHolidays?.includes(dateStr);
    
    let cls = 'calendar-day';
    if (isToday) cls += ' today';
    if (isSun || isHol) cls += ' holiday';
    if (daySchedules.length > 0) cls += ' worked';

    const badge = daySchedules.length > 0 ? `<div style="font-size:10px; margin-top:2px; background:var(--accent); color:white; border-radius:4px; padding:2px 4px;">${daySchedules.length}</div>` : '';

    calHtml += `
      <div class="${cls}" onclick="showScheduleModal('${dateStr}')">
        <span>${d}</span>${badge}
      </div>`;
  }

  content.innerHTML = `
    <div style="animation:fadeInUp .4s ease">
      ${driverSel}
      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">${driverName} Schedule</div>
          </div>
        </div>
        <div class="calendar-header">
          <button class="btn btn-ghost btn-sm" onclick="prevMonth();renderEmployerSchedule()">◀</button>
          <span class="calendar-title">${formatMonthYear(AppState.currentMonth)}</span>
          <button class="btn btn-ghost btn-sm" onclick="nextMonth();renderEmployerSchedule()">▶</button>
        </div>
        <div class="calendar-grid">${calHtml}</div>
      </div>
      
      <div class="section-title mt-lg">Monthly Schedules</div>
      ${schedules.length === 0 ? '<div class="empty-state"><p>No schedules</p></div>' : ''}
      ${schedules.map(s => `
        <div class="list-item" onclick="showScheduleModal('${s.date}')">
          <div class="list-avatar" style="font-size:12px; background:var(--accent);">${s.date.slice(8)}</div>
          <div class="list-info">
            <div class="list-name">${s.time} - ${s.pickupPerson}</div>
            <div class="list-meta">${s.pickupLocation} → ${s.destination}</div>
          </div>
        </div>
      `).join('')}
    </div>`;
}

async function showScheduleModal(dateStr) {
  let schedules = [];
  try {
    const all = await api(`/schedules?driverId=${AppState.selectedDriverId}&month=${dateStr.slice(0, 7)}`);
    schedules = all.filter(s => s.date === dateStr);
  } catch (e) {}

  window.currentDaySchedules = schedules;

  const listHtml = schedules.length > 0 ? schedules.map(s => `
    <div class="list-item" style="padding:10px; border:1px solid var(--border); border-radius:8px; margin-bottom:10px; cursor:pointer;" onclick="populateScheduleForm('${s.id}')">
      <div class="list-info">
        <div class="list-name">${s.time} - ${s.pickupPerson}</div>
        <div class="list-meta">${s.pickupLocation} → ${s.destination}</div>
      </div>
      <button class="btn-icon" onclick="event.stopPropagation(); deleteSchedule('${s.id}')">❌</button>
    </div>
  `).join('') : '<div class="text-muted" style="text-align:center;padding:10px;">No schedules</div>';

  showModal(`${dateStr} Schedule`, `
    <div style="padding-bottom: 80px;">
      <div style="max-height: 200px; overflow-y:auto; margin-bottom:16px;">
        ${listHtml}
      </div>
      <hr style="border:none; border-top:1px solid var(--border); margin:16px 0;">
      <div class="section-title" id="sch-form-title">Add Schedule</div>
      <div class="form-group">
        <label class="form-label">Time</label>
        <input type="time" id="sch-time" class="form-input" required>
      </div>
      <div class="form-group">
        <label class="form-label">Pickup Person</label>
        <input type="text" id="sch-person" class="form-input" placeholder="e.g. Boss, Family">
      </div>
      <div class="form-group">
        <label class="form-label">Pickup Location</label>
        <input type="text" id="sch-location" class="form-input" placeholder="Start Point">
      </div>
      <div class="form-group">
        <label class="form-label">Destination</label>
        <input type="text" id="sch-destination" class="form-input" placeholder="End Point">
      </div>
      <div class="form-group">
        <label class="form-label">Note</label>
        <input type="text" id="sch-note" class="form-input" placeholder="Remarks">
      </div>
      <div class="flex gap-sm mt-md">
        <button class="btn btn-secondary" style="flex:1" onclick="closeModal()">Cancel</button>
        <button id="sch-submit-btn" class="btn btn-primary" style="flex:1" onclick="saveSchedule('${dateStr}')">Register</button>
      </div>
    </div>
  `);
}

window.populateScheduleForm = function(id) {
  const s = window.currentDaySchedules.find(x => x.id === id);
  if(!s) return;
  document.getElementById('sch-time').value = s.time;
  document.getElementById('sch-person').value = s.pickupPerson || '';
  document.getElementById('sch-location').value = s.pickupLocation || '';
  document.getElementById('sch-destination').value = s.destination || '';
  document.getElementById('sch-note').value = s.note || '';
  
  const btn = document.getElementById('sch-submit-btn');
  btn.textContent = 'Update';
  btn.onclick = () => updateSchedule(id, s.date);
  document.getElementById('sch-form-title').textContent = 'Edit Schedule';
};

async function updateSchedule(id, dateStr) {
  const time = document.getElementById('sch-time').value;
  const pickupPerson = document.getElementById('sch-person').value;
  const pickupLocation = document.getElementById('sch-location').value;
  const destination = document.getElementById('sch-destination').value;
  const note = document.getElementById('sch-note').value;
  if (!time) return showToast('Please enter time.', 'error');

  try {
    const body = { date: dateStr, time, pickupPerson, pickupLocation, destination, note };
    await api(`/schedules/${id}`, { method: 'PUT', body });
    closeModal();
    showToast('Schedule updated.', 'success');
    renderEmployerSchedule();
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  }
}

async function saveSchedule(dateStr) {
  const time = document.getElementById('sch-time').value;
  const pickupPerson = document.getElementById('sch-person').value;
  const pickupLocation = document.getElementById('sch-location').value;
  const destination = document.getElementById('sch-destination').value;
  const note = document.getElementById('sch-note').value;

  if (!time) return showToast('Please enter time.', 'error');

  try {
    const body = { driverId: AppState.selectedDriverId, date: dateStr, time, pickupPerson, pickupLocation, destination, note };
    const s = await api('/schedules', { method: 'POST', body });
    
    if (confirm('Add this to Google Calendar?')) {
      window.open(getGoogleCalendarUrl(s), '_blank');
    }

    closeModal();
    showToast('Schedule registered.', 'success');
    renderEmployerSchedule();
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  }
}

async function deleteSchedule(id) {
  if (!confirm('Delete this schedule?')) return;
  try {
    await api(`/schedules/${id}`, { method: 'DELETE' });
    closeModal();
    showToast('Deleted.', 'success');
    renderEmployerSchedule();
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  }
}

// ========================
// Admin Panel — Data Export / Import
// ========================
function renderAdminPanel() {
  if (!AppState.currentUser?.isAdmin) {
    document.getElementById('employer-content').innerHTML =
      '<div class="empty-state"><p>Admin access required.</p></div>';
    return;
  }

  // Show admin tab
  const adminTabBtn = document.getElementById('tab-btn-admin');
  if (adminTabBtn) adminTabBtn.style.display = '';

  const content = document.getElementById('employer-content');
  content.innerHTML = `
    <div style="animation:fadeInUp .4s ease">

      <!-- Header -->
      <div class="section-title" style="margin-bottom:4px;">⚙️ Admin Panel</div>
      <div style="color:var(--text-muted); font-size:var(--font-sm); margin-bottom:var(--space-lg);">Manage app data. Only visible to Admin account.</div>

      <!-- Export Card -->
      <div class="card" style="margin-bottom:var(--space-md);">
        <div class="card-header">
          <div>
            <div class="card-title">📦 Export Data</div>
            <div class="card-subtitle">Download a full backup of all data as JSON</div>
          </div>
        </div>
        <div style="padding: var(--space-md);">
          <div style="background:var(--bg-input); border-radius:var(--radius-md); padding:12px 16px; margin-bottom:var(--space-md); font-size:var(--font-sm); color:var(--text-muted); line-height:1.6;">
            Includes: <strong style="color:var(--text-primary)">Attendance records, Schedules, Driver list, Employer list, Payments, Pay settings</strong>
          </div>
          <button class="btn btn-primary btn-block" onclick="exportAllData()">
            ⬇️ Download Backup (.json)
          </button>
        </div>
      </div>

      <!-- Import Card -->
      <div class="card" style="margin-bottom:var(--space-md);">
        <div class="card-header">
          <div>
            <div class="card-title">📂 Import Data</div>
            <div class="card-subtitle">Restore from a previously exported backup file</div>
          </div>
        </div>
        <div style="padding: var(--space-md);">
          <div style="background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.25); border-radius:var(--radius-md); padding:12px 16px; margin-bottom:var(--space-md); font-size:var(--font-sm); color:var(--error); line-height:1.6;">
            ⚠️ <strong>Warning:</strong> Import will <strong>overwrite</strong> all existing data with the backup. This cannot be undone.
          </div>

          <!-- Drop Zone -->
          <div id="drop-zone" style="
            border: 2px dashed var(--border-active);
            border-radius: var(--radius-lg);
            padding: 32px 16px;
            text-align: center;
            cursor: pointer;
            transition: all .2s;
            margin-bottom: var(--space-md);
            background: var(--bg-input);
          " onclick="document.getElementById('import-file-input').click()" ondragover="handleDragOver(event)" ondragleave="handleDragLeave(event)" ondrop="handleFileDrop(event)">
            <div style="font-size:2rem; margin-bottom:8px;">📁</div>
            <div id="drop-zone-label" style="font-weight:600; color:var(--text-muted); font-size:var(--font-sm);">Tap or drag a backup .json file here</div>
          </div>
          <input type="file" id="import-file-input" accept=".json,application/json" style="display:none" onchange="handleFileSelected(this.files[0])">

          <!-- Preview (hidden until file selected) -->
          <div id="import-preview" style="display:none; background:var(--bg-input); border-radius:var(--radius-md); padding:14px 16px; margin-bottom:var(--space-md); font-size:var(--font-sm);"></div>

          <button id="import-btn" class="btn btn-danger btn-block" onclick="importAllData()" disabled style="opacity:0.5;">
            ⬆️ Restore from Backup
          </button>
        </div>
      </div>

      <!-- Danger Zone -->
      <div style="color:var(--text-muted); font-size:var(--font-xs); text-align:center; padding: var(--space-md);">Admin PIN is required for all export/import operations.</div>
    </div>
  `;
}

// Selected file stored for import
let _importFileData = null;

function handleDragOver(e) {
  e.preventDefault();
  document.getElementById('drop-zone').style.borderColor = 'var(--accent-primary)';
  document.getElementById('drop-zone').style.background = 'rgba(99,102,241,0.08)';
}

function handleDragLeave(e) {
  document.getElementById('drop-zone').style.borderColor = 'var(--border-active)';
  document.getElementById('drop-zone').style.background = 'var(--bg-input)';
}

function handleFileDrop(e) {
  e.preventDefault();
  handleDragLeave(e);
  const file = e.dataTransfer.files[0];
  if (file) handleFileSelected(file);
}

function handleFileSelected(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (!parsed.data) {
        showToast('Invalid backup file: missing data field.', 'error');
        return;
      }
      _importFileData = parsed;

      // Show preview
      const d = parsed.data;
      const exportedDate = parsed.exportedAt ? new Date(parsed.exportedAt).toLocaleString('en-PH') : 'Unknown';
      const previewEl = document.getElementById('import-preview');
      previewEl.style.display = 'block';
      previewEl.innerHTML = `
        <div style="font-weight:700; margin-bottom:10px; color:var(--text-primary);">📋 Backup Preview</div>
        <div style="color:var(--text-muted); margin-bottom:10px;">Exported: ${exportedDate}</div>
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px;">
          ${[
            ['Employers',   (d.employers  ||[]).length],
            ['Drivers',     (d.drivers    ||[]).length],
            ['Attendance',  (d.attendance ||[]).length],
            ['Schedules',   (d.schedules  ||[]).length],
            ['Payments',    (d.payments   ||[]).length],
            ['Pay Settings', d.paySettings ? '✓' : '—'],
          ].map(([label, val]) => `
            <div style="background:var(--bg-card); border-radius:8px; padding:8px 12px; display:flex; justify-content:space-between;">
              <span style="color:var(--text-muted);">${label}</span>
              <strong>${val}</strong>
            </div>
          `).join('')}
        </div>
      `;

      // Update drop zone label
      document.getElementById('drop-zone-label').textContent = `✅ ${file.name} selected`;
      document.getElementById('drop-zone-label').style.color = 'var(--success)';

      // Enable import button
      const importBtn = document.getElementById('import-btn');
      importBtn.disabled = false;
      importBtn.style.opacity = '1';
    } catch (err) {
      showToast('Failed to parse file: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
}

async function exportAllData() {
  try {
    showToast('Preparing export...', 'info');
    const res = await fetch('/api/admin/export', {
      headers: { 'X-Admin-Pin': '0000' }
    });
    if (!res.ok) {
      const err = await res.json();
      showToast('Export failed: ' + err.error, 'error');
      return;
    }
    const blob = await res.blob();
    const today = new Date().toISOString().slice(0, 10);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `driver-attendance-backup-${today}.json`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
    showToast('Backup downloaded successfully!', 'success');
  } catch (e) {
    showToast('Export error: ' + e.message, 'error');
  }
}

async function importAllData() {
  if (!_importFileData) {
    showToast('Please select a backup file first.', 'error');
    return;
  }
  const exportedAt = _importFileData.exportedAt
    ? new Date(_importFileData.exportedAt).toLocaleString('en-PH')
    : 'Unknown';
  const confirmed = confirm(
    `⚠️ RESTORE FROM BACKUP?\n\nBackup date: ${exportedAt}\n\nThis will OVERWRITE all current data. Are you sure?`
  );
  if (!confirmed) return;

  try {
    const importBtn = document.getElementById('import-btn');
    importBtn.disabled = true;
    importBtn.textContent = '⏳ Restoring...';

    // Build FormData with the JSON file
    const blob = new Blob([JSON.stringify(_importFileData)], { type: 'application/json' });
    const formData = new FormData();
    formData.append('backup', blob, 'backup.json');

    const res = await fetch('/api/admin/import?adminPin=0000', {
      method: 'POST',
      headers: { 'X-Admin-Pin': '0000' },
      body: formData
    });

    const result = await res.json();
    if (!res.ok) {
      showToast('Import failed: ' + result.error, 'error');
      importBtn.disabled = false;
      importBtn.textContent = '⬆️ Restore from Backup';
      importBtn.style.opacity = '1';
      return;
    }

    const r = result.restored;
    showToast(
      `✅ Restored! Attendance:${r.attendance ?? 0}, Schedules:${r.schedules ?? 0}, Drivers:${r.drivers ?? 0}`,
      'success'
    );
    _importFileData = null;

    // Reset UI
    setTimeout(() => renderAdminPanel(), 1500);
  } catch (e) {
    showToast('Import error: ' + e.message, 'error');
  }
}

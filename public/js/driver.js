/**
 * Driver Payment — Driver Module (English)
 * Driver mode: My Salary, Attendance, Pay Slip
 */

// ========================
// Tab Switching
// ========================
function switchDriverTab(tabId) {
  document.querySelectorAll('#driver-tabs .tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });

  switch (tabId) {
    case 'drv-attendance': renderDriverAttendance(); break;
    case 'drv-schedule': renderDriverSchedule(); break;
  }
}

// ========================
// My Attendance
// ========================
async function renderDriverAttendance() {
  const content = document.getElementById('driver-content');
  const user = AppState.currentUser;

  let attendance = [], schedules = [];
  try {
    const p1 = api(`/attendance?driverId=${user.id}&month=${AppState.currentMonth}`);
    const p2 = api(`/schedules?driverId=${user.id}&month=${AppState.currentMonth}`);
    [attendance, schedules] = await Promise.all([p1, p2]);
  } catch (e) {}

  // Build calendar
  const [year, month] = AppState.currentMonth.split('-').map(Number);
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });

  const attendanceMap = {};
  attendance.forEach(r => { attendanceMap[r.date] = r; });

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  let calendarHtml = weekdays.map(d =>
    `<div class="calendar-weekday">${d}</div>`
  ).join('');

  for (let i = 0; i < firstDay; i++) {
    calendarHtml += '<div class="calendar-day empty"></div>';
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const record = attendanceMap[dateStr];
    const isToday = dateStr === today;
    const dayOfWeek = new Date(year, month - 1, d).getDay();
    const isSun = dayOfWeek === 0;
    const isHol = AppState.settings?.philippineHolidays?.includes(dateStr);

    let classes = 'calendar-day';
    if (isToday) classes += ' today';
    if (record && record.worked) classes += ' worked';
    if (isSun || isHol) classes += ' holiday';

    let otBadge = '';
    if (record && record.otHours > 0) {
      otBadge = `<span class="ot-badge">+${record.otHours}h</span>`;
    }
    const hoursWorked = record && record.hoursWorked ? `<div style="font-size: 10px; opacity: 0.8; margin-top: 4px;">(${record.hoursWorked}h)</div>` : '';

    const daySchedules = schedules.filter(s => s.date === dateStr);
    const schBadge = daySchedules.length > 0 ? `<div style="font-size: 10px; background: var(--accent2); color: white; border-radius: 4px; padding: 2px 4px; margin-top: 2px;">${daySchedules.length} Sch</div>` : '';

    calendarHtml += `
      <div class="${classes}" style="cursor:pointer;" onclick="showDriverScheduleModal('${dateStr}')">
        <span>${d}</span>
        ${hoursWorked}
        ${otBadge}
        ${schBadge}
      </div>
    `;
  }

  const workedDays = attendance.filter(r => r.worked).length;
  const totalOt = attendance.reduce((sum, r) => sum + (r.otHours || 0), 0);

  content.innerHTML = `
    <div style="animation: fadeInUp 0.4s ease">
      <div class="card">
        <div class="calendar-header">
          <button class="btn btn-ghost btn-sm" onclick="prevMonth(); renderDriverAttendance();">◀</button>
          <span class="calendar-title">${formatMonthYearEn(AppState.currentMonth)}</span>
          <button class="btn btn-ghost btn-sm" onclick="nextMonth(); renderDriverAttendance();">▶</button>
        </div>
        <div class="calendar-grid">
          ${calendarHtml}
        </div>
      </div>

      <div class="stat-grid mt-md">
        <div class="stat-card">
          <div class="stat-value">${workedDays}</div>
          <div class="stat-label">Days Worked</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">${totalOt}h</div>
          <div class="stat-label">Total OT</div>
        </div>
      </div>

      ${attendance.length > 0 ? `
        <div class="section-title mt-lg">Daily Log</div>
        ${attendance.filter(r => r.worked).map(r => `
          <div class="list-item">
            <div class="list-avatar" style="font-size: 10px; ${r.dayType === 'holiday' ? 'background: linear-gradient(135deg, #ef4444, #f97316);' : ''}">
              ${r.date.slice(8)}
            </div>
            <div class="list-info">
              <div class="list-name">${r.date}</div>
              <div class="list-meta">${r.dayType === 'holiday' ? 'Holiday' : 'Weekday'} · ${r.hoursWorked}h${r.otHours > 0 ? ` (OT: ${r.otHours}h)` : ''}</div>
            </div>
            ${r.note ? `<span class="badge badge-info">📝</span>` : ''}
          </div>
        `).join('')}
      ` : ''}
    </div>
  `;
}

// ========================
// Schedule Management (Driver)
// ========================
async function renderDriverSchedule() {
  const content = document.getElementById('driver-content');
  const user = AppState.currentUser;

  let schedules = [];
  try {
    schedules = await api(`/schedules?driverId=${user.id}&month=${AppState.currentMonth}`);
  } catch (e) {}

  const [year, month] = AppState.currentMonth.split('-').map(Number);
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Manila' });
  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  let calHtml = weekdays.map(d => `<div class="calendar-weekday">${d}</div>`).join('');
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
      <div class="${cls}" onclick="showDriverScheduleModal('${dateStr}')">
        <span>${d}</span>${badge}
      </div>`;
  }

  content.innerHTML = `
    <div style="animation: fadeInUp 0.4s ease">
      <div class="card">
        <div class="calendar-header">
          <button class="btn btn-ghost btn-sm" onclick="prevMonth(); renderDriverSchedule();">◀</button>
          <span class="calendar-title">${formatMonthYearEn(AppState.currentMonth)}</span>
          <button class="btn btn-ghost btn-sm" onclick="nextMonth(); renderDriverSchedule();">▶</button>
        </div>
        <div class="calendar-grid">
          ${calHtml}
        </div>
      </div>

      <div class="section-title mt-lg">Upcoming Schedules</div>
      ${schedules.length === 0 ? '<div class="empty-state"><p>No schedules for this month.</p></div>' : ''}
      ${schedules.filter(s => s.date >= today).map(s => `
        <div class="list-item" onclick="showDriverScheduleModal('${s.date}')">
          <div class="list-avatar" style="font-size:12px; background:var(--accent);">${s.date.slice(8)}</div>
          <div class="list-info">
            <div class="list-name">${s.time} - ${s.pickupPerson || 'Pickup'}</div>
            <div class="list-meta">${s.pickupLocation || 'N/A'} → ${s.destination || 'N/A'}</div>
            ${s.note ? `<div style="font-size:11px; color:var(--text-muted); margin-top:4px;">📝 ${s.note}</div>` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

async function showDriverScheduleModal(dateStr) {
  let schedules = [];
  try {
    const all = await api(`/schedules?driverId=${AppState.currentUser.id}&month=${dateStr.slice(0, 7)}`);
    schedules = all.filter(s => s.date === dateStr);
  } catch (e) {}

  const listHtml = schedules.length > 0 ? schedules.map(s => `
    <div class="list-item" style="padding:10px; border:1px solid var(--border); border-radius:8px; margin-bottom:10px;">
      <div class="list-info">
        <div class="list-name">${s.time} - ${s.pickupPerson || 'Pickup'}</div>
        <div class="list-meta">From: ${s.pickupLocation || 'N/A'}<br>To: ${s.destination || 'N/A'}</div>
        ${s.note ? `<div style="font-size:11px; color:var(--text-muted); margin-top:4px;">📝 ${s.note}</div>` : ''}
      </div>
      <a href="${getGoogleCalendarUrl(s)}" target="_blank" class="btn btn-sm btn-secondary" style="text-decoration:none; text-align:center;">
        Google<br>Calendar
      </a>
    </div>
  `).join('') : '<div class="text-muted" style="text-align:center;padding:10px;">No schedules for this date.</div>';

  showModal(`${dateStr} Schedule`, `
    <div style="padding-bottom: 80px;">
      <div style="max-height: 300px; overflow-y:auto; margin-bottom:16px;">
        ${listHtml}
      </div>
    </div>
  `);
}

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
  }
}

// ========================
// My Attendance
// ========================
async function renderDriverAttendance() {
  const content = document.getElementById('driver-content');
  const user = AppState.currentUser;

  let attendance = [];
  try {
    attendance = await api(`/attendance?driverId=${user.id}&month=${AppState.currentMonth}`);
  } catch (e) {}

  // Build calendar
  const [year, month] = AppState.currentMonth.split('-').map(Number);
  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = new Date().toISOString().slice(0, 10);

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

    calendarHtml += `
      <div class="${classes}">
        <span>${d}</span>
        ${hoursWorked}
        ${otBadge}
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


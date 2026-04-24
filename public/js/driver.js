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
    case 'drv-salary': renderDriverSalary(); break;
    case 'drv-attendance': renderDriverAttendance(); break;
    case 'drv-payslip': renderDriverPayslip(); break;
  }
}

// ========================
// My Salary (Overview)
// ========================
async function renderDriverSalary() {
  const content = document.getElementById('driver-content');
  const user = AppState.currentUser;

  let calc = null;
  try {
    calc = await api('/payments/calculate', {
      method: 'POST',
      body: { driverId: user.id, period: AppState.currentMonth }
    });
  } catch (e) {}

  // 과거 급여 내역
  let payments = [];
  try {
    payments = await api(`/payments?driverId=${user.id}`);
  } catch (e) {}

  content.innerHTML = `
    <div style="animation: fadeInUp 0.4s ease">
      <div class="flex-between mb-md">
        <h3>My Salary</h3>
        <div class="flex gap-sm">
          <button class="btn btn-ghost btn-sm" onclick="prevMonth(); renderDriverSalary();">◀</button>
          <span style="font-weight:600">${formatMonthYearEn(AppState.currentMonth)}</span>
          <button class="btn btn-ghost btn-sm" onclick="nextMonth(); renderDriverSalary();">▶</button>
        </div>
      </div>

      ${calc ? `
        <div class="card text-center" style="padding: var(--space-xl);">
          <div class="text-muted" style="font-size: var(--font-sm);">Estimated Pay</div>
          <div style="font-size: var(--font-3xl); font-weight: 800; background: var(--accent-gradient); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin: var(--space-sm) 0;">
            ${formatCurrency(calc.netPay)}
          </div>
          <div class="text-muted" style="font-size: var(--font-xs);">
            ${calc.totalDaysWorked} days worked · ${calc.weekdayOtHours + calc.holidayOtHours}h OT
          </div>
        </div>

        <div class="stat-grid mt-md">
          <div class="stat-card">
            <div class="stat-value">${calc.totalDaysWorked}</div>
            <div class="stat-label">Days Worked</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${calc.weekdayOtHours + calc.holidayOtHours}h</div>
            <div class="stat-label">Total OT</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${calc.weekdayDays}</div>
            <div class="stat-label">Weekdays</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${calc.holidayDays}</div>
            <div class="stat-label">Holidays</div>
          </div>
        </div>
      ` : `
        <div class="empty-state">
          <p>No attendance records for this month.</p>
        </div>
      `}

      ${payments.length > 0 ? `
        <div class="section-title mt-lg">Payment History</div>
        ${payments.map(p => `
          <div class="list-item">
            <div class="list-avatar">₱</div>
            <div class="list-info">
              <div class="list-name">${formatMonthYearEn(p.period)}</div>
              <div class="list-meta">${p.totalDaysWorked} days · ${p.weekdayOtHours + p.holidayOtHours}h OT</div>
            </div>
            <div class="list-value">
              <div class="list-amount">${formatCurrency(p.netPay)}</div>
              <span class="badge badge-success">Paid</span>
            </div>
          </div>
        `).join('')}
      ` : ''}
    </div>
  `;
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

    calendarHtml += `
      <div class="${classes}">
        <span>${d}</span>
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

// ========================
// Pay Slip
// ========================
async function renderDriverPayslip() {
  const content = document.getElementById('driver-content');
  const user = AppState.currentUser;

  let calc = null;
  try {
    calc = await api('/payments/calculate', {
      method: 'POST',
      body: { driverId: user.id, period: AppState.currentMonth }
    });
  } catch (e) {}

  // Check if paid
  let paidPayment = null;
  try {
    const payments = await api(`/payments?driverId=${user.id}&period=${AppState.currentMonth}`);
    paidPayment = payments.find(p => p.status === 'paid');
  } catch (e) {}

  if (!calc || calc.totalDaysWorked === 0) {
    content.innerHTML = `
      <div style="animation: fadeInUp 0.4s ease">
        <div class="flex-between mb-lg">
          <h3>Pay Slip</h3>
          <div class="flex gap-sm">
            <button class="btn btn-ghost btn-sm" onclick="prevMonth(); renderDriverPayslip();">◀</button>
            <span style="font-weight:600">${formatMonthYearEn(AppState.currentMonth)}</span>
            <button class="btn btn-ghost btn-sm" onclick="nextMonth(); renderDriverPayslip();">▶</button>
          </div>
        </div>
        <div class="empty-state">
          <p>No records available for this month.</p>
        </div>
      </div>
    `;
    return;
  }

  const b = calc.breakdown;
  const settings = AppState.settings;

  content.innerHTML = `
    <div style="animation: fadeInUp 0.4s ease">
      <div class="flex-between mb-lg">
        <h3>Pay Slip</h3>
        <div class="flex gap-sm">
          <button class="btn btn-ghost btn-sm" onclick="prevMonth(); renderDriverPayslip();">◀</button>
          <span style="font-weight:600">${formatMonthYearEn(AppState.currentMonth)}</span>
          <button class="btn btn-ghost btn-sm" onclick="nextMonth(); renderDriverPayslip();">▶</button>
        </div>
      </div>

      <div class="payslip">
        <div class="payslip-header">
          <div style="opacity:0.8; font-size: var(--font-sm);">Net Pay</div>
          <h3>${formatCurrency(paidPayment ? paidPayment.netPay : calc.netPay)}</h3>
          <div style="opacity:0.8; margin-top:4px; font-size: var(--font-sm);">${formatMonthYearEn(calc.period)}</div>
          ${paidPayment ? '<span class="badge badge-success" style="margin-top:8px; background: rgba(255,255,255,0.2); color: white;">✓ Paid</span>' : '<span class="badge badge-warning" style="margin-top:8px">Pending</span>'}
        </div>
        <div class="payslip-body">
          <div class="section-title">Work Summary</div>
          <div class="payslip-row">
            <span>Weekday Work</span>
            <span>${calc.weekdayDays} days</span>
          </div>
          <div class="payslip-row">
            <span>Holiday Work</span>
            <span>${calc.holidayDays} days</span>
          </div>
          <div class="payslip-row">
            <span>Weekday OT</span>
            <span>${calc.weekdayOtHours} hours</span>
          </div>
          <div class="payslip-row">
            <span>Holiday OT</span>
            <span>${calc.holidayOtHours} hours</span>
          </div>

          <div class="section-title mt-lg">Earnings</div>
          <div class="payslip-row">
            <span>Weekday Base (${calc.weekdayDays}d × ₱${settings?.weekday?.dailyRate || 695})</span>
            <span>${formatCurrency(b.weekdayBase)}</span>
          </div>
          <div class="payslip-row">
            <span>Holiday Base (${calc.holidayDays}d × ₱${settings?.holiday?.dailyRate || 1000})</span>
            <span>${formatCurrency(b.holidayBase)}</span>
          </div>
          <div class="payslip-row">
            <span>Weekday OT (${calc.weekdayOtHours}h × ₱${settings?.weekday?.otRatePerHour || 0})</span>
            <span>${formatCurrency(b.weekdayOtPay)}</span>
          </div>
          <div class="payslip-row">
            <span>Holiday OT (${calc.holidayOtHours}h × ₱${settings?.holiday?.otRatePerHour || 0})</span>
            <span>${formatCurrency(b.holidayOtPay)}</span>
          </div>
          <div class="payslip-row">
            <span>Deductions</span>
            <span class="text-error">-${formatCurrency(calc.deductions)}</span>
          </div>
          <div class="payslip-row total">
            <span>Net Pay</span>
            <span class="text-success">${formatCurrency(calc.netPay)}</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

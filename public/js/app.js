/**
 * Driver Payment — Core App Module
 * SPA 라우팅, API 유틸리티, 공통 함수
 */

// ========================
// State Management
// ========================
const AppState = {
  currentUser: null,      // { id, name, ... }
  currentRole: null,      // 'employer' | 'driver'
  settings: null,         // pay-settings
  selectedDriverId: null,
  currentMonth: new Date().toISOString().slice(0, 7), // YYYY-MM
  attendanceView: 'calendar', // 'calendar' | 'table'
};

// ========================
// Attendance Table (Shared)
// ========================

/**
 * 월 전체 날짜 배열 생성 (근무 기록 없는 날도 포함)
 */
function buildMonthDays(month, attendance, settings) {
  const [year, mon] = month.split('-').map(Number);
  const daysInMonth = new Date(year, mon, 0).getDate();
  const holidays    = (settings?.philippineHolidays) || [];
  const attMap      = {};
  attendance.forEach(r => { attMap[r.date] = r; });

  const days = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(mon).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dow     = new Date(year, mon - 1, d).getDay(); // 0=Sun
    const isHol   = holidays.includes(dateStr) || dow === 0;
    const rec     = attMap[dateStr] || null;

    const DOW_KO = ['일','월','화','수','목','금','토'];
    const DOW_EN = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

    days.push({
      dateStr,
      dow,
      dowKo: DOW_KO[dow],
      dowEn: DOW_EN[dow],
      isHoliday: isHol,
      autoType: isHol ? 'holiday' : 'weekday',
      rec
    });
  }
  return days;
}

/**
 * HTML 테이블 빌드 (고용인 한국어 / 드라이버 영어 공용)
 * @param {string} lang 'ko' | 'en'
 */
function buildAttendanceTableHTML(month, attendance, settings, lang = 'ko') {
  const isKo  = lang === 'ko';
  const days  = buildMonthDays(month, attendance, settings);

  let totalWorked = 0, totalHours = 0, totalOt = 0, totalBasePay = 0, totalOtPay = 0;

  const rows = days.map(day => {
    const { dateStr, dowKo, dowEn, isHoliday, autoType, rec } = day;
    const worked   = rec?.worked ?? false;
    const dayType  = rec?.dayType ?? autoType;
    const isHolRow = dayType === 'holiday';
    const rate     = isHolRow ? settings?.holiday : settings?.weekday;

    const clockIn  = rec?.clockIn  ? new Date(rec.clockIn ).toLocaleTimeString(isKo ? 'ko-KR' : 'en-PH', { hour:'2-digit', minute:'2-digit', hour12: !isKo }) : '';
    const clockOut = rec?.clockOut ? new Date(rec.clockOut).toLocaleTimeString(isKo ? 'ko-KR' : 'en-PH', { hour:'2-digit', minute:'2-digit', hour12: !isKo }) : '';
    const hours    = rec?.hoursWorked ?? 0;
    const ot       = rec?.otHours    ?? 0;
    const basePay  = worked ? (rate?.dailyRate ?? 0) : 0;
    const otPay    = worked ? (ot * (rate?.otRatePerHour ?? 0)) : 0;
    const totalPay = basePay + otPay;

    if (worked) {
      totalWorked++;
      totalHours  += hours;
      totalOt     += ot;
      totalBasePay += basePay;
      totalOtPay   += otPay;
    }

    const rowCls = !worked ? 'row-absent' : isHolRow ? 'row-holiday' : 'row-worked';
    const dtLabel = isKo
      ? (isHolRow ? '휴일' : '평일')
      : (isHolRow ? 'Holiday' : 'Weekday');

    return `
      <tr class="${rowCls}">
        <td class="col-date ${isHolRow ? 'col-holiday' : ''}">${dateStr}</td>
        <td>${isKo ? dowKo : dowEn}</td>
        <td><span class="badge ${isHolRow ? 'badge-error' : 'badge-info'}" style="font-size:10px">${dtLabel}</span></td>
        <td>${clockIn || (worked ? (isKo ? '직접입력' : 'Manual') : '—')}</td>
        <td>${clockOut || (worked && rec?.clockIn ? (isKo ? '퇴근전' : 'Active') : '—')}</td>
        <td>${worked ? hours.toFixed(1) + 'h' : '—'}</td>
        <td class="${ot > 0 ? 'col-ot' : ''}">${worked ? ot.toFixed(1) + 'h' : '—'}</td>
        <td>${worked ? '₱' + basePay.toLocaleString() : '—'}</td>
        <td class="${ot > 0 ? 'col-ot' : ''}">${worked && ot > 0 ? '₱' + otPay.toFixed(0) : '—'}</td>
        <td class="col-total">${worked ? '₱' + totalPay.toFixed(0) : '—'}</td>
        <td style="text-align:left;color:var(--text-muted)">${rec?.note || ''}</td>
      </tr>`;
  }).join('');

  const tfoot = `
    <tfoot>
      <tr>
        <td colspan="2" style="text-align:left">${isKo ? '합계' : 'Total'}</td>
        <td>${totalWorked}${isKo ? '일' : ' days'}</td>
        <td colspan="2"></td>
        <td>${totalHours.toFixed(1)}h</td>
        <td>${totalOt.toFixed(1)}h</td>
        <td>₱${totalBasePay.toLocaleString()}</td>
        <td>₱${totalOtPay.toFixed(0)}</td>
        <td>₱${(totalBasePay + totalOtPay).toFixed(0)}</td>
        <td></td>
      </tr>
    </tfoot>`;

  const th = (t) => `<th>${t}</th>`;
  const headers = isKo
    ? ['날짜','요일','구분','출근','퇴근','근무시간','OT','기본급','OT급여','합계','메모']
    : ['Date','Day','Type','Clock In','Clock Out','Hours','OT','Base Pay','OT Pay','Total','Note'];

  return `
    <div class="att-table-wrap">
      <table class="att-table">
        <thead><tr>${headers.map(th).join('')}</tr></thead>
        <tbody>${rows}</tbody>
        ${tfoot}
      </table>
    </div>`;
}

/**
 * Excel(.xlsx) Export — SheetJS
 */
function exportAttendanceToExcel(month, attendance, settings, driverName, lang = 'ko') {
  const isKo = lang === 'ko';
  const days  = buildMonthDays(month, attendance, settings);

  const headers = isKo
    ? ['날짜','요일','구분','출근시각','퇴근시각','근무시간(h)','OT(h)','메모']
    : ['Date','Day','Type','Clock In','Clock Out','Hours Worked','OT Hours','Note'];

  const sheetData = [headers];
  let totalWorked=0, totalHours=0, totalOt=0;

  days.forEach(({ dateStr, dowKo, dowEn, isHoliday, autoType, rec }) => {
    const worked  = rec?.worked ?? false;
    const dayType = rec?.dayType ?? autoType;
    const isHolRow = dayType === 'holiday';

    const fmtTime = (iso) => iso ? new Date(iso).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12: false }) : '';
    const hours   = rec?.hoursWorked ?? 0;
    const ot      = rec?.otHours    ?? 0;

    if (worked) { totalWorked++; totalHours+=hours; totalOt+=ot; }

    const dtLabel = isKo ? (isHolRow ? '휴일' : '평일') : (isHolRow ? 'Holiday' : 'Weekday');

    let clockInStr = '';
    let clockOutStr = '';
    let noteStr = rec?.note || '';

    if (worked) {
      if (!rec?.clockIn) {
        clockInStr = '08:00:00';
        const endDate = new Date(`2000-01-01T08:00:00`);
        endDate.setMinutes(endDate.getMinutes() + hours * 60);
        clockOutStr = endDate.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12: false });
        noteStr = '개인입력' + (noteStr ? ' - ' + noteStr : '');
      } else {
        clockInStr = fmtTime(rec.clockIn);
        clockOutStr = fmtTime(rec.clockOut);
      }
    }

    sheetData.push([
      dateStr,
      isKo ? dowKo : dowEn,
      dtLabel,
      clockInStr,
      clockOutStr,
      worked ? hours : '',
      worked ? ot : '',
      noteStr
    ]);
  });

  // 합계 행
  const totalLabel = isKo ? '합계' : 'Total';
  sheetData.push([
    totalLabel, '', `${totalWorked}${isKo?'일':' days'}`, '', '',
    parseFloat(totalHours.toFixed(2)),
    parseFloat(totalOt.toFixed(2)),
    ''
  ]);

  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // 열 너비 설정
  ws['!cols'] = [
    {wch:12},{wch:6},{wch:8},{wch:10},{wch:10},
    {wch:10},{wch:8},{wch:20}
  ];

  const wb = XLSX.utils.book_new();
  const sheetName = month.replace('-','_');
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const downloadDate = `${yyyy}${mm}${dd}`;

  const safeDriver = driverName.replace(/[^a-zA-Z0-9가-힣]/g, '_');
  XLSX.writeFile(wb, `${safeDriver}_${month}_${downloadDate}.xlsx`);
  return true;
}

/**
 * CSV Export (Date, Check-in, Check-out Only)
 */
function exportAttendanceToCSV(month, attendance, settings, driverName, lang = 'ko') {
  const isKo = lang === 'ko';
  const days  = buildMonthDays(month, attendance, settings);

  const headers = isKo ? ['날짜', '출근시간', '퇴근시간'] : ['Date', 'Check-in', 'Check-out'];
  const sheetData = [headers];

  days.forEach(({ dateStr, rec }) => {
    const worked  = rec?.worked ?? false;
    const fmtTime = (iso) => iso ? new Date(iso).toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12: false }) : '';
    
    let clockInStr = '';
    let clockOutStr = '';

    if (worked) {
      if (!rec?.clockIn) {
        const hours = rec?.hoursWorked ?? 0;
        clockInStr = '08:00:00';
        const endDate = new Date(`2000-01-01T08:00:00`);
        endDate.setMinutes(endDate.getMinutes() + hours * 60);
        clockOutStr = endDate.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit', second:'2-digit', hour12: false });
      } else {
        clockInStr = fmtTime(rec.clockIn);
        clockOutStr = fmtTime(rec.clockOut);
      }
    }

    sheetData.push([
      dateStr,
      clockInStr,
      clockOutStr
    ]);
  });

  const csvContent = sheetData.map(e => e.join(",")).join("\n");
  const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
  
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const downloadDate = `${yyyy}${mm}${dd}`;

  const safeDriver = driverName.replace(/[^a-zA-Z0-9가-힣]/g, '_');
  const fileName = `${safeDriver}_${month}_${downloadDate}.csv`;

  if (window.navigator && window.navigator.msSaveOrOpenBlob) {
    window.navigator.msSaveOrOpenBlob(blob, fileName);
  } else {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.style.display = "none";
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }, 1000);
  }
  
  return true;
}

// ========================
// API Helper
// ========================
async function api(endpoint, options = {}) {
  const { method = 'GET', body } = options;
  const config = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };
  if (body) config.body = JSON.stringify(body);

  try {
    const res = await fetch(`/api${endpoint}`, config);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  } catch (err) {
    console.error(`API ${method} ${endpoint}:`, err);
    throw err;
  }
}

// ========================
// Screen Navigation
// ========================
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const screen = document.getElementById(screenId);
  if (screen) screen.classList.add('active');
}

// ========================
// Formatting Helpers
// ========================
function formatCurrency(amount) {
  return `₱${Number(amount).toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

function formatMonthYear(monthStr) {
  const [y, m] = monthStr.split('-');
  return `${y}년 ${parseInt(m)}월`;
}

function formatMonthYearEn(monthStr) {
  const [y, m] = monthStr.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m) - 1]} ${y}`;
}

// ========================
// Month Navigation
// ========================
function prevMonth() {
  const [y, m] = AppState.currentMonth.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  AppState.currentMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function nextMonth() {
  const [y, m] = AppState.currentMonth.split('-').map(Number);
  const d = new Date(y, m, 1);
  AppState.currentMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ========================
// Modal
// ========================
function showModal(titleText, contentHtml) {
  closeModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'app-modal';
  overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };

  overlay.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3 class="modal-title">${titleText}</h3>
        <button class="btn-icon" onclick="closeModal()">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
      <div class="modal-body">${contentHtml}</div>
    </div>
  `;

  document.body.appendChild(overlay);
}

function closeModal() {
  const modal = document.getElementById('app-modal');
  if (modal) modal.remove();
}

// ========================
// Toast Notification
// ========================
function showToast(message, type = 'info') {
  const existing = document.getElementById('app-toast');
  if (existing) existing.remove();

  const colorMap = {
    success: 'var(--success)',
    error: 'var(--error)',
    warning: 'var(--warning)',
    info: 'var(--accent-primary)'
  };

  const toast = document.createElement('div');
  toast.id = 'app-toast';
  toast.style.cssText = `
    position: fixed; top: calc(var(--safe-top, 0px) + 16px); left: 50%; transform: translateX(-50%);
    background: var(--bg-card); border: 1px solid ${colorMap[type]};
    color: var(--text-primary); padding: 12px 20px; border-radius: var(--radius-md);
    font-size: var(--font-sm); font-family: var(--font-family); z-index: 300;
    box-shadow: var(--shadow-lg); animation: fadeInUp 0.3s ease;
    max-width: 90%; text-align: center;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

// ========================
// Load Settings
// ========================
async function loadSettings() {
  try {
    AppState.settings = await api('/settings');
  } catch (e) {
    console.error('Failed to load settings:', e);
  }
}

// ========================
// PWA Service Worker Registration
// ========================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.getRegistrations().then(registrations => {
      for (let reg of registrations) {
        reg.unregister().then(() => console.log('SW unregistered:', reg.scope));
      }
    });
  });
}

// ========================
// App Init
// ========================
window.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  
  // Focus PIN input when clicking on dots
  const pinDots = document.getElementById('pin-dots');
  const pinInput = document.getElementById('pin-input');
  if (pinDots && pinInput) {
    pinDots.addEventListener('click', () => pinInput.focus());
    pinInput.addEventListener('input', updatePinDots);
    pinInput.addEventListener('keyup', updatePinDots);
    pinInput.addEventListener('keydown', updatePinDots);
    pinInput.addEventListener('focus', updatePinDots);
  }

  // Global key listener for PIN input
  window.addEventListener('keydown', (e) => {
    const loginScreen = document.getElementById('login-screen');
    const isModalOpen = document.querySelector('.modal.active') || document.getElementById('app-modal');
    
    if (loginScreen && loginScreen.classList.contains('active') && !isModalOpen) {
      const activeEl = document.activeElement;
      const isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'SELECT' || activeEl.tagName === 'TEXTAREA');
      
      // If it's a digit and no other input is focused
      if (/^\d$/.test(e.key) && !isInput) {
        if (pinInput) pinInput.focus();
      }
    }
  });
});

function updatePinDots() {
  const input = document.getElementById('pin-input');
  const dots = document.querySelectorAll('.pin-dot');
  const len = input.value.length;
  dots.forEach((dot, i) => {
    dot.classList.toggle('filled', i < len);
  });
}

/**
 * Driver Payment — Auth Module
 * 로그인/로그아웃/등록 처리
 */

let selectedRole = 'employer';

// 초기 로딩 시 사용자 목록 가져오기 및 저장된 상태 복원
window.addEventListener('DOMContentLoaded', async () => {
  const savedUserId = localStorage.getItem('driver_payment_userId');
  
  // Update labels for employer only
  const userLabel = document.getElementById('user-label-text');
  const pinLabel = document.getElementById('pin-label-text');
  const loginBtn = document.getElementById('login-btn');

  if (userLabel) userLabel.textContent = '고용인 선택';
  if (pinLabel) pinLabel.textContent = 'PIN 입력';
  if (loginBtn) loginBtn.querySelector('span').textContent = '로그인';

  await loadUsersForRole('employer');

  if (savedUserId) {
    const select = document.getElementById('user-select');
    if (select) select.value = savedUserId;
  }

  const userSelect = document.getElementById('user-select');
  if (userSelect) {
    userSelect.addEventListener('change', (e) => {
      localStorage.setItem('driver_payment_userId', e.target.value);
    });
  }
});

async function loadUsersForRole(role) {
  try {
    const users = await api('/employers');
    const list = document.getElementById('user-list');
    const hiddenInput = document.getElementById('user-select');
    if (!list || !hiddenInput) return;

    list.innerHTML = '';
    users.forEach(user => {
      const card = document.createElement('div');
      card.className = 'user-card';
      card.id = `user-card-${user.id}`;
      card.onclick = () => selectUser(user.id);
      
      const avatar = document.createElement('div');
      avatar.className = 'user-avatar';
      avatar.textContent = user.name.charAt(0).toUpperCase();
      
      const name = document.createElement('div');
      name.className = 'user-name';
      name.textContent = user.name;
      
      card.appendChild(avatar);
      card.appendChild(name);
      list.appendChild(card);
    });

    const savedUserId = localStorage.getItem('driver_payment_userId');
    if (savedUserId) selectUser(savedUserId);
  } catch (err) {
    console.error('Failed to load users:', err);
  }
}

function selectUser(id) {
  const hiddenInput = document.getElementById('user-select');
  if (hiddenInput) {
    hiddenInput.value = id;
    localStorage.setItem('driver_payment_userId', id);
  }

  document.querySelectorAll('.user-card').forEach(el => el.classList.remove('active'));
  const activeCard = document.getElementById(`user-card-${id}`);
  if (activeCard) activeCard.classList.add('active');

  const pinInput = document.getElementById('pin-input');
  if (pinInput) {
    pinInput.value = '';
    updatePinDots();
    setTimeout(() => pinInput.focus(), 100);
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const userId = document.getElementById('user-select').value;
  const pin = document.getElementById('pin-input').value;
  const errorEl = document.getElementById('login-error');

  if (!userId) {
    errorEl.textContent = '사용자를 선택해주세요.';
    return;
  }
  if (!pin || pin.length < 4) {
    errorEl.textContent = 'PIN 4자리를 입력해주세요.';
    return;
  }

  try {
    const data = await api('/auth/login', {
      method: 'POST',
      body: { role: 'employer', userId, pin }
    });

    if (data.success) {
      AppState.currentUser = data.user;
      AppState.currentRole = 'employer';
      
      localStorage.setItem('driver_payment_userId', userId);

      document.getElementById('employer-name').textContent = data.user.name;
      showScreen('employer-screen');
      if (data.user.driverIds && data.user.driverIds.length > 0) {
        AppState.selectedDriverId = data.user.driverIds[0];
      }
      renderEmployerDashboard();
    }
  } catch (err) {
    errorEl.textContent = '잘못된 PIN입니다.';
    const form = document.getElementById('login-form');
    if (form) {
      form.style.animation = 'none';
      form.offsetHeight; 
      form.style.animation = 'shake 0.4s ease';
    }
  }
}

function handleLogout() {
  AppState.currentUser = null;
  AppState.currentRole = null;
  AppState.selectedDriverId = null;

  const pinInput = document.getElementById('pin-input');
  if (pinInput) {
    pinInput.value = '';
    updatePinDots();
  }
  const errorEl = document.getElementById('login-error');
  if (errorEl) errorEl.textContent = '';

  showScreen('login-screen');
  loadUsersForRole('employer');
}

// Registration Logic
function showRegisterModal(role) {
  const modal = document.getElementById('register-modal');
  const title = document.getElementById('modal-title');
  const fields = document.getElementById('register-fields');
  
  if (!modal || !fields) return;

  title.textContent = role === 'employer' ? '고용인 추가' : '드라이버 추가';
  
  let html = `
    <input type="hidden" id="reg-role" value="${role}">
    <div class="form-group">
      <label class="form-label">${role === 'employer' ? '이름' : 'Name'}</label>
      <input type="text" id="reg-name" class="form-input" placeholder="${role === 'employer' ? '홍길동' : 'John Doe'}" required>
    </div>
    <div class="form-group">
      <label class="form-label">PIN (4 digits)</label>
      <input type="password" id="reg-pin" class="form-input" maxlength="4" placeholder="1234" required>
    </div>
  `;
  
  if (role === 'employer') {
    html += `
      <div class="form-group">
        <label class="form-label">이메일 (선택)</label>
        <input type="email" id="reg-email" class="form-input" placeholder="email@example.com">
      </div>
    `;
  } else {
    html += `
      <div class="form-group">
        <label class="form-label">Phone (Optional)</label>
        <input type="tel" id="reg-phone" class="form-input" placeholder="0917-xxx-xxxx">
      </div>
      <div class="form-group">
        <label class="form-label">Assign to Employer</label>
        <select id="reg-employerId" class="form-select" required>
          <option value="" disabled selected>Select Employer</option>
        </select>
      </div>
    `;
  }
  
  fields.innerHTML = html;
  modal.classList.add('active');

  // If adding driver, populate employer list
  if (role === 'driver') {
    populateEmployerSelect('reg-employerId');
  }
}

async function populateEmployerSelect(selectId) {
  try {
    const employers = await api('/employers');
    const select = document.getElementById(selectId);
    if (!select) return;
    
    employers.forEach(emp => {
      const opt = document.createElement('option');
      opt.value = emp.id;
      opt.textContent = emp.name;
      select.appendChild(opt);
    });
  } catch (err) {
    console.error('Failed to load employers for registration:', err);
  }
}

function closeAuthModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('active');
}

async function handleRegister(e) {
  e.preventDefault();
  const role = document.getElementById('reg-role').value;
  const name = document.getElementById('reg-name').value;
  const pin = document.getElementById('reg-pin').value;
  
  const body = { name, pin };
  const endpoint = role === 'employer' ? '/employers' : '/drivers';
  
  if (role === 'employer') {
    const emailEl = document.getElementById('reg-email');
    body.email = emailEl ? emailEl.value : '';
  } else {
    const phoneEl = document.getElementById('reg-phone');
    const empIdEl = document.getElementById('reg-employerId');
    body.phone = phoneEl ? phoneEl.value : '';
    body.employerId = empIdEl ? empIdEl.value : '';
  }
  
  try {
    await api(endpoint, {
      method: 'POST',
      body
    });
    showToast(role === 'employer' ? '고용인이 등록되었습니다.' : 'Driver registered successfully.', 'success');
    closeAuthModal('register-modal');
    loadUsersForRole(selectedRole); // Refresh login dropdown
  } catch (err) {
    showToast(err.message || '등록 실패', 'error');
  }
}

// Add shake animation dynamically
if (!document.getElementById('shake-style')) {
  const shakeStyle = document.createElement('style');
  shakeStyle.id = 'shake-style';
  shakeStyle.textContent = `
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      20% { transform: translateX(-8px); }
      40% { transform: translateX(8px); }
      60% { transform: translateX(-4px); }
      80% { transform: translateX(4px); }
    }
  `;
  document.head.appendChild(shakeStyle);
}

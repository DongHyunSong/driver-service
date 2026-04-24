/**
 * Driver Payment — Auth Module
 * 로그인/로그아웃/등록 처리
 */

let selectedRole = 'employer';

// 초기 로딩 시 사용자 목록 가져오기 및 저장된 상태 복원
window.addEventListener('DOMContentLoaded', async () => {
  const savedRole = localStorage.getItem('driver_payment_role') || 'employer';
  const savedUserId = localStorage.getItem('driver_payment_userId');
  
  // 역할 선택 (UI 업데이트 포함)
  await selectRole(savedRole, false); // false: 다시 저장하지 않음

  // 사용자 선택 복원
  if (savedUserId) {
    const select = document.getElementById('user-select');
    if (select) {
      select.value = savedUserId;
    }
  }

  // 사용자 선택 변경 시 저장
  const userSelect = document.getElementById('user-select');
  if (userSelect) {
    userSelect.addEventListener('change', (e) => {
      localStorage.setItem('driver_payment_userId', e.target.value);
    });
  }
});

async function loadUsersForRole(role) {
  try {
    const endpoint = role === 'employer' ? '/employers' : '/drivers';
    const users = await api(endpoint);
    const select = document.getElementById('user-select');
    
    if (!select) return;

    // Clear existing options except the first one
    select.innerHTML = `<option value="" disabled selected>${role === 'employer' ? '사용자를 선택하세요' : 'Select User'}</option>`;
    
    users.forEach(user => {
      const opt = document.createElement('option');
      opt.value = user.id;
      opt.textContent = user.name;
      select.appendChild(opt);
    });

    // 데이터가 로드된 후 저장된 ID가 있으면 다시 적용
    const savedUserId = localStorage.getItem('driver_payment_userId');
    if (savedUserId) {
      select.value = savedUserId;
    }
  } catch (err) {
    console.error('Failed to load users:', err);
  }
}

async function selectRole(role, shouldSave = true) {
  selectedRole = role;
  if (shouldSave) {
    localStorage.setItem('driver_payment_role', role);
  }

  document.querySelectorAll('.role-btn').forEach(btn => btn.classList.remove('active'));
  const roleBtn = document.getElementById(`role-${role}`);
  if (roleBtn) roleBtn.classList.add('active');

  // Update labels
  const userLabel = document.getElementById('user-label-text');
  const pinLabel = document.getElementById('pin-label-text');
  const loginBtn = document.getElementById('login-btn');

  if (role === 'employer') {
    if (userLabel) userLabel.textContent = '고용인 선택';
    if (pinLabel) pinLabel.textContent = 'PIN 입력';
    if (loginBtn) loginBtn.querySelector('span').textContent = '로그인';
  } else {
    if (userLabel) userLabel.textContent = 'Select Driver';
    if (pinLabel) pinLabel.textContent = 'Enter PIN';
    if (loginBtn) loginBtn.querySelector('span').textContent = 'Login';
  }

  // Load users for the selected role
  await loadUsersForRole(role);

  // Clear previous input
  const pinInput = document.getElementById('pin-input');
  if (pinInput) {
    pinInput.value = '';
    updatePinDots();
  }
  const errorEl = document.getElementById('login-error');
  if (errorEl) errorEl.textContent = '';
}

async function handleLogin(e) {
  e.preventDefault();
  const userId = document.getElementById('user-select').value;
  const pin = document.getElementById('pin-input').value;
  const errorEl = document.getElementById('login-error');

  if (!userId) {
    errorEl.textContent = selectedRole === 'employer' ? '사용자를 선택해주세요.' : 'Please select a user.';
    return;
  }

  if (!pin || pin.length < 4) {
    errorEl.textContent = selectedRole === 'employer' ? 'PIN 4자리를 입력해주세요.' : 'Please enter 4-digit PIN.';
    return;
  }

  try {
    const data = await api('/auth/login', {
      method: 'POST',
      body: { role: selectedRole, userId, pin }
    });

    if (data.success) {
      AppState.currentUser = data.user;
      AppState.currentRole = data.role;
      
      // 로그인 성공 시 정보 저장
      localStorage.setItem('driver_payment_role', selectedRole);
      localStorage.setItem('driver_payment_userId', userId);

      if (data.role === 'employer') {
        document.getElementById('employer-name').textContent = data.user.name;
        showScreen('employer-screen');
        if (data.user.driverIds && data.user.driverIds.length > 0) {
          AppState.selectedDriverId = data.user.driverIds[0];
        }
        renderEmployerDashboard();
      } else {
        document.getElementById('driver-name').textContent = data.user.name;
        showScreen('driver-screen');
        renderDriverSalary();
      }
    }
  } catch (err) {
    errorEl.textContent = selectedRole === 'employer' ? '잘못된 PIN입니다.' : 'Invalid PIN.';
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

  // Clear inputs but KEEP the role/user selection
  const pinInput = document.getElementById('pin-input');
  if (pinInput) {
    pinInput.value = '';
    updatePinDots();
  }
  const errorEl = document.getElementById('login-error');
  if (errorEl) errorEl.textContent = '';

  showScreen('login-screen');
  loadUsersForRole(selectedRole);
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

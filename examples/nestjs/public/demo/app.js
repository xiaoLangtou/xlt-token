/** @type {Record<string, { username: string; password: string }>} */
const ACCOUNTS = {
  admin: { username: 'admin', password: 'admin123' },
  user: { username: 'user', password: 'user123' },
};

const state = {
  token: localStorage.getItem('xlt_demo_token') || '',
  loginId: localStorage.getItem('xlt_demo_loginId') || '',
  pcToken: localStorage.getItem('xlt_demo_pc') || '',
  appToken: localStorage.getItem('xlt_demo_app') || '',
  tempToken: '',
  safeOpen: false,
};

const $ = (sel) => document.querySelector(sel);

function persist() {
  localStorage.setItem('xlt_demo_token', state.token);
  localStorage.setItem('xlt_demo_loginId', state.loginId);
  localStorage.setItem('xlt_demo_pc', state.pcToken);
  localStorage.setItem('xlt_demo_app', state.appToken);
}

function shortToken(t) {
  if (!t) return '—';
  return t.length > 16 ? `${t.slice(0, 8)}…${t.slice(-4)}` : t;
}

function updateUI() {
  const status = $('#authStatus');
  const dot = status.querySelector('.dot');
  const label = status.querySelector('span:last-child');
  const preview = $('#tokenPreview');
  const logoutBtn = $('#logoutBtn');

  if (state.token) {
    dot.className = 'dot online';
    label.textContent = `已登录 · ${state.loginId}`;
    preview.hidden = false;
    $('#tokenShort').textContent = shortToken(state.token);
    logoutBtn.disabled = false;
  } else {
    dot.className = 'dot offline';
    label.textContent = '未登录';
    preview.hidden = true;
    logoutBtn.disabled = true;
  }

  $('#pcToken').textContent = shortToken(state.pcToken);
  $('#appToken').textContent = shortToken(state.appToken);

  $('#tempTokenDisplay').textContent = state.tempToken ? shortToken(state.tempToken) : '尚未创建';
  $('#tempConsumeBtn').disabled = !state.tempToken;

  updateSafeSteps();
}

function updateSafeSteps() {
  $('#safeStep1').className = state.safeOpen ? 'step done' : 'step';
  $('#safeStep2').className = state.safeOpen ? 'step active' : 'step';
  $('#safeStep3').className = 'step';
}

function addLog(method, path, status, body, err) {
  const list = $('#logList');
  const empty = list.querySelector('.log-empty');
  if (empty) empty.remove();

  const entry = document.createElement('div');
  entry.className = 'log-entry';

  const statusClass = status >= 200 && status < 300 ? 'ok' : status === 401 || status === 403 ? 'warn' : 'err';
  const time = new Date().toLocaleTimeString('zh-CN', { hour12: false });

  let bodyText = '';
  try {
    bodyText = typeof body === 'string' ? body : JSON.stringify(body, null, 2);
  } catch {
    bodyText = String(body);
  }
  if (err) bodyText = err.message || String(err);

  entry.innerHTML = `
    <div class="meta">
      <span class="log-time">${time}</span>
      <span class="method ${method.toLowerCase()}">${method}</span>
      <span class="status ${statusClass}">${status || 'ERR'}</span>
    </div>
    <div class="log-path">${path}</div>
    <pre class="log-body">${escapeHtml(bodyText)}</pre>
  `;

  list.prepend(entry);
}

function escapeHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function api(method, path, { body, token, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  const useToken = token ?? state.token;
  if (auth && useToken) headers.Authorization = `Bearer ${useToken}`;

  const opts = { method, headers };
  if (body !== undefined) opts.body = JSON.stringify(body);

  try {
    const res = await fetch(path, opts);
    let data;
    const text = await res.text();
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }
    addLog(method, path, res.status, data);
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    addLog(method, path, 0, null, e);
    return { ok: false, status: 0, data: null, error: e };
  }
}

async function loginAs(kind) {
  const acc = ACCOUNTS[kind];
  if (!acc) return;
  const { ok, data } = await api('POST', '/auth/login', {
    body: { username: acc.username, password: acc.password },
    auth: false,
  });
  if (ok && data?.token) {
    state.token = data.token;
    state.loginId = data.loginId;
    persist();
    updateUI();
  }
}

async function customLogin() {
  const username = $('#loginUser').value;
  const password = $('#loginPass').value;
  const device = $('#loginDevice').value || 'default';
  const { ok, data } = await api('POST', '/auth/login', {
    body: { username, password, device },
    auth: false,
  });
  if (ok && data?.token) {
    state.token = data.token;
    state.loginId = data.loginId;
    persist();
    updateUI();
  }
}

const actions = {
  customLogin,
  async me() { await api('GET', '/auth/me'); },
  async renew() { await api('POST', '/auth/renew'); },
  async logout() {
    await api('POST', '/auth/logout');
    state.token = '';
    state.loginId = '';
    state.safeOpen = false;
    persist();
    updateUI();
  },
  async health() { await api('GET', '/public/health', { auth: false }); },
  async product() {
    const id = $('#productId').value || '42';
    const withAuth = $('#productWithAuth').checked;
    await api('GET', `/public/product/${id}`, { auth: withAuth });
  },
  async permRead() { await api('GET', '/permission/read'); },
  async permDelete() { await api('GET', '/permission/delete'); },
  async permOrder() { await api('GET', '/permission/order-create'); },
  async roleAdmin() { await api('GET', '/role/admin-only'); },
  async roleAdminOr() { await api('GET', '/role/admin-or-super'); },
  async safeTransfer() {
    await api('POST', '/safe/transfer', { body: { amount: 100, to: 'alice' } });
  },
  async safeOpen() {
    const { ok } = await api('POST', '/safe/open', { body: { business: 'pay', timeout: 300 } });
    if (ok) state.safeOpen = true;
    updateSafeSteps();
  },
  async safeClose() {
    const { ok } = await api('POST', '/safe/close', { body: { business: 'pay' } });
    if (ok) state.safeOpen = false;
    updateSafeSteps();
  },
  async deviceLoginPc() {
    const { ok, data } = await api('POST', '/device/login', {
      body: { loginId: '1001', device: 'pc' },
      auth: false,
    });
    if (ok && data?.token) {
      state.pcToken = data.token;
      persist();
      updateUI();
    }
  },
  async deviceLoginApp() {
    const { ok, data } = await api('POST', '/device/login', {
      body: { loginId: '1001', device: 'app' },
      auth: false,
    });
    if (ok && data?.token) {
      state.appToken = data.token;
      persist();
      updateUI();
    }
  },
  async deviceMePc() { await api('GET', '/device/me', { token: state.pcToken }); },
  async deviceMeApp() { await api('GET', '/device/me', { token: state.appToken }); },
  async deviceList() { await api('GET', '/device/list'); },
  async kickoutPc() {
    await api('POST', '/device/kickout-by-device', {
      body: { loginId: '1001', device: 'pc' },
    });
  },
  async onlineCount() { await api('GET', '/session/online-count'); },
  async onlineIds() { await api('GET', '/session/online-ids'); },
  async kickoutUser() {
    await api('POST', '/session/kickout', { body: { loginId: '1002' } });
  },
  async loginReplace() {
    await api('POST', '/session/login-replace', { body: { loginId: '1001' }, auth: false });
  },
  async profileMe() { await api('GET', '/profile/me'); },
  async adminHooks() { await api('GET', '/admin/hooks'); },
  async adminDashboard() { await api('GET', '/admin/dashboard'); },
  async tempCreate() {
    const { ok, data } = await api('POST', '/temp-token/create', {
      body: { userId: '1001' },
      auth: false,
    });
    if (ok && data?.tempToken) {
      state.tempToken = data.tempToken;
      updateUI();
    }
  },
  async tempConsume() {
    await api('POST', '/temp-token/consume', {
      body: { tempToken: state.tempToken, newPassword: 'newpass' },
      auth: false,
    });
    state.tempToken = '';
    updateUI();
  },
};

document.addEventListener('click', (e) => {
  const loginBtn = e.target.closest('[data-login]');
  if (loginBtn) {
    loginAs(loginBtn.dataset.login);
    return;
  }

  const actionBtn = e.target.closest('[data-action]');
  if (actionBtn) {
    const fn = actions[actionBtn.dataset.action];
    if (fn) fn();
    return;
  }
});

$('#logoutBtn').addEventListener('click', () => actions.logout());
$('#copyToken').addEventListener('click', () => {
  if (state.token) navigator.clipboard.writeText(state.token);
});
$('#clearLog').addEventListener('click', () => {
  $('#logList').innerHTML = '<div class="log-empty">点击左侧按钮发起请求，响应将显示在这里</div>';
});

// Sidebar scroll spy
const sections = document.querySelectorAll('.section');
const navItems = document.querySelectorAll('.nav-item');

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        navItems.forEach((n) => n.classList.toggle('active', n.getAttribute('href') === `#${id}`));
      }
    });
  },
  { rootMargin: '-20% 0px -60% 0px' },
);

sections.forEach((s) => observer.observe(s));

updateUI();

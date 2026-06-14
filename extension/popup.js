// popup.js

const IS_DEV   = false;
const BASE_URL = 'https://app.preciprocal.com';

function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

const ICON_URL = chrome.runtime.getURL('icons/icon48.png');

let authState = { authenticated: false, user: null, loading: true };

document.addEventListener('DOMContentLoaded', async () => {
  await checkAuthStatus();
  render();
});

// Re-render popup live if auth changes while popup is open
// (e.g. user logs in on the app tab while popup is open)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !changes.preciprocal_auth) return;
  const { newValue } = changes.preciprocal_auth;
  if (newValue?.uid && newValue?.token) {
    setAuthenticated(newValue);
  } else {
    authState.authenticated = false;
    authState.user = null;
  }
  authState.loading = false;
  render();
});

async function checkAuthStatus() {
  try {
    const result = await chrome.storage.local.get(['preciprocal_auth']);
    const stored = result?.preciprocal_auth;
    if (stored?.uid && stored?.token) { setAuthenticated(stored); return; }

    authState.loading = true;
    render();

    const response = await chrome.runtime.sendMessage({ type: 'SYNC_AUTH' });
    if (response?.success) {
      const fresh = await chrome.storage.local.get(['preciprocal_auth']);
      if (fresh?.preciprocal_auth?.uid) { setAuthenticated(fresh.preciprocal_auth); return; }
    }
    authState.authenticated = false;
    authState.user = null;
  } catch {
    authState.authenticated = false;
    authState.user = null;
  } finally {
    authState.loading = false;
  }
}

function setAuthenticated(stored) {
  authState.authenticated = true;
  authState.user = {
    uid:              stored.uid,
    email:            stored.email       || '',
    displayName:      stored.displayName || (stored.email ? stored.email.split('@')[0] : 'User'),
    photoURL:         stored.photoURL    || '',
    subscriptionTier: stored.subscriptionTier || 'free',
  };
}

function openApp(path) {
  chrome.tabs.create({ url: `${BASE_URL}${path || '/'}` });
  window.close();
}

async function logout() {
  await chrome.storage.local.remove(['preciprocal_auth']);
  chrome.runtime.sendMessage({ type: 'CLEAR_AUTH' }).catch(() => {});
  authState.authenticated = false;
  authState.user = null;
  render();
}

function on(id, fn) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', fn);
}

function render() {
  const c = document.getElementById('authContainer');
  if (!c) return;
  if (authState.loading) {
    c.innerHTML = renderLoading();
  } else if (authState.authenticated && authState.user) {
    c.innerHTML = renderConnected();
    // Set user data via textContent to prevent XSS
    const u = authState.user;
    const init = (u.displayName || u.email || 'U').charAt(0).toUpperCase();
    const nameEl  = document.getElementById('uName');
    const emailEl = document.getElementById('uEmail');
    const avImg   = document.getElementById('avImg');
    if (nameEl)  nameEl.textContent  = u.displayName || 'User';
    if (emailEl) emailEl.textContent = u.email || '';
    if (avImg) avImg.addEventListener('error', () => {
      const avEl = document.getElementById('avEl');
      if (avEl) avEl.textContent = init;
    });
  } else {
    c.innerHTML = renderDisconnected();
  }
  bindEvents();
}

function bindEvents() {
  on('btnLogin',  () => openApp('/sign-in'));
  on('btnDash',   () => openApp('/'));
  on('btnLogout', () => logout());
  on('btnPasteToken', () => connectWithToken());
}

async function connectWithToken() {
  const input = document.getElementById('tokenInput');
  const errEl = document.getElementById('tokenError');
  const btn   = document.getElementById('btnPasteToken');
  if (!input || !errEl || !btn) return;

  const raw = input.value.trim();
  if (!raw) { showTokenError(errEl, 'Please paste your token first.'); return; }

  btn.textContent = '…';
  btn.disabled = true;
  errEl.style.display = 'none';

  try {
    // Detect old UUID format (xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx)
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(raw)) {
      throw new Error('This is an old-format token. Hard-refresh the Settings page (Ctrl+Shift+R), then Generate Token again.');
    }
    // Token is raw JSON — parse directly
    const payload = JSON.parse(raw);
    if (!payload?.uid || !payload?.token) throw new Error('Invalid token format.');

    await chrome.runtime.sendMessage({
      type:        'SAVE_AUTH',
      uid:         payload.uid,
      email:       payload.email        || '',
      displayName: payload.displayName  || '',
      photoURL:    payload.photoURL      || '',
      token:       payload.token,
    });

    // Re-read storage and re-render as connected
    const fresh = await chrome.storage.local.get(['preciprocal_auth']);
    if (fresh?.preciprocal_auth?.uid) {
      setAuthenticated(fresh.preciprocal_auth);
      authState.loading = false;
      render();
    } else {
      throw new Error('Token saved but could not verify. Try again.');
    }
  } catch (e) {
    showTokenError(errEl, e?.message || 'Invalid token. Copy from Settings → Extension.');
    btn.textContent = 'Connect';
    btn.disabled = false;
  }
}

function showTokenError(el, msg) {
  el.textContent = msg;
  el.style.display = 'block';
}

function header(connected) {
  return `
    <div class="hdr">
      <div class="hdr-brand">
        <div class="hdr-ico"><img src="${ICON_URL}" alt="Preciprocal"></div>
        <span class="hdr-name">Preciprocal</span>
      </div>
      ${connected
        ? `<div class="pill on"><div class="dot pulse"></div>Connected</div>`
        : `<div class="pill off"><div class="dot"></div>Not connected</div>`
      }
    </div>`;
}

function renderLoading() {
  return `
    ${header(false)}
    <div class="loading">
      <div class="spin-ring"></div>
      <p>Connecting…</p>
    </div>`;
}

function renderConnected() {
  const u    = authState.user;
  const init = (u.displayName || u.email || 'U').charAt(0).toUpperCase();
  const tier = u.subscriptionTier || 'free';
  const tLbl = tier.charAt(0).toUpperCase() + tier.slice(1);
  const tCls = (tier === 'pro' || tier === 'premium') ? 'pro' : '';

  const avatarInner = u.photoURL
    ? `<img id="avImg" src="${escHtml(u.photoURL)}" alt="">`
    : escHtml(init);

  return `
    ${header(true)}
    <div class="connected-wrap">
      <div class="user-card">
        <div class="av-wrap">
          <div class="av" id="avEl">${avatarInner}</div>
          <div class="av-badge"><img src="${ICON_URL}" alt=""></div>
        </div>
        <div class="u-info">
          <div class="u-name" id="uName"></div>
          <div class="u-email" id="uEmail"></div>
        </div>
        <span class="tier ${tCls}">${escHtml(tLbl)}</span>
      </div>
      <button id="btnDash" class="btn-main">Open Dashboard</button>
      <button id="btnLogout" class="btn-danger">Disconnect account</button>
    </div>`;
}

function renderDisconnected() {
  return `
    ${header(false)}
    <div class="hero">
      <div class="hero-logo"><img src="${ICON_URL}" alt="Preciprocal"></div>
      <div class="hero-eyebrow">Welcome to Preciprocal</div>
      <h2 class="hero-h">Land your next<br>job, faster.</h2>
      <p class="hero-sub">Auto-fill applications, optimize your resume,<br>and ace every interview.</p>
    </div>
    <div class="fc-list">
      <div class="fc-row">
        <div class="fc-ico i1">⚡</div>
        <div class="fc-body">
          <div class="fc-title">1-click Auto Apply</div>
          <div class="fc-desc">Fill any application form instantly with one click</div>
        </div>
      </div>
      <div class="fc-row">
        <div class="fc-ico i2">📄</div>
        <div class="fc-body">
          <div class="fc-title">Resume &amp; ATS Optimizer</div>
          <div class="fc-desc">Get a tailored score and improvement suggestions</div>
        </div>
      </div>
      <div class="fc-row">
        <div class="fc-ico i3">🎯</div>
        <div class="fc-body">
          <div class="fc-title">AI Mock Interviews</div>
          <div class="fc-desc">Practice with real-time AI feedback and coaching</div>
        </div>
      </div>
    </div>
    <div class="si-block">
      <button id="btnLogin" class="btn-si">Get Started - It's Free</button>
      <div class="how-box">
        <div class="how-lbl">How to connect</div>
        <ol>
          <li>Click above and sign in to Preciprocal</li>
          <li>Come back and open this extension</li>
          <li>You'll be connected automatically</li>
        </ol>
      </div>
      <div class="token-box">
        <div class="token-lbl">Having trouble? Paste your token</div>
        <div class="token-row">
          <input id="tokenInput" class="token-input" type="password" placeholder="Paste token from Settings → Extension" autocomplete="off" spellcheck="false" />
          <button id="btnPasteToken" class="btn-token">Connect</button>
        </div>
        <div id="tokenError" class="token-error" style="display:none;"></div>
      </div>
    </div>`;
}
// popup.js

const IS_DEV   = false;
const BASE_URL = IS_DEV ? 'http://localhost:3000' : 'https://preciprocal.com';

const ICON_URL = chrome.runtime.getURL('icons/icon48.png');

let authState = { authenticated: false, user: null, loading: true };

document.addEventListener('DOMContentLoaded', async () => {
  await checkAuthStatus();
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
  } else {
    c.innerHTML = renderDisconnected();
  }
  bindEvents();
}

function bindEvents() {
  on('btnLogin',  () => openApp('/sign-in'));
  on('btnDash',   () => openApp('/'));
  on('btnLogout', () => logout());
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
    ? `<img src="${u.photoURL}" alt="${u.displayName}" onerror="this.style.display='none';this.parentElement.textContent='${init}'">`
    : init;

  return `
    ${header(true)}
    <div class="connected-wrap">
      <div class="user-card">
        <div class="av-wrap">
          <div class="av">${avatarInner}</div>
          <div class="av-badge"><img src="${ICON_URL}" alt=""></div>
        </div>
        <div class="u-info">
          <div class="u-name">${u.displayName || 'User'}</div>
          <div class="u-email">${u.email || ''}</div>
        </div>
        <span class="tier ${tCls}">${tLbl}</span>
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
          <div class="fc-desc">Fill any application form instantly using your saved profile</div>
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
      <button id="btnLogin" class="btn-si">Get Started — It's Free</button>
      <div class="how-box">
        <div class="how-lbl">How to connect</div>
        <ol>
          <li>Click above and sign in to Preciprocal</li>
          <li>Come back and open this extension</li>
          <li>You'll be connected automatically</li>
        </ol>
      </div>
    </div>`;
}
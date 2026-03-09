// popup.js

const IS_DEV   = false;
const BASE_URL = IS_DEV ? 'http://localhost:3000' : 'https://preciprocal.com';

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

function addClick(id, fn) {
  const el = document.getElementById(id);
  if (el) el.addEventListener('click', fn);
}

function render() {
  const container = document.getElementById('authContainer');
  if (!container) return;
  if (authState.loading) {
    container.innerHTML = renderLoading();
  } else if (authState.authenticated && authState.user) {
    container.innerHTML = renderConnected();
  } else {
    container.innerHTML = renderDisconnected();
  }
  attachListeners();
}

function attachListeners() {
  addClick('loginBtn',           () => openApp('/sign-in'));
  addClick('openDashboardBtn',   () => openApp('/'));
  addClick('logoutBtn',          () => logout());
  addClick('resumeOptimizerBtn', () => openApp('/resume'));
  addClick('coverLetterBtn',     () => openApp('/cover-letter'));
  addClick('mockInterviewBtn',   () => openApp('/interview'));
}

const LOGO_SVG = `<svg viewBox="0 0 64 64" fill="none">
  <path d="M32 16L48 32L32 48L16 32L32 16Z" fill="white" opacity="0.85"/>
  <path d="M32 24L40 32L32 40L24 32L32 24Z" fill="white"/>
</svg>`;

function headerHTML(connected) {
  return `
    <div class="header">
      <div class="brand">
        <div class="brand-icon">${LOGO_SVG}</div>
        <span class="brand-name">Preciprocal</span>
      </div>
      ${connected
        ? `<div class="status-pill connected"><div class="status-dot pulse"></div>Connected</div>`
        : `<div class="status-pill disconnected"><div class="status-dot"></div>Not connected</div>`
      }
    </div>`;
}

function renderLoading() {
  return `
    ${headerHTML(false)}
    <div class="loading-view">
      <div class="spinner"></div>
      <p>Connecting...</p>
    </div>`;
}

function renderConnected() {
  const user    = authState.user;
  const initial = (user.displayName || user.email || 'U').charAt(0).toUpperCase();
  const tier    = user.subscriptionTier || 'free';
  const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
  const tierClass = (tier === 'pro' || tier === 'premium') ? 'pro' : '';

  // Show photo if available, otherwise show initial
  const avatarInner = user.photoURL
    ? `<img src="${user.photoURL}" alt="${user.displayName}" onerror="this.style.display='none';this.parentElement.textContent='${initial}'" />`
    : initial;

  return `
    ${headerHTML(true)}

    <div class="user-section">
      <div class="user-card">
        <div class="avatar-wrap">
          <div class="avatar">${avatarInner}</div>
          <div class="avatar-logo">${LOGO_SVG}</div>
        </div>
        <div class="user-info">
          <span class="user-name">${user.displayName || 'User'}</span>
          <span class="user-email">${user.email || ''}</span>
        </div>
        <span class="tier-badge ${tierClass}">${tierLabel}</span>
      </div>
    </div>

    <div class="section-label">Quick Access</div>

    <div class="feature-list">
      <button id="resumeOptimizerBtn" class="feature-btn">
        <div class="feat-icon-wrap">📄</div>
        <div class="feat-content">
          <span class="feat-title">Resume Optimizer</span>
          <span class="feat-desc">ATS score &amp; AI suggestions</span>
        </div>
        <span class="feat-arrow">›</span>
      </button>
      <button id="coverLetterBtn" class="feature-btn">
        <div class="feat-icon-wrap">✉️</div>
        <div class="feat-content">
          <span class="feat-title">Cover Letter</span>
          <span class="feat-desc">Tailored to any job posting</span>
        </div>
        <span class="feat-arrow">›</span>
      </button>
      <button id="mockInterviewBtn" class="feature-btn">
        <div class="feat-icon-wrap">🎯</div>
        <div class="feat-content">
          <span class="feat-title">Mock Interview</span>
          <span class="feat-desc">AI-powered practice sessions</span>
        </div>
        <span class="feat-arrow">›</span>
      </button>
    </div>

    <div class="actions">
      <button id="openDashboardBtn" class="btn-primary">Open Dashboard</button>
      <button id="logoutBtn" class="btn-ghost">Disconnect account</button>
    </div>`;
}

function renderDisconnected() {
  return `
    ${headerHTML(false)}

    <div class="hero">
      <div class="hero-icon">${LOGO_SVG}</div>
      <h2>Your AI Career Assistant</h2>
      <p>Auto-apply to jobs, optimize your resume,<br>and ace every interview.</p>
    </div>

    <div class="features-grid">
      <div class="feat-card">
        <span class="feat-icon">📊</span>
        <span class="feat-card-title">ATS Score</span>
        <span class="feat-card-desc">Resume check</span>
      </div>
      <div class="feat-card">
        <span class="feat-icon">⚡</span>
        <span class="feat-card-title">Auto Apply</span>
        <span class="feat-card-desc">1-click apply</span>
      </div>
      <div class="feat-card">
        <span class="feat-icon">🎯</span>
        <span class="feat-card-title">Interview</span>
        <span class="feat-card-desc">AI practice</span>
      </div>
    </div>

    <div class="signin-section">
      <button id="loginBtn" class="btn-signin">Sign in to Preciprocal</button>
      <div class="how-to">
        <p class="how-to-title">How to connect</p>
        <ol>
          <li>Click above and sign in to Preciprocal</li>
          <li>Come back and open the extension</li>
          <li>You'll be connected automatically</li>
        </ol>
      </div>
    </div>`;
}
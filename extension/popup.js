// popup.js

const IS_DEV   = true;
const BASE_URL = IS_DEV ? 'http://localhost:3000' : 'https://preciprocal.com';

let authState = {
  authenticated: false,
  user:          null,
  loading:       true,
};

// ─────────────────────────────────────────────────────────────────
// Boot
// ─────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  await checkAuthStatus();
  render();
});

// ─────────────────────────────────────────────────────────────────
// Auth check
// 1. Read chrome.storage.local (fastest — set by background on tab load)
// 2. If empty, ask background to sync from open preciprocal tab now
// ─────────────────────────────────────────────────────────────────
async function checkAuthStatus() {
  try {
    const result = await chrome.storage.local.get(['preciprocal_auth']);
    const stored = result?.preciprocal_auth;

    if (stored?.uid && stored?.token) {
      setAuthenticated(stored);
      return;
    }

    // Nothing in storage — try syncing from an open preciprocal tab
    authState.loading = true;
    render(); // show spinner while syncing

    const response = await chrome.runtime.sendMessage({ type: 'SYNC_AUTH' });
    if (response?.success && response?.user) {
      // Re-read storage after sync
      const fresh = await chrome.storage.local.get(['preciprocal_auth']);
      if (fresh?.preciprocal_auth?.uid) {
        setAuthenticated(fresh.preciprocal_auth);
        return;
      }
    }

    // Still nothing
    authState.authenticated = false;
    authState.user          = null;

  } catch (err) {
    console.error('[Popup] Auth check failed:', err);
    authState.authenticated = false;
    authState.user          = null;
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
    subscriptionTier: stored.subscriptionTier || 'free',
  };
}

// ─────────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────────
function openApp(path) {
  chrome.tabs.create({ url: `${BASE_URL}${path || '/'}` });
  window.close();
}

async function logout() {
  await chrome.storage.local.remove(['preciprocal_auth']);
  chrome.runtime.sendMessage({ type: 'CLEAR_AUTH' }).catch(() => {});
  authState.authenticated = false;
  authState.user          = null;
  render();
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────
function addClick(id, fn) {
  const el = document.getElementById(id);
  if (el) {
    el.addEventListener('click', fn);
  }
}

// ─────────────────────────────────────────────────────────────────
// Render
// ─────────────────────────────────────────────────────────────────
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
  addClick('loginBtn',           function () { openApp('/sign-in');      });
  addClick('openDashboardBtn',   function () { openApp('/');             });
  addClick('logoutBtn',          function () { logout();                 });
  addClick('resumeOptimizerBtn', function () { openApp('/resume');       });
  addClick('coverLetterBtn',     function () { openApp('/cover-letter'); });
  addClick('mockInterviewBtn',   function () { openApp('/interview');    });
}

// ─────────────────────────────────────────────────────────────────
// Views
// ─────────────────────────────────────────────────────────────────
function renderLoading() {
  return `
    <div class="loading-view">
      <div class="spinner"></div>
      <p>Checking connection...</p>
    </div>
  `;
}

function renderConnected() {
  const user    = authState.user;
  const initial = (user.displayName || user.email || 'U').charAt(0).toUpperCase();
  const badge   = getTierBadge(user.subscriptionTier);

  return `
    <div class="authenticated">
      <div class="user-info">
        <div class="avatar">${initial}</div>
        <div class="user-details">
          <p class="user-name">${user.displayName || 'User'}</p>
          <p class="user-email">${user.email || ''}</p>
        </div>
      </div>

      <div class="status-indicator">
        <div class="status-dot"></div>
        <span>Connected to Preciprocal &nbsp;·&nbsp; ${badge.icon} ${badge.text}</span>
      </div>

      <div class="feature-list">
        <button id="resumeOptimizerBtn" class="feature-btn">
          <div class="feature-icon">📄</div>
          <div class="feature-content">
            <span class="feature-title">Resume Optimizer</span>
            <span class="feature-desc">ATS score &amp; optimization</span>
          </div>
        </button>
        <button id="coverLetterBtn" class="feature-btn">
          <div class="feature-icon">✉️</div>
          <div class="feature-content">
            <span class="feature-title">Cover Letter</span>
            <span class="feature-desc">Tailored to job posting</span>
          </div>
        </button>
        <button id="mockInterviewBtn" class="feature-btn">
          <div class="feature-icon">🎯</div>
          <div class="feature-content">
            <span class="feature-title">Mock Interview</span>
            <span class="feature-desc">AI-powered practice</span>
          </div>
        </button>
      </div>

      <div class="actions">
        <button id="openDashboardBtn" class="btn-primary">Open Dashboard</button>
        <button id="logoutBtn" class="btn-secondary">Disconnect</button>
      </div>
    </div>
  `;
}

function renderDisconnected() {
  return `
    <div class="unauthenticated">
      <div class="logo">
        <svg width="64" height="64" viewBox="0 0 64 64" fill="none">
          <rect width="64" height="64" rx="16" fill="url(#grad)"/>
          <path d="M32 20L44 32L32 44L20 32L32 20Z" fill="white" opacity="0.9"/>
          <path d="M32 26L38 32L32 38L26 32L32 26Z" fill="white"/>
          <defs>
            <linearGradient id="grad" x1="0" y1="0" x2="64" y2="64">
              <stop offset="0%" stop-color="#a855f7"/>
              <stop offset="100%" stop-color="#3b82f6"/>
            </linearGradient>
          </defs>
        </svg>
      </div>

      <h2>Welcome to Preciprocal</h2>
      <p class="description">AI Career Assistant for job seekers</p>

      <div class="features-grid">
        <div class="feature-card">
          <div class="feature-icon">📊</div>
          <div class="feature-text">
            <p class="feature-title">ATS Score</p>
            <p class="feature-desc">Check compatibility</p>
          </div>
        </div>
        <div class="feature-card">
          <div class="feature-icon">🎯</div>
          <div class="feature-text">
            <p class="feature-title">Skills Match</p>
            <p class="feature-desc">Gap analysis</p>
          </div>
        </div>
        <div class="feature-card">
          <div class="feature-icon">⚡</div>
          <div class="feature-text">
            <p class="feature-title">Instant</p>
            <p class="feature-desc">Real-time results</p>
          </div>
        </div>
      </div>

      <button id="loginBtn" class="btn-primary">Sign in to Preciprocal</button>

      <div class="connect-hint">
        <strong>How to connect</strong>
        <ol>
          <li>Click above to open Preciprocal and sign in</li>
          <li>Come back and click the extension icon</li>
          <li>You'll be connected automatically</li>
        </ol>
      </div>

      <p class="help-text">No tokens or extra steps needed</p>
    </div>
  `;
}

function getTierBadge(tier) {
  const badges = {
    free:    { icon: '🆓', text: 'Free'    },
    starter: { icon: '🚀', text: 'Starter' },
    pro:     { icon: '⭐', text: 'Pro'     },
    premium: { icon: '💎', text: 'Premium' },
  };
  return badges[tier] || badges.free;
}
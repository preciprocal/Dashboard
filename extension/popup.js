// popup.js

const IS_DEV   = false;
const BASE_URL = 'https://app.preciprocal.com';

function escHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

const ICON_URL = chrome.runtime.getURL('icons/icon48.png');

let authState = { authenticated: false, user: null, loading: true };

document.addEventListener('DOMContentLoaded', async () => {
  // Usage telemetry (background.js reportLifecycle). Never awaited: the popup
  // must open the same whether or not this lands.
  try { chrome.runtime.sendMessage({ type: 'TELEMETRY_POPUP_OPENED' }).catch(() => {}); } catch { /* non-fatal */ }
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
  on('lnkJobs',    () => openApp('/jobs'));
  on('lnkTracker', () => openApp('/job-tracker'));
  on('lnkResume',  () => openApp('/resume'));
  on('lnkSetup',   () => openApp('/settings?section=job-setup'));
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
    // Token is raw JSON; parse it directly
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
    showTokenError(errEl, e?.message || 'That token did not work. Copy it again from Settings, Extension.');
    btn.textContent = 'Connect';
    btn.disabled = false;
  }
}

function showTokenError(el, msg) {
  el.textContent = msg;
  el.style.display = 'block';
}

const ICONS = {
  "fill": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M9 11l3 3L22 4\"/><path d=\"M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11\"/></svg>",
  "fit": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M21 12a9 9 0 1 1-9-9\"/><path d=\"M12 12l6-6\"/><circle cx=\"12\" cy=\"12\" r=\"1.5\"/></svg>",
  "track": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M3 7h18M3 12h18M3 17h12\"/></svg>",
  "jobs": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><rect x=\"3\" y=\"7\" width=\"18\" height=\"13\" rx=\"2\"/><path d=\"M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2\"/></svg>",
  "resume": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z\"/><path d=\"M14 3v6h6M8 13h8M8 17h5\"/></svg>",
  "gear": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><circle cx=\"12\" cy=\"12\" r=\"3\"/><path d=\"M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z\"/></svg>",
  "check": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M20 6 9 17l-5-5\"/></svg>",
  "arrow": "<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\"><path d=\"M7 17 17 7M7 7h10v10\"/></svg>"
};

function header(connected) {
  return `
    <div class="hdr">
      <div class="brand"><img src="${ICON_URL}" alt=""><span>Preciprocal</span></div>
      <span class="status ${connected ? 'on' : ''}"><i></i>${connected ? 'Connected' : 'Not signed in'}</span>
    </div>`;
}

function footer() {
  const v = chrome.runtime.getManifest().version;
  return `<div class="foot"><span>Version ${escHtml(v)}</span><span>LinkedIn and 50+ job sites</span></div>`;
}

function renderLoading() {
  return `
    ${header(false)}
    <div class="loading"><div class="spin"></div><p>Connecting to your account</p></div>`;
}

function renderConnected() {
  const u    = authState.user;
  const init = (u.displayName || u.email || 'U').charAt(0).toUpperCase();
  const tier = u.subscriptionTier || 'free';
  const tLbl = tier.charAt(0).toUpperCase() + tier.slice(1);
  const tCls = (tier === 'pro' || tier === 'premium') ? 'pro' : '';
  const avatarInner = u.photoURL ? `<img id="avImg" src="${escHtml(u.photoURL)}" alt="">` : escHtml(init);

  return `
    ${header(true)}
    <div class="body">
      <div class="user">
        <div class="av" id="avEl">${avatarInner}</div>
        <div class="u-info"><div class="u-name" id="uName"></div><div class="u-email" id="uEmail"></div></div>
        <span class="tier ${tCls}">${escHtml(tLbl)}</span>
      </div>
      <div class="ready">${ICONS.check}<span><b>Ready on job pages.</b> Open a job on LinkedIn or an application form to see your fit and fill it in.</span></div>
      <div class="links">
        <button class="link" id="lnkJobs">${ICONS.jobs}Jobs</button>
        <button class="link" id="lnkTracker">${ICONS.track}Job tracker</button>
        <button class="link" id="lnkResume">${ICONS.resume}Resume</button>
        <button class="link" id="lnkSetup">${ICONS.gear}Job setup</button>
      </div>
      <div class="actions">
        <button id="btnDash" class="btn btn-primary">Open Preciprocal ${ICONS.arrow.replace('<svg', '<svg width="14" height="14"')}</button>
        <button id="btnLogout" class="btn btn-ghost">Disconnect this browser</button>
      </div>
    </div>
    ${footer()}`;
}

function renderDisconnected() {
  return `
    ${header(false)}
    <div class="body">
      <h2 class="h1">Apply with a resume <span class="grad-text">made for each job</span></h2>
      <p class="sub">Works on the job pages you already use.</p>
      <div class="feats">
        <div class="feat"><span class="ico ico-a">${ICONS.fill}</span><div><b>Fills application forms</b><span>LinkedIn, Greenhouse, Workday and more. You review before you submit.</span></div></div>
        <div class="feat"><span class="ico ico-b">${ICONS.fit}</span><div><b>Shows how you fit</b><span>Skills from your resume, plus E-Verify and H‑1B records, on each job.</span></div></div>
        <div class="feat"><span class="ico ico-c">${ICONS.track}</span><div><b>Tracks what you apply to</b><span>Each application lands in your job tracker as you submit it.</span></div></div>
      </div>
      <div class="cta">
        <button id="btnLogin" class="btn btn-primary">Sign in to connect</button>
        <p class="note">Free to start. No card needed.</p>
      </div>
      <div class="steps">
        <div class="step"><em>1</em>Sign in to Preciprocal in the tab that opens</div>
        <div class="step"><em>2</em>Come back here; it connects on its own</div>
      </div>
      <details class="token">
        <summary><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="8" cy="15" r="4"/><path d="M10.8 12.2 20 3M17 6l3 3M15 8l2 2"/></svg>Not connecting? Paste a token<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg></summary>
        <div class="token-row">
          <input id="tokenInput" class="token-input" type="password" placeholder="Token from Settings, Extension" autocomplete="off" spellcheck="false" />
          <button id="btnPasteToken" class="btn-token">Connect</button>
        </div>
        <div id="tokenError" class="token-error" style="display:none;"></div>
      </details>
    </div>
    ${footer()}`;
}
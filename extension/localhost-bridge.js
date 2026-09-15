// localhost-bridge.js
// Injected into app.preciprocal.com pages. The extension is a "dumb bearer
// token holder" agnostic to which backend minted the token (Firebase or
// Supabase) — it never reads the page's session storage directly, it only
// relays whatever LayoutClient.tsx broadcasts via postMessage. Two jobs:
//   1. On load — ask the page for its current auth (PRECIPROCAL_REQUEST_AUTH)
//      so a freshly-injected content script doesn't have to wait for an auth
//      *change* event to learn the current state.
//   2. Runtime — relay PRECIPROCAL_AUTH_CHANGE postMessages from the app
//      (fired by LayoutClient on every login/logout/token refresh) to the
//      background service worker.

// ── 1. Ask the page for its current auth state ───────────────────────────────
function requestAuthFromPage() {
  window.postMessage({ type: 'PRECIPROCAL_REQUEST_AUTH' }, window.location.origin);
}

// Run immediately on injection + again after the page fully settles, in case
// the content script loads before the app's listener is mounted.
requestAuthFromPage();
window.addEventListener('load', () => setTimeout(requestAuthFromPage, 1500));

// Let the background service worker force a fresh check (e.g. the popup's
// "refresh" action, or the on-page banner checking auth on a job site tab)
// without needing to re-inject anything - just re-run the same request.
chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === 'PING_REQUEST_AUTH') requestAuthFromPage();
});

// ── 2. Relay auth state (and changes) from LayoutClient ──────────────────────
// LayoutClient fires PRECIPROCAL_AUTH_CHANGE on every Supabase auth state
// change (login/logout/account-switch/silent token refresh) and once
// immediately in response to PRECIPROCAL_REQUEST_AUTH above.
window.addEventListener('message', async (event) => {
  if (event.origin !== window.location.origin) return;

  if (event.data?.type === 'PRECIPROCAL_AUTH_CHANGE') {
    const { user } = event.data;
    try {
      if (user?.uid && user?.token) {
        await chrome.runtime.sendMessage({ type: 'SAVE_AUTH', ...user });
        console.log('[Bridge] ✅ Auth synced:', user.email);
      } else {
        await chrome.runtime.sendMessage({ type: 'CLEAR_AUTH' });
        console.log('[Bridge] 🗑️ Auth cleared');
      }
    } catch (e) {
      console.debug('[Bridge] sendMessage failed (extension inactive?):', e?.message);
    }
    return;
  }

  // ── LinkedIn job data bridge (existing) ──────────────────────────────────
  if (event.data?.type === 'GET_LINKEDIN_JOB_DATA') {
    try {
      const result = await chrome.storage.local.get(['preciprocal_linkedin_job', 'preciprocal_timestamp']);
      window.postMessage({
        type: 'LINKEDIN_JOB_DATA_RESPONSE',
        data: result.preciprocal_linkedin_job || null,
        timestamp: result.preciprocal_timestamp,
      }, window.location.origin);
    } catch (e) {
      console.error('[Bridge] LinkedIn job data error:', e);
    }
  }
});

// Auto-send LinkedIn job data to page on load if recent
(async () => {
  try {
    const result = await chrome.storage.local.get(['preciprocal_linkedin_job', 'preciprocal_timestamp']);
    if (result.preciprocal_linkedin_job) {
      const age = Date.now() - (result.preciprocal_timestamp || 0);
      if (age < 300000) {
        setTimeout(() => {
          window.postMessage({
            type: 'LINKEDIN_JOB_DATA_RESPONSE',
            data: result.preciprocal_linkedin_job,
            timestamp: result.preciprocal_timestamp,
          }, window.location.origin);
        }, 500);
      }
    }
  } catch {}
})();

console.log('[Bridge] ✅ Loaded on', window.location.pathname);

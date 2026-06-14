// localhost-bridge.js
// Injected into app.preciprocal.com pages.
// Two jobs:
//   1. On load — read Firebase auth from IndexedDB and push to background.
//      This handles the "just logged in and page loaded" case without relying
//      on postMessage timing between React useEffect and script injection.
//   2. Runtime — relay PRECIPROCAL_AUTH_CHANGE postMessages from the app
//      (fired by LayoutClient on every onAuthStateChanged) to the background.

const EXT_STORAGE_KEY = 'preciprocal_auth';

// ── 1. Read Firebase auth from IndexedDB ─────────────────────────────────────
function readFirebaseAuthFromIDB() {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open('firebaseLocalStorageDb');
      req.onerror = () => resolve(null);
      req.onupgradeneeded = (e) => { e.target.transaction.abort(); resolve(null); };
      req.onsuccess = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('firebaseLocalStorage')) {
          db.close(); resolve(null); return;
        }
        try {
          const tx    = db.transaction('firebaseLocalStorage', 'readonly');
          const store = tx.objectStore('firebaseLocalStorage');
          const all   = store.getAll();
          all.onsuccess = () => {
            db.close();
            for (const record of (all.result || [])) {
              const key = record.fbase_key || '';
              if (key.startsWith('firebase:authUser:')) {
                const u = record.value;
                if (u?.uid && u?.stsTokenManager?.accessToken) {
                  resolve({
                    uid:         u.uid,
                    email:       u.email        || '',
                    displayName: u.displayName  || '',
                    photoURL:    u.photoURL      || '',
                    token:       u.stsTokenManager.accessToken,
                  });
                  return;
                }
              }
            }
            resolve(null);
          };
          all.onerror = () => { db.close(); resolve(null); };
        } catch { db.close(); resolve(null); }
      };
    } catch { resolve(null); }
  });
}

// Also check localStorage (some Firebase configs use it instead of IDB)
function readFirebaseAuthFromLocalStorage() {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) || '';
      if (key.startsWith('firebase:authUser:')) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const u = JSON.parse(raw);
        if (u?.uid && u?.stsTokenManager?.accessToken) {
          return {
            uid:         u.uid,
            email:       u.email        || '',
            displayName: u.displayName  || '',
            photoURL:    u.photoURL      || '',
            token:       u.stsTokenManager.accessToken,
          };
        }
      }
    }
  } catch {}
  return null;
}

async function syncAuthToBackground() {
  let user = await readFirebaseAuthFromIDB();
  if (!user) user = readFirebaseAuthFromLocalStorage();

  try {
    if (user) {
      await chrome.runtime.sendMessage({ type: 'SAVE_AUTH', ...user });
      console.log('[Bridge] ✅ Auth synced on load:', user.email);
    } else {
      // No Firebase user found — page is logged out.
      // Only clear if we currently have stale auth stored.
      const stored = await chrome.runtime.sendMessage({ type: 'GET_USER' });
      if (stored?.uid) {
        await chrome.runtime.sendMessage({ type: 'CLEAR_AUTH' });
        console.log('[Bridge] 🗑️ Auth cleared — no Firebase user in page');
      }
    }
  } catch (e) {
    console.debug('[Bridge] sendMessage failed (extension inactive?):', e?.message);
  }
}

// Run immediately on injection + again after the page fully settles
syncAuthToBackground();
window.addEventListener('load', () => setTimeout(syncAuthToBackground, 1500));

// ── 2. Relay real-time auth changes from LayoutClient ────────────────────────
// LayoutClient fires PRECIPROCAL_AUTH_CHANGE on every Firebase onAuthStateChanged.
// This covers login/logout/account-switch that happen without a full page reload.
window.addEventListener('message', async (event) => {
  if (event.origin !== window.location.origin) return;

  if (event.data?.type === 'PRECIPROCAL_AUTH_CHANGE') {
    const { user } = event.data;
    try {
      if (user?.uid && user?.token) {
        await chrome.runtime.sendMessage({ type: 'SAVE_AUTH', ...user });
        console.log('[Bridge] ✅ Auth updated (postMessage):', user.email);
      } else {
        await chrome.runtime.sendMessage({ type: 'CLEAR_AUTH' });
        console.log('[Bridge] 🗑️ Auth cleared (postMessage logout)');
      }
    } catch (e) {
      console.debug('[Bridge] postMessage relay failed:', e?.message);
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

// auth-receiver.js
// Injected as a content script on preciprocal.com at document_start.
// Reads Firebase's own persisted auth from localStorage — no API calls,
// no tokens, no messaging. Just writes directly to chrome.storage.local
// so banner.js and popup.js can read it instantly.

(function () {
  const STORAGE_KEY = 'preciprocal_auth';

  function readFirebaseAuth() {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('firebase:authUser:')) {
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          const parsed = JSON.parse(raw);
          if (parsed?.uid && parsed?.stsTokenManager?.accessToken) {
            return {
              uid:   parsed.uid,
              email: parsed.email  || '',
              token: parsed.stsTokenManager.accessToken,
            };
          }
        }
      }
    } catch {
      // ignore
    }
    return null;
  }

  function syncAuth() {
    const user = readFirebaseAuth();

    if (user) {
      // Check if already up to date before writing
      chrome.storage.local.get([STORAGE_KEY], (result) => {
        const existing = result[STORAGE_KEY];
        if (existing?.uid === user.uid && existing?.token === user.token) return;

        chrome.storage.local.set({
          [STORAGE_KEY]: {
            uid:     user.uid,
            email:   user.email,
            token:   user.token,
            savedAt: Date.now(),
          }
        }, () => {
          console.log('[Preciprocal] ✅ Auth synced — user:', user.email);
        });
      });

    } else {
      // Logged out — clear stale auth
      chrome.storage.local.get([STORAGE_KEY], (result) => {
        if (result[STORAGE_KEY]) {
          chrome.storage.local.remove([STORAGE_KEY], () => {
            console.log('[Preciprocal] 🗑️ Auth cleared');
          });
        }
      });
    }
  }

  // Run as early as possible
  syncAuth();

  // Run again after DOM ready (Firebase may not have restored yet at document_start)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncAuth);
  }

  // Run again after delays — Firebase restores from IndexedDB asynchronously
  setTimeout(syncAuth, 500);
  setTimeout(syncAuth, 1500);
  setTimeout(syncAuth, 3000);

  // Watch for login/logout events in this tab
  window.addEventListener('storage', (e) => {
    if (e.key && e.key.startsWith('firebase:authUser:')) {
      syncAuth();
    }
  });

})();
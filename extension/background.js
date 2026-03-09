// background.js - Preciprocal Chrome Extension Service Worker

console.log('🚀 Preciprocal background.js loaded');

const STORAGE_KEY = 'preciprocal_auth';

// ─────────────────────────────────────────────────────────────────
// Read Firebase auth from a preciprocal.com tab via scripting API
// ─────────────────────────────────────────────────────────────────
async function readAuthFromTab(tabId) {
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        return new Promise((resolve) => {
          try {
            const req = indexedDB.open('firebaseLocalStorageDb');
            req.onerror = () => resolve(null);
            req.onsuccess = (e) => {
              const db = e.target.result;
              if (!db.objectStoreNames.contains('firebaseLocalStorage')) {
                db.close();
                resolve(null);
                return;
              }
              try {
                const tx    = db.transaction('firebaseLocalStorage', 'readonly');
                const store = tx.objectStore('firebaseLocalStorage');
                const all   = store.getAll();
                all.onsuccess = () => {
                  db.close();
                  const records = all.result || [];
                  for (const record of records) {
                    const key = record.fbase_key || '';
                    if (key.startsWith('firebase:authUser:')) {
                      const user = record.value;
                      if (user?.uid && user?.stsTokenManager?.accessToken) {
                        resolve({
                          uid:         user.uid,
                          email:       user.email       || '',
                          displayName: user.displayName || '',
                          photoURL:    user.photoURL    || '',
                          token:       user.stsTokenManager.accessToken,
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
            req.onupgradeneeded = (e) => { e.target.transaction.abort(); resolve(null); };
          } catch { resolve(null); }
        });
      },
    });
    return results?.[0]?.result || null;
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// Find any open preciprocal tab and sync auth from it
// ─────────────────────────────────────────────────────────────────
async function syncAuthFromPreciprocal() {
  const tabs = await chrome.tabs.query({
    url: ['https://preciprocal.com/*', 'http://localhost:3000/*']
  });

  for (const tab of tabs) {
    if (!tab.id) continue;
    const user = await readAuthFromTab(tab.id);
    if (user) {
      await chrome.storage.local.set({
        [STORAGE_KEY]: {
          uid:         user.uid,
          email:       user.email,
          displayName: user.displayName,
          photoURL:    user.photoURL || '',
          token:       user.token,
          savedAt:     Date.now(),
        }
      });
      console.log('[BG] ✅ Auth synced:', user.email);
      return user;
    }
  }

  console.warn('[BG] No authenticated preciprocal tab found');
  return null;
}

// ─────────────────────────────────────────────────────────────────
// Sync whenever a preciprocal tab finishes loading
// ─────────────────────────────────────────────────────────────────
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  const url = tab.url || '';
  if (!url.includes('preciprocal.com') && !url.includes('localhost:3000')) return;

  setTimeout(async () => {
    const user = await readAuthFromTab(tabId);
    if (user) {
      await chrome.storage.local.set({
        [STORAGE_KEY]: {
          uid:         user.uid,
          email:       user.email,
          displayName: user.displayName,
          photoURL:    user.photoURL || '',
          token:       user.token,
          savedAt:     Date.now(),
        }
      });
      console.log('[BG] ✅ Auto-synced on tab load:', user.email);
    }
  }, 2000);
});

// ─────────────────────────────────────────────────────────────────
// KEY FIX: Sync auth whenever ANY tab becomes active.
// This ensures storage is populated before banner.js reads it,
// even when the user navigates to LinkedIn directly.
// ─────────────────────────────────────────────────────────────────
chrome.tabs.onActivated.addListener(async () => {
  // Check if there's already valid auth in storage
  const result = await chrome.storage.local.get([STORAGE_KEY]);
  const stored = result[STORAGE_KEY];

  // Skip sync if we have fresh auth (less than 50 minutes old — tokens last 1hr)
  if (stored?.uid && stored?.savedAt && (Date.now() - stored.savedAt) < 50 * 60 * 1000) {
    return;
  }

  // No valid auth — try to sync from any open preciprocal tab
  await syncAuthFromPreciprocal();
});

// ─────────────────────────────────────────────────────────────────
// Messages from popup.js and banner.js
// ─────────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {

  if (message.type === 'CHECK_AUTH') {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      const auth = result[STORAGE_KEY];
      if (auth?.uid && auth?.token) {
        sendResponse({
          authenticated: true,
          user: { uid: auth.uid, email: auth.email, displayName: auth.displayName }
        });
      } else {
        sendResponse({ authenticated: false });
      }
    });
    return true;
  }

  if (message.type === 'GET_TOKEN') {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      sendResponse({ token: result[STORAGE_KEY]?.token || null });
    });
    return true;
  }

  if (message.type === 'GET_USER') {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      const auth = result[STORAGE_KEY];
      sendResponse({ uid: auth?.uid || null, email: auth?.email || null });
    });
    return true;
  }

  if (message.type === 'SYNC_AUTH') {
    syncAuthFromPreciprocal().then((user) => {
      sendResponse(user ? { success: true, user } : { success: false });
    });
    return true;
  }

  if (message.type === 'CLEAR_AUTH') {
    chrome.storage.local.remove([STORAGE_KEY], () => {
      console.log('[BG] 🗑️ Auth cleared');
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === 'SAVE_AUTH') {
    const { uid, email, token } = message;
    if (uid && token) {
      chrome.storage.local.set({
        [STORAGE_KEY]: { uid, email: email || '', token, savedAt: Date.now() }
      }, () => sendResponse({ success: true }));
    } else {
      sendResponse({ success: false });
    }
    return true;
  }

  // ── API PROXY — all fetch calls go through background to avoid CORS ──────
  // Requests from the service worker have origin chrome-extension://...
  // so LinkedIn's origin never appears and CORS does not apply.

  if (message.type === 'API_FETCH_AUTO_APPLY') {
    const { token, userId, email, baseUrl } = message;
    fetch(`${baseUrl}/api/extension/auto-apply`, {
      method: 'GET',
      headers: {
        'Content-Type':      'application/json',
        'x-extension-token': token   || '',
        'x-user-id':         userId  || '',
        'x-user-email':      email   || '',
      },
    })
      .then(r => r.json())
      .then(data => sendResponse({ success: true, data }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'API_FETCH_TRACK_JOB') {
    const { token, userId, email, baseUrl, jobData } = message;
    fetch(`${baseUrl}/api/extension/track-job`, {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-extension-token': token   || '',
        'x-user-id':         userId  || '',
        'x-user-email':      email   || '',
      },
      body: JSON.stringify(jobData),
    })
      .then(r => r.json())
      .then(data => sendResponse({ success: true, data }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }

  if (message.type === 'API_FETCH_ANALYZE_JOB') {
    const { token, userId, email, baseUrl, jobData } = message;
    fetch(`${baseUrl}/api/extension/analyze-job`, {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-extension-token': token   || '',
        'x-user-id':         userId  || '',
        'x-user-email':      email   || '',
      },
      body: JSON.stringify(jobData),
    })
      .then(r => r.json())
      .then(data => sendResponse({ success: true, data }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

// ─────────────────────────────────────────────────────────────────
// External messages from preciprocal.com
// ─────────────────────────────────────────────────────────────────
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  const allowed = ['https://preciprocal.com', 'http://localhost:3000'];
  if (!allowed.includes(sender.origin)) {
    sendResponse({ success: false, error: 'Unauthorized' });
    return;
  }

  if (message.type === 'SAVE_AUTH') {
    const { uid, email, token } = message;
    if (uid && token) {
      chrome.storage.local.set({
        [STORAGE_KEY]: { uid, email: email || '', token, savedAt: Date.now() }
      }, () => {
        console.log('[BG] ✅ Auth saved via external message:', email);
        sendResponse({ success: true });
      });
    } else {
      sendResponse({ success: false });
    }
    return true;
  }

  if (message.type === 'CLEAR_AUTH') {
    chrome.storage.local.remove([STORAGE_KEY], () => sendResponse({ success: true }));
    return true;
  }
});
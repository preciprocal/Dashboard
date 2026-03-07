// background.js - Preciprocal Chrome Extension Service Worker

console.log('🚀 Preciprocal background.js loaded');

const STORAGE_KEY = 'preciprocal_auth';

// ─────────────────────────────────────────────────────────────────
// Read Firebase auth from a preciprocal.com tab using scripting API.
// This runs code directly inside the tab — no content script needed,
// no externally_connectable needed. Just reads IndexedDB and returns.
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
                        email:       user.email        || '',
                        displayName: user.displayName  || '',
                        token:       user.stsTokenManager.accessToken,
                      });
                      return;
                    }
                  }
                }
                resolve(null);
              };
              all.onerror = () => { db.close(); resolve(null); };
            };
          } catch {
            resolve(null);
          }
        });
      },
    });

    const user = results?.[0]?.result;
    return user || null;

  } catch (err) {
    console.warn('[BG] scripting.executeScript failed:', err?.message);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// Find an open preciprocal.com tab and sync auth from it
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
          token:       user.token,
          savedAt:     Date.now(),
        }
      });
      console.log('[BG] ✅ Auth synced from tab:', user.email);
      return user;
    }
  }

  console.warn('[BG] No authenticated preciprocal tab found');
  return null;
}

// ─────────────────────────────────────────────────────────────────
// Sync auth whenever a preciprocal.com tab finishes loading
// ─────────────────────────────────────────────────────────────────
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  const url = tab.url || '';
  if (!url.includes('preciprocal.com') && !url.includes('localhost:3000')) return;

  // Small delay to let Firebase finish restoring auth from IndexedDB
  setTimeout(async () => {
    const user = await readAuthFromTab(tabId);
    if (user) {
      await chrome.storage.local.set({
        [STORAGE_KEY]: {
          uid:         user.uid,
          email:       user.email,
          displayName: user.displayName,
          token:       user.token,
          savedAt:     Date.now(),
        }
      });
      console.log('[BG] ✅ Auto-synced auth on tab load:', user.email);
    }
  }, 2000);
});

// ─────────────────────────────────────────────────────────────────
// Messages from popup.js and banner.js
// ─────────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {

  if (message.type === 'CHECK_AUTH') {
    chrome.storage.local.get([STORAGE_KEY], (result) => {
      const auth = result[STORAGE_KEY];
      if (auth?.uid && auth?.token) {
        sendResponse({ authenticated: true, user: { uid: auth.uid, email: auth.email, displayName: auth.displayName } });
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

  if (message.type === 'SYNC_AUTH') {
    // Popup requests a fresh sync from open preciprocal tab
    syncAuthFromPreciprocal().then((user) => {
      if (user) {
        sendResponse({ success: true, user });
      } else {
        sendResponse({ success: false });
      }
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

  // Legacy handlers
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
});

// ─────────────────────────────────────────────────────────────────
// External messages from preciprocal.com (externally_connectable)
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
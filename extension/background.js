// background.js - Preciprocal Chrome Extension Service Worker

console.log('🚀 Preciprocal background.js loaded');

const STORAGE_KEY  = 'preciprocal_auth';
const JOB_QUEUE_KEY = 'preciprocal_job_queue';
const IS_DEV_BG    = false;
const BASE_URL     = IS_DEV_BG ? 'http://localhost:3000' : 'https://preciprocal.com';

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
      // Flush any queued job applications now that we have fresh auth
      flushJobQueue(user.token, user.uid, user.email);
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
// Job application queue helpers
// Applications are queued locally when auth is unavailable and
// flushed automatically once a valid token is present.
// ─────────────────────────────────────────────────────────────────
async function enqueueJobApplication(jobData) {
  try {
    const stored = await chrome.storage.local.get([JOB_QUEUE_KEY]);
    const queue  = stored[JOB_QUEUE_KEY] || [];
    queue.push({ ...jobData, _queuedAt: Date.now() });
    await chrome.storage.local.set({ [JOB_QUEUE_KEY]: queue });
    console.log('[BG] 📥 Job queued locally. Queue size:', queue.length);
  } catch (e) {
    console.warn('[BG] ⚠️ Failed to enqueue job:', e.message);
  }
}

async function flushJobQueue(token, userId, email) {
  try {
    const stored = await chrome.storage.local.get([JOB_QUEUE_KEY]);
    const queue  = stored[JOB_QUEUE_KEY] || [];
    if (!queue.length) return;

    console.log(`[BG] 🔄 Flushing ${queue.length} queued job(s)…`);
    const failed = [];

    for (const jobData of queue) {
      try {
        const res  = await fetch(`${BASE_URL}/api/extension/track-job`, {
          method: 'POST',
          headers: {
            'Content-Type':      'application/json',
            'x-extension-token': token  || '',
            'x-user-id':         userId || '',
            'x-user-email':      email  || '',
          },
          body: JSON.stringify(jobData),
        });
        const data = await res.json();
        if (!data.success && !data.duplicate) failed.push(jobData);
        else console.log('[BG] ✅ Flushed queued job:', jobData.jobTitle);
      } catch {
        failed.push(jobData);
      }
    }

    await chrome.storage.local.set({ [JOB_QUEUE_KEY]: failed });
    console.log(`[BG] Queue flush done. Saved: ${queue.length - failed.length}, still queued: ${failed.length}`);
  } catch (e) {
    console.warn('[BG] ⚠️ Queue flush error:', e.message);
  }
}

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

  // ── JOB APPLICATION SUBMITTED (fired by external-apply.js on confirmation page) ──
  if (message.type === 'JOB_APPLICATION_SUBMITTED') {
    const jobData = message.data;
    if (!jobData?.jobTitle) {
      sendResponse({ success: false, error: 'Missing job data' });
      return true;
    }

    chrome.storage.local.get([STORAGE_KEY], (result) => {
      const auth = result[STORAGE_KEY];

      if (!auth?.uid || !auth?.token) {
        // Not signed in — queue locally and retry when auth is available
        enqueueJobApplication(jobData).then(() =>
          sendResponse({ success: true, queued: true })
        );
        return;
      }

      fetch(`${BASE_URL}/api/extension/track-job`, {
        method: 'POST',
        headers: {
          'Content-Type':      'application/json',
          'x-extension-token': auth.token || '',
          'x-user-id':         auth.uid   || '',
          'x-user-email':      auth.email || '',
        },
        body: JSON.stringify(jobData),
      })
        .then(r => r.json())
        .then(data => {
          if (data.success || data.duplicate) {
            console.log('[BG] ✅ Job tracked:', jobData.jobTitle, '@', jobData.company);
            sendResponse({ success: true, queued: false });
            flushJobQueue(auth.token, auth.uid, auth.email);
          } else {
            console.warn('[BG] ⚠️ track-job API error:', data.error);
            enqueueJobApplication(jobData).then(() =>
              sendResponse({ success: true, queued: true })
            );
          }
        })
        .catch(err => {
          console.warn('[BG] ⚠️ track-job network error:', err.message);
          enqueueJobApplication(jobData).then(() =>
            sendResponse({ success: true, queued: true })
          );
        });
    });
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
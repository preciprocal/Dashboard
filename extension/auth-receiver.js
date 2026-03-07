// auth-receiver.js
// Runs as a content script on preciprocal.com at document_idle.
// Firebase Web SDK v9+ stores auth in IndexedDB (firebaseLocalStorageDb),
// NOT localStorage. This reads from IndexedDB and writes to
// chrome.storage.local so banner.js and popup.js can find it.

(function () {
  const STORAGE_KEY = 'preciprocal_auth';
  const IDB_NAME    = 'firebaseLocalStorageDb';
  const IDB_STORE   = 'firebaseLocalStorage';

  // ── Read auth from IndexedDB ───────────────────────────────────
  function readFromIndexedDB() {
    return new Promise((resolve) => {
      try {
        const req = indexedDB.open(IDB_NAME);

        req.onerror = () => resolve(null);

        req.onsuccess = (event) => {
          const db = event.target.result;

          // Check store exists
          if (!db.objectStoreNames.contains(IDB_STORE)) {
            db.close();
            resolve(null);
            return;
          }

          try {
            const tx    = db.transaction(IDB_STORE, 'readonly');
            const store = tx.objectStore(IDB_STORE);
            const all   = store.getAll();

            all.onsuccess = () => {
              db.close();
              const records = all.result || [];

              // Each record looks like:
              // { fbase_key: 'firebase:authUser:...', value: { uid, email, stsTokenManager: { accessToken } } }
              for (const record of records) {
                const key = record.fbase_key || record.key || '';
                if (key.startsWith('firebase:authUser:')) {
                  const user = record.value;
                  if (user?.uid && user?.stsTokenManager?.accessToken) {
                    resolve({
                      uid:   user.uid,
                      email: user.email || '',
                      token: user.stsTokenManager.accessToken,
                    });
                    return;
                  }
                }
              }
              resolve(null);
            };

            all.onerror = () => { db.close(); resolve(null); };

          } catch {
            db.close();
            resolve(null);
          }
        };

        req.onupgradeneeded = (event) => {
          // DB doesn't exist yet — user not logged in
          event.target.transaction.abort();
          resolve(null);
        };

      } catch {
        resolve(null);
      }
    });
  }

  // ── Sync to chrome.storage.local ─────────────────────────────
  async function syncAuth() {
    const user = await readFromIndexedDB();

    if (user) {
      chrome.storage.local.get([STORAGE_KEY], (result) => {
        const existing = result[STORAGE_KEY];

        // Skip write if already up to date
        if (existing?.uid === user.uid && existing?.token === user.token) return;

        chrome.storage.local.set({
          [STORAGE_KEY]: {
            uid:     user.uid,
            email:   user.email,
            token:   user.token,
            savedAt: Date.now(),
          }
        }, () => {
          console.log('[Preciprocal] ✅ Auth synced from IndexedDB — user:', user.email);
        });
      });

    } else {
      // Not logged in — clear stale auth
      chrome.storage.local.get([STORAGE_KEY], (result) => {
        if (result[STORAGE_KEY]) {
          chrome.storage.local.remove([STORAGE_KEY], () => {
            console.log('[Preciprocal] 🗑️ Auth cleared');
          });
        }
      });
    }
  }

  // ── Run at document_idle + with delays ───────────────────────
  // document_idle means DOM is ready but Firebase may still be
  // restoring its auth state from IndexedDB — delays catch that.
  syncAuth();
  setTimeout(syncAuth, 1000);
  setTimeout(syncAuth, 3000);

  // Re-sync whenever the page becomes visible again (tab switch / return)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      syncAuth();
    }
  });

})();
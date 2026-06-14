// background.js - Preciprocal Chrome Extension Service Worker

console.log('🚀 Preciprocal background.js loaded');

const STORAGE_KEY  = 'preciprocal_auth';
const JOB_QUEUE_KEY = 'preciprocal_job_queue';
const IS_DEV_BG    = false;
const BASE_URL     = IS_DEV_BG ? 'http://localhost:3000' : 'https://app.preciprocal.com';

// ─────────────────────────────────────────────────────────────────
// DYNAMIC INJECTION — covers custom career domains not in the manifest
// e.g. fanduel.careers (Greenhouse), greenhouse-hosted custom domains, etc.
// ─────────────────────────────────────────────────────────────────

// Domains already handled by static content scripts in manifest.json — skip dynamic injection
const STATIC_DOMAINS = [
  'greenhouse.io','lever.co','workday.com','myworkdayjobs.com','myworkday.com',
  'indeed.com','ashbyhq.com','icims.com','jobvite.com','smartrecruiters.com',
  'taleo.net','successfactors.com','bamboohr.com','recruitee.com','applytojob.com',
  'wellfound.com','angel.co','rippling.com','pinpointhq.com','dover.com',
  'workable.com','breezy.hr','jazz.co','jazhr.com','polymer.co','hiring.com',
  'comeet.com','teamtailor.com','personio.de','personio.com','hi.com',
  'jobscore.com','paylocity.com','paycom.com','adp.com','ultipro.com','dayforce.com',
  'linkedin.com','preciprocal.com','localhost',
  // ATS sub-platforms
  'join.com','jobspage.co','workday.com','myworkday.com','recruiting.com',
];

// Strong ATS URL parameters — unmistakably a job application
const JOB_URL_SIGNALS = [
  // Greenhouse (custom career domains like fanduel.careers, stripe.com, etc.)
  /[?&]gh_jid=\d+/,
  /[?&]gh_src=/,
  // Lever (UUID-based job IDs on custom domains)
  /[?&]lever-origin=/,
  /\/jobs\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i,
  // Workday (custom domains)
  /\/d\/[a-z]{2,}\//,
  // iCIMS
  /[?&]iis=|[?&]icims=/i,
  // SmartRecruiters
  /[?&]src=smartrecruiters/i,
  // Generic ATS job ID params
  /[?&](jobId|job_id|jobID|positionId|position_id|openingId|vacancyId)=[A-Za-z0-9\-]{4,}/i,
  // Ashby
  /[?&]ashby_jid=/i,
  // Application page paths
  /\/job-application\//i,
  /\/apply-now\/?$/i,
  /\/careers\/jobs\//i,
  /\/careers\/open-positions\//i,
  /\/open-positions\/[^/]+/i,
  /\/job-openings\/[^/]+/i,
  /\/current-openings\/[^/]+/i,
  /\/join-us\/[^/]+/i,
  /\/work-with-us\/[^/]+/i,
];

// Hostname patterns for career/job subdomains (custom company career portals)
const CAREER_HOST_PATTERNS = [
  /^careers?\./i,       // careers.company.com, career.company.com
  /^jobs?\./i,          // jobs.company.com, job.company.com
  /^apply\./i,          // apply.company.com
  /^recruiting?\./i,    // recruiting.company.com
  /^hire\./i,           // hire.company.com
  /^talent\./i,         // talent.company.com
  /^work\./i,           // work.company.com (e.g. work.stripe.com)
  /^openings?\./i,      // openings.company.com
  /^joinus\./i,         // joinus.company.com
  /\.careers$/i,        // company.careers (fanduel.careers, stripe.careers)
  /\.jobs$/i,           // company.jobs
  /\.work$/i,           // company.work
];

// Path keywords that suggest an active job application page
const JOB_PATH_PATTERNS = [
  /\/careers?\/[^/]+/i,   // /career/job-title, /careers/role
  /\/jobs?\/[^/]+\/[^/]+/i, // /jobs/company/role, /job/title-id
  /\/positions?\/[^/]+/i,  // /position/xyz, /positions/abc
  /\/openings?\/[^/]+/i,   // /opening/xyz
  /\/vacancy\/[^/]+/i,     // /vacancy/xyz
  /\/vacancies\/[^/]+/i,   // /vacancies/abc
  /\/roles?\/[^/]+/i,      // /role/xyz
  /\/(apply|application)(\/|$)/i, // /apply, /apply/, /application
];

// Tracks tabs where we dynamically injected to avoid double-injection
const _injectedTabs = new Set();

function _isStaticDomain(url) {
  try {
    const host = new URL(url).hostname;
    // Explicit static domains
    if (STATIC_DOMAINS.some(d => host === d || host.endsWith('.' + d))) return true;
    // Career TLDs covered by manifest *.careers, *.jobs, *.work patterns
    if (/\.(careers|jobs|work)$/i.test(host)) return true;
    return false;
  } catch { return true; }
}

function _looksLikeJobPage(url) {
  try {
    const parsed = new URL(url);
    const host   = parsed.hostname;
    const path   = parsed.pathname;
    const full   = url;

    // Strong ATS URL signals
    if (JOB_URL_SIGNALS.some(re => re.test(full))) return true;

    // Career subdomain / TLD
    if (CAREER_HOST_PATTERNS.some(re => re.test(host))) return true;

    // Path-based signals (must also have a job-like host or be reasonably specific)
    if (JOB_PATH_PATTERNS.some(re => re.test(path))) return true;

    return false;
  } catch { return false; }
}

async function _dynamicInject(tabId, url) {
  if (_injectedTabs.has(tabId)) return;
  if (_isStaticDomain(url) || !_looksLikeJobPage(url)) return;
  try {
    await chrome.scripting.insertCSS({ target: { tabId }, files: ['content.css'] });
    await chrome.scripting.executeScript({ target: { tabId }, files: ['external-apply.js'] });
    _injectedTabs.add(tabId);
    console.log('[BG] ✅ Dynamically injected on custom job portal:', url);
  } catch (err) {
    console.warn('[BG] ⚠️ Dynamic injection failed:', err.message);
  }
}

chrome.tabs.onRemoved.addListener(tabId => _injectedTabs.delete(tabId));

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
    url: ['https://app.preciprocal.com/*', 'https://preciprocal.com/*', 'http://localhost:3000/*']
  });

  for (const tab of tabs) {
    if (!tab.id) continue;
    const user = await readAuthFromTab(tab.id);
    if (user) {
      await chrome.storage.local.set({
        [STORAGE_KEY]: {
          uid:         user.uid,
          email:       user.email        || '',
          displayName: user.displayName  || '',
          photoURL:    user.photoURL     || '',
          token:       user.token,
          savedAt:     Date.now(),
        }
      });
      // auth synced
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
  if (!url) return;

  // 1. Auth sync for preciprocal app tabs
  if (url.includes('preciprocal.com')) {
    readAuthFromTab(tabId).then(async (user) => {
      if (user) {
        await chrome.storage.local.set({
          [STORAGE_KEY]: {
            uid:         user.uid,
            email:       user.email,
            displayName: user.displayName || '',
            photoURL:    user.photoURL    || '',
            token:       user.token,
            savedAt:     Date.now(),
          }
        });
        flushJobQueue(user.token, user.uid, user.email);
      } else {
        const current = await chrome.storage.local.get([STORAGE_KEY]);
        if (current[STORAGE_KEY]?.uid) {
          await chrome.storage.local.remove([STORAGE_KEY]);
        }
      }
    }).catch(() => {});
  }

  // 2. Dynamic injection for custom-domain job portals (e.g. fanduel.careers, custom Greenhouse)
  _dynamicInject(tabId, url);
});

// ─────────────────────────────────────────────────────────────────
// Sync auth whenever ANY tab becomes active
// ─────────────────────────────────────────────────────────────────
chrome.tabs.onActivated.addListener(async () => {
  const result = await chrome.storage.local.get([STORAGE_KEY]);
  const stored = result[STORAGE_KEY];
  if (stored?.uid && stored?.savedAt && (Date.now() - stored.savedAt) < 50 * 60 * 1000) {
    return;
  }
  await syncAuthFromPreciprocal();
});

// ─────────────────────────────────────────────────────────────────
// Job application queue helpers
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
// ─────────────────────────────────────────────────────────────────
// FETCH_FILE — fetch Firebase Storage files on behalf of content scripts
// (service worker has no CORS restrictions; content scripts do)
// ─────────────────────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'FETCH_FILE') {
    fetch(message.url)
      .then(r => r.blob())
      .then(blob => {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result.split(',')[1];
          sendResponse({ base64, mimeType: blob.type });
        };
        reader.onerror = () => sendResponse(null);
        reader.readAsDataURL(blob);
      })
      .catch(() => sendResponse(null));
    return true;
  }

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
    const { uid, email, token, displayName, photoURL } = message;
    if (uid && token) {
      chrome.storage.local.set({
        [STORAGE_KEY]: {
          uid,
          email:       email       || '',
          displayName: displayName || '',
          photoURL:    photoURL    || '',
          token,
          savedAt: Date.now(),
        }
      }, () => sendResponse({ success: true }));
    } else {
      sendResponse({ success: false });
    }
    return true;
  }

  // ── API PROXY ────────────────────────────────────────────────────────────────

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

  // ── NEW: Fetch all tracked job IDs from DB ───────────────────────────────────
  // Returns { success: true, jobIds: { "12345": "saved", "67890": "applied" } }
  if (message.type === 'API_FETCH_TRACKED_JOBS') {
    const { token, userId, email, baseUrl } = message;
    fetch(`${baseUrl}/api/extension/track-job`, {
      method: 'GET',
      headers: {
        'Content-Type':      'application/json',
        'x-extension-token': token  || '',
        'x-user-id':         userId || '',
        'x-user-email':      email  || '',
      },
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

  // ── JOB APPLICATION SUBMITTED ─────────────────────────────────────────────
  if (message.type === 'JOB_APPLICATION_SUBMITTED') {
    const jobData = message.data;
    if (!jobData?.jobTitle) {
      sendResponse({ success: false, error: 'Missing job data' });
      return true;
    }

    chrome.storage.local.get([STORAGE_KEY], (result) => {
      const auth = result[STORAGE_KEY];

      if (!auth?.uid || !auth?.token) {
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
            // job tracked
            sendResponse({ success: true, queued: false });
            flushJobQueue(auth.token, auth.uid, auth.email);
          } else {
            // track-job error, queuing
            enqueueJobApplication(jobData).then(() =>
              sendResponse({ success: true, queued: true })
            );
          }
        })
        .catch(err => {
          // network error, queuing
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
  const allowed = ['https://app.preciprocal.com', 'https://preciprocal.com'];
  if (!allowed.includes(sender.origin)) {
    sendResponse({ success: false, error: 'Unauthorized' });
    return;
  }

  if (message.type === 'SAVE_AUTH') {
    const { uid, email, token, displayName, photoURL } = message;
    if (uid && token) {
      chrome.storage.local.set({
        [STORAGE_KEY]: {
          uid,
          email:       email       || '',
          displayName: displayName || '',
          photoURL:    photoURL    || '',
          token,
          savedAt: Date.now(),
        }
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
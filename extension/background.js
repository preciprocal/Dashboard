// background.js - Preciprocal Chrome Extension Service Worker

console.log('🚀 Preciprocal background.js loaded');

const STORAGE_KEY  = 'preciprocal_auth';
const JOB_QUEUE_KEY = 'preciprocal_job_queue';
// NEVER ship this as true - it points every network call (job tracking,
// auto-apply queue flush) at localhost instead of production. Only flip it
// for local testing against `npm run dev`, and flip it back before packaging.
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
// Auth sync — the extension never reads Supabase's (or any backend's)
// session storage directly. It only relays whatever localhost-bridge.js
// forwards from the page via postMessage (see SAVE_AUTH/CLEAR_AUTH below).
// This just pings any open preciprocal tab to re-broadcast its current auth
// on demand (e.g. from the popup's refresh action or the on-page banner),
// then waits briefly for the resulting SAVE_AUTH to land in storage.
// ─────────────────────────────────────────────────────────────────
async function requestFreshAuthFromOpenTabs() {
  const tabs = await chrome.tabs.query({
    url: ['https://app.preciprocal.com/*', 'https://preciprocal.com/*', 'http://localhost:3000/*']
  });
  if (tabs.length === 0) return false;

  const before = (await chrome.storage.local.get([STORAGE_KEY]))[STORAGE_KEY]?.savedAt || 0;

  for (const tab of tabs) {
    if (!tab.id) continue;
    try { await chrome.tabs.sendMessage(tab.id, { type: 'PING_REQUEST_AUTH' }); } catch { /* content script not injected here */ }
  }

  // Poll briefly for the round-trip (background -> content script -> page ->
  // content script -> SAVE_AUTH) to land, rather than blocking indefinitely.
  for (let i = 0; i < 8; i++) {
    await new Promise((r) => setTimeout(r, 200));
    const current = (await chrome.storage.local.get([STORAGE_KEY]))[STORAGE_KEY];
    if (current?.savedAt && current.savedAt > before) return true;
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────
// Dynamic injection for custom-domain job portals whenever a tab finishes loading
// ─────────────────────────────────────────────────────────────────
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return;
  const url = tab.url || '';
  if (!url) return;
  _dynamicInject(tabId, url);
});

// ─────────────────────────────────────────────────────────────────
/**
 * Is this refusal one that retrying will never get past?
 *
 * The queue is for transient failures. Anything the server has DECIDED -
 * you are at your tracker limit, this payload is malformed, this token is
 * not yours - returns the same answer on every attempt, so keeping it
 * queued burns a request per flush and delays the items behind it.
 *
 * 401 is deliberately NOT in here. A token can expire while items sit in
 * the queue and be refreshed before the next flush, which is exactly the
 * case the queue is for.
 */
function isPermanentRefusal(status, data) {
  if (data && data.code === 'JOB_TRACKER_FULL') return true;
  // 400 malformed, 403 refused, 413 too large, 422 unprocessable. A 5xx is a
  // server problem and stays queued; 429 is rate limiting and will pass later.
  return status === 400 || status === 403 || status === 413 || status === 422;
}

/**
 * Tell the user once, rather than dropping their saved job silently.
 *
 * They pressed a button and believe it worked - the queue is invisible to
 * them. Losing it without a word is the same failure as the silent redirect
 * the interview panel used to do.
 */
function notifyQueueDrop(data) {
  try {
    chrome.notifications?.create({
      type:    'basic',
      iconUrl: 'icons/icon128.png',
      title:   data && data.code === 'JOB_TRACKER_FULL' ? 'Job tracker is full' : "Couldn't save that job",
      message: (data && data.error) || 'Open Preciprocal to see what happened.',
    });
  } catch (e) {
    console.warn('[BG] notification failed:', e.message);
  }
}

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

        if (data.success || data.duplicate) {
          console.log('[BG] ✅ Flushed queued job:', jobData.jobTitle);
        } else if (isPermanentRefusal(res.status, data)) {
          // Dropped, not retried. The queue exists for transient failures -
          // offline, a dropped connection, a 500. A quota refusal is a
          // decision, and retrying it every flush means this item spins
          // against a wall forever while delaying everything behind it.
          //
          // Before this, the only test was `!data.success`, so a full tracker
          // re-queued the same job on every flush for as long as the user
          // stayed at their limit.
          console.warn('[BG] ⛔ Dropping job, server refused permanently:', data.code || res.status, '-', jobData.jobTitle);
          notifyQueueDrop(data);
        } else {
          failed.push(jobData);
        }
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
    requestFreshAuthFromOpenTabs().then(async (found) => {
      if (found) {
        const auth = (await chrome.storage.local.get([STORAGE_KEY]))[STORAGE_KEY];
        sendResponse({ success: true, user: auth });
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
        sendResponse({ success: true });
        flushJobQueue(token, uid, email || '');
      });
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

  // Analytics for the in-extension Pro prompt. Gates nothing - see
  // extension/upsell.js. Failures resolve rather than reject so a content
  // script never has to handle them.
  if (message.type === 'API_POST_UPSELL_EVENT') {
    const { token, userId, email, baseUrl, payload } = message;
    fetch(`${baseUrl}/api/extension/upsell-event`, {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-extension-token': token   || '',
        'x-user-id':         userId  || '',
        'x-user-email':      email   || '',
      },
      body: JSON.stringify(payload || {}),
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
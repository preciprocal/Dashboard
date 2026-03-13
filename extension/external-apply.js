// external-apply.js
// Preciprocal Universal Auto-Apply — sidebar for external job boards
// Platforms: Greenhouse, Lever, Workday/MyWorkdayJobs, Indeed Smart Apply,
//            Ashby, iCIMS, Jobvite, SmartRecruiters, Taleo, BambooHR,
//            Recruitee, Wellfound/AngelList + generic fallback
// + Job Tracker: auto-logs every submitted application to Preciprocal

console.log('🚀 Preciprocal external-apply.js on:', window.location.hostname);

const IS_DEV = false; // Set to true for local development
const PRECIPROCAL_URL = IS_DEV ? 'http://localhost:3000' : 'https://preciprocal.com';

// ─────────────────────────────────────────────────────────────────
// Platform detection
// ─────────────────────────────────────────────────────────────────
function detectPlatform() {
  const host = window.location.hostname;
  if (host.includes('greenhouse.io'))       return 'greenhouse';
  if (host.includes('lever.co'))            return 'lever';
  if (host.includes('workday.com') || host.includes('myworkdayjobs.com')) return 'workday';
  if (host.includes('indeed.com'))          return 'indeed';
  if (host.includes('ashbyhq.com'))         return 'ashby';
  if (host.includes('icims.com'))           return 'icims';
  if (host.includes('jobvite.com'))         return 'jobvite';
  if (host.includes('smartrecruiters.com')) return 'smartrecruiters';
  if (host.includes('taleo.net'))           return 'taleo';
  if (host.includes('bamboohr.com'))        return 'bamboohr';
  if (host.includes('recruitee.com'))       return 'recruitee';
  if (host.includes('wellfound.com') || host.includes('angel.co')) return 'wellfound';
  return 'generic';
}

// ─────────────────────────────────────────────────────────────────
// JOB TRACKER — detect submission & send to Preciprocal
// ─────────────────────────────────────────────────────────────────

const PLATFORM_NAMES = {
  greenhouse:      'Greenhouse',
  lever:           'Lever',
  workday:         'Workday',
  indeed:          'Indeed',
  ashby:           'Ashby',
  icims:           'iCIMS',
  jobvite:         'Jobvite',
  smartrecruiters: 'SmartRecruiters',
  taleo:           'Taleo',
  bamboohr:        'BambooHR',
  recruitee:       'Recruitee',
  wellfound:       'Wellfound',
  generic:         'Other',
};

// Per-platform selectors to detect success/confirmation pages
const SUCCESS_SIGNALS = {
  greenhouse:      { selectors: ['.confirmation', '[class*="confirmation"]', '#confirmation'], text: ['thank you', 'application submitted', 'application received', 'successfully applied'] },
  lever:           { selectors: ['.confirmation-page', '[class*="confirmation"]'], text: ['thank you', 'application submitted', 'successfully applied'] },
  workday:         { selectors: ['[data-automation-id="thankYouPage"]', '[class*="confirmation"]'], text: ['thank you', 'application submitted', 'successfully submitted'] },
  indeed:          { selectors: ['[data-testid="application-confirmation"]', '.ia-PostApply', '[class*="PostApply"]'], text: ['application submitted', 'your application has been submitted', 'successfully applied'] },
  ashby:           { selectors: ['[class*="confirmation"]', '[class*="success"]', '[class*="thank"]'], text: ['thank you', 'application submitted', 'successfully applied'] },
  icims:           { selectors: ['[id*="SuccessPage"]', '[class*="success"]', '.iCIMS_SuccessPage'], text: ['thank you', 'application submitted', 'application complete'] },
  jobvite:         { selectors: ['#jv-apply-success', '.jv-apply-success', '[class*="success"]'], text: ['thank you', 'application received', 'successfully submitted'] },
  smartrecruiters: { selectors: ['[class*="thank-you"]', '[class*="success"]', '.application-complete'], text: ['thank you', 'application submitted', 'successfully applied'] },
  taleo:           { selectors: ['[id*="confirmation"]', '[class*="confirmation"]'], text: ['thank you', 'application submitted', 'successfully submitted'] },
  bamboohr:        { selectors: ['[class*="confirmation"]', '#applicationConfirmation'], text: ['thank you', 'application submitted', 'application received'] },
  recruitee:       { selectors: ['[class*="success"]', '[class*="thank"]', '[class*="confirmation"]'], text: ['thank you', 'application submitted', 'successfully applied'] },
  wellfound:       { selectors: ['[class*="confirmation"]', '[class*="success"]'], text: ['application submitted', 'successfully applied', 'thank you'] },
  generic:         { selectors: ['[class*="confirmation"]', '[class*="success"]', '[class*="thank"]'], text: ['thank you', 'application submitted', 'successfully applied'] },
};

let _applicationTracked = false;

function isSuccessPage(platform) {
  const signals = SUCCESS_SIGNALS[platform] || SUCCESS_SIGNALS.generic;

  // Check DOM elements
  for (const sel of signals.selectors) {
    try {
      const el = document.querySelector(sel);
      if (el && el.offsetParent !== null) return true;
    } catch {}
  }

  // Check page text
  const bodyText = (document.body?.textContent || '').toLowerCase();
  return signals.text.some(t => bodyText.includes(t));
}

function extractJobInfoFromPage() {
  const platform = detectPlatform();

  const titleSelectors = {
    greenhouse:      ['h1.app-title', '.job-title', 'h1'],
    lever:           ['h2.posting-name', '.posting-headline h2', 'h2', 'h1'],
    workday:         ['[data-automation-id="jobPostingTitle"]', 'h2', 'h1'],
    indeed:          ['[data-testid="jobsearch-JobInfoHeader-title"]', 'h1.jobTitle', 'h1'],
    ashby:           ['h1', '.job-title', 'h2'],
    icims:           ['.iCIMS_JobTitle', 'h1', '.icims-job-title'],
    jobvite:         ['.jv-job-header-name', 'h1', '.job-title'],
    smartrecruiters: ['h1.job-title', '.job-title h1', 'h1'],
    taleo:           ['#requisitionDescriptionInterface h1', '.jobTitle', 'h1'],
    bamboohr:        ['h2.BambooRich', 'h1', '.job-title'],
    recruitee:       ['h1', '.job-title'],
    wellfound:       ['h1', '.job-title', '[data-test="job-title"]'],
    generic:         ['h1', 'h2', '.job-title', '.position-title'],
  };

  const companySelectors = {
    greenhouse:      ['.company-name', '.employer'],
    lever:           ['.main-header-text h1', '.company-name'],
    workday:         [],
    indeed:          ['[data-testid="inlineHeader-companyName"]', '.icl-u-lg-mr--sm'],
    ashby:           ['.company-name'],
    icims:           ['.iCIMS_CompanyName'],
    jobvite:         ['.jv-company-name'],
    smartrecruiters: ['.company-name'],
    taleo:           [],
    bamboohr:        [],
    recruitee:       ['.company-name'],
    wellfound:       ['[data-test="company-name"]'],
    generic:         ['.company-name', '.employer'],
  };

  let jobTitle = null;
  for (const sel of (titleSelectors[platform] || titleSelectors.generic)) {
    try {
      const el = document.querySelector(sel);
      if (el) {
        const t = (el.textContent || '').trim();
        if (t && t.length > 0 && t.length < 200) { jobTitle = t; break; }
      }
    } catch {}
  }

  let company = null;
  for (const sel of (companySelectors[platform] || [])) {
    try {
      const el = document.querySelector(sel);
      if (el) {
        const t = (el.textContent || '').trim();
        if (t && t.length > 0 && t.length < 100) { company = t; break; }
      }
    } catch {}
  }

  // Fallback: extract company from subdomain
  if (!company) {
    const host  = window.location.hostname;
    const parts = host.split('.');
    const atsPlatforms = ['greenhouse', 'lever', 'workday', 'indeed', 'ashby', 'icims', 'jobvite', 'smartrecruiters', 'taleo', 'bamboohr', 'recruitee', 'wellfound', 'angel', 'myworkdayjobs'];
    if (parts.length >= 3 && atsPlatforms.some(p => parts[1].includes(p))) {
      company = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    } else if (parts.length >= 2) {
      const domain = parts[parts.length - 2];
      if (!atsPlatforms.includes(domain)) {
        company = domain.charAt(0).toUpperCase() + domain.slice(1);
      }
    }
  }

  // Fallback: document title
  if (!jobTitle) {
    const title = document.title || '';
    if (title.includes(' - '))      jobTitle = title.split(' - ')[0].trim();
    else if (title.includes(' | ')) jobTitle = title.split(' | ')[0].trim();
    else jobTitle = title.trim() || 'Unknown Position';
  }

  if (!company)  company  = 'Unknown Company';
  if (jobTitle.length > 100) jobTitle = jobTitle.slice(0, 100);
  if (company.length  > 100) company  = company.slice(0, 100);

  return { jobTitle, company };
}

async function trackJobApplication(platform) {
  if (_applicationTracked) return;
  _applicationTracked = true;

  const { jobTitle, company } = extractJobInfoFromPage();
  const jobData = {
    jobTitle,
    company,
    jobBoard:    PLATFORM_NAMES[platform] || 'Other',
    jobUrl:      window.location.href,
    appliedAt:   new Date().toISOString(),
    status:      'Applied',
    source:      'chrome_extension',
    autoTracked: true,
  };

  console.log('📋 Preciprocal: tracking job application →', jobTitle, 'at', company);

  try {
    chrome.runtime.sendMessage(
      { type: 'JOB_APPLICATION_SUBMITTED', data: jobData },
      (response) => {
        if (chrome.runtime.lastError) {
          console.warn('⚠️ Job tracker: could not reach background:', chrome.runtime.lastError.message);
          return;
        }
        if (response?.success) {
          console.log('✅ Job application tracked', response.queued ? '(queued locally)' : '(saved to server)');
          showTrackingToast(jobTitle, company);
        }
      }
    );
  } catch (e) {
    console.warn('⚠️ Job tracker error:', e.message);
  }
}

// Small non-intrusive toast (separate from the sidebar)
function showTrackingToast(jobTitle, company) {
  if (document.getElementById('prc-tracker-toast')) return;

  // Inject keyframes safely (handles document_start)
  if (!document.getElementById('prc-toast-styles')) {
    const style = document.createElement('style');
    style.id = 'prc-toast-styles';
    style.textContent = `
      @keyframes prcToastIn  { from { transform:translateY(40px); opacity:0; } to { transform:translateY(0); opacity:1; } }
      @keyframes prcToastOut { from { transform:translateY(0); opacity:1; } to { transform:translateY(20px); opacity:0; } }
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  const toast = document.createElement('div');
  toast.id = 'prc-tracker-toast';
  toast.style.cssText = `
    position: fixed;
    bottom: 24px;
    left: 24px;
    background: linear-gradient(135deg, #1e1b4b, #1e293b);
    border: 1px solid rgba(168,85,247,0.35);
    color: #e2e8f0;
    padding: 12px 16px;
    border-radius: 10px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    z-index: 2147483646;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    font-size: 12px;
    display: flex;
    align-items: flex-start;
    gap: 10px;
    max-width: 280px;
    animation: prcToastIn 0.35s cubic-bezier(0.175,0.885,0.32,1.275);
  `;
  toast.innerHTML = `
    <span style="font-size:18px;line-height:1;">✅</span>
    <div>
      <div style="font-weight:700;font-size:12px;color:#c084fc;margin-bottom:2px;">Added to Job Tracker</div>
      <div style="color:#94a3b8;font-size:11px;line-height:1.4;">${jobTitle}<br>@ ${company}</div>
    </div>
  `;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'prcToastOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 4500);
}

// Watch for confirmation page — covers manual submits AND auto-fill bot submits
function watchForApplicationSuccess(platform) {
  // Immediate check — maybe already on success page
  if (isSuccessPage(platform)) {
    trackJobApplication(platform);
    return;
  }

  // Poll for URL changes (SPA navigation)
  let lastUrl = window.location.href;
  const urlWatcher = setInterval(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      setTimeout(() => {
        if (isSuccessPage(platform)) {
          clearInterval(urlWatcher);
          domWatcher.disconnect();
          trackJobApplication(platform);
        }
      }, 800);
    }
  }, 600);

  // DOM changes (Workday / iCIMS in-page confirmation)
  const domWatcher = new MutationObserver(() => {
    if (isSuccessPage(platform)) {
      domWatcher.disconnect();
      clearInterval(urlWatcher);
      trackJobApplication(platform);
    }
  });
  domWatcher.observe(document.body, { childList: true, subtree: true });

  // Also intercept native form submits
  document.addEventListener('submit', (e) => {
    const form = e.target;
    const action = (form.action || '').toLowerCase();
    const isApplyForm = /apply|application|submit/i.test(action) ||
      !!form.querySelector('[name*="resume"], [name*="firstName"], [name*="first_name"], input[type="email"]');
    if (isApplyForm) {
      setTimeout(() => {
        if (isSuccessPage(platform)) {
          clearInterval(urlWatcher);
          domWatcher.disconnect();
          trackJobApplication(platform);
        }
      }, 1500);
    }
  }, true);
}

// ─────────────────────────────────────────────────────────────────
// APPLY BUTTON FINDER & CLICKER
// ─────────────────────────────────────────────────────────────────

const APPLY_BUTTON_SELECTORS = [
  'a[href*="apply"]',
  'button[id*="apply" i]',
  'a[id*="apply" i]',
  'button[class*="apply" i]',
  'a[class*="apply" i]',
  'button[data-qa*="apply" i]',
  'a[data-qa*="apply" i]',
  'button[data-automation-id*="apply" i]',
  '[data-testid*="apply" i]',
  '#apply_button',
  '.apply-button',
  'a.apply-now',
  '.template-btn-submit',
  'a.postings-btn',
  '[data-automation-id="applyButton"]',
  '[data-automation-id="apply-button"]',
  '.ia-continueButton',
  '[data-testid="indeedApplyButton"]',
  '[data-test="apply-button"]',
  'button[data-id="apply"]',
  '#applyButton',
  '.iCIMS_JobsTable .iCIMS_Anchor',
  'button.styles_applyButton__',
  'button[type="submit"][class*="apply" i]',
  '.btn-apply',
  '.apply-now-btn',
  '#applyNow',
  '.apply-cta',
];

const APPLY_KEYWORDS = [
  'apply now', 'apply for this job', 'apply for this position', 'apply for this role',
  'apply to this job', 'apply today', 'apply online', 'submit application',
  'start application', 'begin application', 'apply',
];

const APPLY_EXCLUDE_KEYWORDS = [
  'already applied', 'application submitted', 'view application',
  'withdraw', 'not interested', 'easy apply', 'quick apply',
];

function findApplyButton() {
  for (const sel of APPLY_BUTTON_SELECTORS) {
    try {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        if (!el || el.offsetParent === null) continue;
        if (el.disabled) continue;
        const text = (el.textContent || el.value || el.getAttribute('aria-label') || '').toLowerCase().trim();
        if (APPLY_EXCLUDE_KEYWORDS.some(kw => text.includes(kw))) continue;
        const isSpecificSelector = sel.includes('#') || sel.includes('applyButton') || sel.includes('apply-button') || sel.includes('postings-btn');
        if (isSpecificSelector || APPLY_KEYWORDS.some(kw => text.includes(kw))) {
          console.log('✅ Found apply button via selector:', sel, '| text:', text.slice(0, 40));
          return el;
        }
      }
    } catch {}
  }

  const candidates = Array.from(document.querySelectorAll('button, a, [role="button"]'))
    .filter(el => el.offsetParent !== null && !el.disabled);
  for (const el of candidates) {
    const text = (el.textContent || el.value || el.getAttribute('aria-label') || '').toLowerCase().trim();
    if (APPLY_EXCLUDE_KEYWORDS.some(kw => text.includes(kw))) continue;
    if (APPLY_KEYWORDS.some(kw => text === kw || text.startsWith(kw))) {
      console.log('✅ Found apply button via text scan:', text.slice(0, 40));
      return el;
    }
  }
  return null;
}

function isJobDetailPage() {
  const path = window.location.pathname.toLowerCase();
  const host = window.location.hostname;

  if (host.includes('greenhouse.io') && path.includes('/application')) return false;
  if (host.includes('lever.co') && path.match(/\/[^/]+\/[a-f0-9-]{36}\/apply/)) return false;
  if (host.includes('ashbyhq.com') && path.includes('/application')) return false;
  if (host.includes('jobvite.com') && path.includes('/apply')) return false;
  if (host.includes('smartrecruiters.com') && path.includes('/apply')) return false;
  if (host.includes('bamboohr.com') && path.includes('/apply')) return false;

  if ((host.includes('workday.com') || host.includes('myworkdayjobs.com')) &&
      document.querySelector('[data-automation-id="legalNameSection_firstName"], [data-automation-id="firstName"]')) {
    return false;
  }

  if (document.querySelector('.ia-BasePage, #ia-container')) return false;

  const hasVisibleForm = !!(
    document.querySelector('#first_name, #last_name, input[name="first_name"], input[name="email"], input[name="name"]') ||
    document.querySelector('#iCIMS_MainColumn') ||
    document.querySelector('[data-automation-id="legalNameSection_firstName"]') ||
    document.querySelector('form[action*="apply"], form[id*="apply" i], form[class*="apply" i]')
  );

  if (hasVisibleForm) return false;
  return !!findApplyButton();
}

async function clickApplyAndWaitForForm(statusEl) {
  const applyBtn = findApplyButton();
  if (!applyBtn) {
    console.log('ℹ️ No apply button found — assuming form is already visible');
    return false;
  }

  console.log('🖱️ Clicking apply button:', applyBtn.textContent?.trim().slice(0, 40));
  if (statusEl) {
    statusEl.style.display = 'block';
    statusEl.className = 'prc-sb-status info';
    statusEl.innerHTML = '🖱️ Clicking Apply button…';
  }

  const target = applyBtn.getAttribute('target');
  const href   = applyBtn.getAttribute('href');
  const opensNewTab = target === '_blank' || (href && !href.startsWith('#') && !href.startsWith('javascript'));

  if (opensNewTab && href) {
    console.log('🔗 Apply button opens new tab — navigating...');
    return false;
  }

  applyBtn.click();
  if (statusEl) statusEl.innerHTML = '⏳ Waiting for application form…';

  const formAppeared = await waitForApplicationForm(8000);
  if (formAppeared) {
    console.log('✅ Application form appeared after clicking Apply');
    if (statusEl) statusEl.innerHTML = '📝 Form detected — filling…';
    return true;
  }

  console.log('ℹ️ Form not detected in current DOM — may have navigated');
  return false;
}

function waitForApplicationForm(timeout = 8000) {
  return new Promise(resolve => {
    const formSelectors = [
      '#first_name', '#last_name', 'input[name="first_name"]', 'input[name="name"]',
      'input[name="email"]', '[data-automation-id="legalNameSection_firstName"]',
      '.ia-BasePage', '#iCIMS_MainColumn', 'form[action*="apply"]',
      'input[aria-label*="First name" i]', 'input[aria-label*="Email" i]',
      '.application-form', '#applicationForm', '#jv-apply-form',
    ];

    const check = () => formSelectors.some(sel => {
      try { return !!document.querySelector(sel); } catch { return false; }
    });

    if (check()) { resolve(true); return; }

    const obs = new MutationObserver(() => {
      if (check()) { obs.disconnect(); resolve(true); }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => { obs.disconnect(); resolve(false); }, timeout);
  });
}

// ─────────────────────────────────────────────────────────────────
// Detect if current page has a job application form
// ─────────────────────────────────────────────────────────────────
function isApplicationPage() {
  const host = window.location.hostname;
  const path = window.location.pathname.toLowerCase();
  const url  = window.location.href.toLowerCase();

  if ((host.includes('greenhouse.io')) &&
      (path.includes('/application') || url.includes('?gh_jid') || url.includes('#app'))) return true;
  if (host.includes('lever.co') && path.match(/\/[^/]+\/[a-f0-9-]{36}(\/apply)?/)) return true;
  if (host.includes('workday.com') || host.includes('myworkdayjobs.com')) {
    return path.includes('/apply') || path.includes('/job/') || !!document.querySelector('[data-automation-id]');
  }
  if (host.includes('indeed.com') && (path.includes('/apply') || url.includes('smartapply'))) return true;
  if (host.includes('ashbyhq.com') && (path.includes('/application') || path.includes('/jobs'))) return true;
  if (host.includes('icims.com') && (path.includes('apply') || !!document.querySelector('#iCIMS_MainColumn'))) return true;
  if (host.includes('jobvite.com') && (path.includes('/apply') || path.includes('/job'))) return true;
  if (host.includes('smartrecruiters.com') && (path.includes('/apply') || path.includes('/jobs'))) return true;
  if (host.includes('taleo.net') && path.includes('apply')) return true;
  if (host.includes('bamboohr.com') && path.includes('/careers')) return true;
  if (host.includes('wellfound.com') || host.includes('angel.co')) return true;

  const hasForms = !!(document.querySelector(
    '#first_name, #last_name, input[name="first_name"], input[name="name"],' +
    'input[name="email"], [data-automation-id="legalNameSection_firstName"],' +
    '.ia-BasePage, #applicationForm, #jv-apply-form'
  ));
  const hasApplyBtn  = !!findApplyButton();
  const keywordInUrl = /apply|application|job|career|position|opening/i.test(path + url);

  return hasForms || hasApplyBtn || keywordInUrl;
}

// ─────────────────────────────────────────────────────────────────
// React-safe value setter
// ─────────────────────────────────────────────────────────────────
function setReactValue(el, value) {
  if (!el || el.disabled || el.readOnly) return false;
  try {
    const proto  = el.tagName === 'TEXTAREA'
      ? window.HTMLTextAreaElement.prototype
      : window.HTMLInputElement.prototype;
    const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (nativeSetter) nativeSetter.call(el, value);
    else              el.value = value;
    el.dispatchEvent(new Event('input',  { bubbles: true, cancelable: true }));
    el.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    el.dispatchEvent(new Event('blur',   { bubbles: true, cancelable: true }));
    return true;
  } catch { return false; }
}

function setSelectValue(el, value) {
  if (!el || !value) return;
  const lower   = value.toLowerCase();
  const options = Array.from(el.options);
  const match   =
    options.find(o => o.text.toLowerCase() === lower) ||
    options.find(o => o.text.toLowerCase().includes(lower)) ||
    options.find(o => lower.includes(o.text.toLowerCase().replace(/\s+/g, ' ').split(' ')[0]));
  if (match && el.value !== match.value) setReactValue(el, match.value);
}

// ─────────────────────────────────────────────────────────────────
// Custom (div-based) dropdown filler
// ─────────────────────────────────────────────────────────────────
async function fillCustomDropdown(trigger, desiredValue) {
  if (!trigger || !desiredValue) return false;
  const desired = desiredValue.toLowerCase().trim();

  const searchInput = trigger.querySelector('input[type="text"], input:not([type="hidden"])') ||
    trigger.closest('[class*="select" i], [role="combobox"]')?.querySelector('input');

  trigger.click();
  trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  await new Promise(r => setTimeout(r, 350));

  const activeInput = document.activeElement;
  const typeTarget = searchInput ||
    (activeInput?.tagName === 'INPUT' ? activeInput : null) ||
    trigger.querySelector('input');

  if (typeTarget && typeTarget.tagName === 'INPUT') {
    setReactValue(typeTarget, desiredValue);
    typeTarget.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true }));
    typeTarget.dispatchEvent(new InputEvent('input', { bubbles: true, data: desiredValue }));
    await new Promise(r => setTimeout(r, 500));
  }

  const getOptions = () => {
    const selectors = [
      '[role="option"]',
      '[role="listbox"] [role="option"]',
      '[class*="option" i]:not([class*="container" i]):not([class*="indicator" i])',
      '[class*="menu" i] [class*="option" i]',
      '[class*="dropdown" i] li',
      'ul[class*="list" i] li',
      '[data-option]',
    ];
    for (const sel of selectors) {
      try {
        const found = Array.from(document.querySelectorAll(sel))
          .filter(el => el.offsetParent !== null && el.textContent?.trim());
        if (found.length) return found;
      } catch {}
    }
    return [];
  };

  let options = getOptions();

  if (!options.length) {
    await new Promise(r => setTimeout(r, 500));
    options = getOptions();
  }

  if (!options.length) {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return false;
  }

  const match =
    options.find(o => o.textContent?.trim().toLowerCase() === desired) ||
    options.find(o => o.textContent?.trim().toLowerCase().startsWith(desired)) ||
    options.find(o => o.textContent?.trim().toLowerCase().includes(desired)) ||
    options.find(o => desired.includes(o.textContent?.trim().toLowerCase().split(' ')[0]) && o.textContent?.trim().length < 50);

  if (match) {
    match.click();
    match.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    await new Promise(r => setTimeout(r, 200));
    return true;
  }

  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  return false;
}

function getCustomDropdownLabel(el) {
  let node = el.parentElement;
  for (let i = 0; i < 5; i++) {
    if (!node || node === document.body) break;
    const label =
      node.querySelector('label:not(:has(select)):not(:has(input)), legend, h3, h4') ||
      (() => {
        let sib = node.previousElementSibling;
        while (sib) {
          if (/label|heading|title|question/i.test(sib.className || '') || sib.tagName === 'LABEL') {
            return sib;
          }
          sib = sib.previousElementSibling;
        }
        return null;
      })();
    if (label && !label.contains(el)) {
      const text = (label.textContent || '').trim();
      if (text && text.length > 2 && text.length < 200) return text;
    }
    const directText = Array.from(node.childNodes)
      .filter(n => n.nodeType === 3 && n.textContent.trim().length > 2)
      .map(n => n.textContent.trim())[0];
    if (directText) return directText;
    node = node.parentElement;
  }
  return '';
}

function rangeToSingleNumber(value) {
  if (!value) return '';
  const str = String(value).trim();
  const rangeMatch = str.match(/^(\d+)\s*[-–]\s*\d+/);
  if (rangeMatch) return rangeMatch[1];
  const plusMatch = str.match(/^(\d+)\s*\+/);
  if (plusMatch) return plusMatch[1];
  const numMatch = str.match(/^(\d+)/);
  if (numMatch) return numMatch[1];
  return str;
}

// ─────────────────────────────────────────────────────────────────
// Label resolver
// ─────────────────────────────────────────────────────────────────
function getLabel(el) {
  if (el.id) {
    const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
    if (lbl) return (lbl.textContent || '').trim();
  }
  if (el.getAttribute('aria-label'))      return el.getAttribute('aria-label');
  if (el.getAttribute('aria-labelledby')) {
    const ids   = el.getAttribute('aria-labelledby').split(' ');
    const texts = ids.map(id => document.getElementById(id)?.textContent?.trim()).filter(Boolean);
    if (texts.length) return texts.join(' ');
  }
  if (el.placeholder) return el.placeholder;

  const container = el.closest(
    '[class*="field"], [class*="form-group"], [class*="input-wrapper"],' +
    '[class*="question"], [class*="FormField"], fieldset, label, .sc-form-item'
  );
  if (container) {
    const lbl = container.querySelector(
      'label, [class*="label"], [class*="Label"], legend, p[class*="title"]'
    );
    if (lbl && !lbl.contains(el)) return (lbl.textContent || '').trim();
    const text = (container.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60);
    if (text) return text;
  }
  return el.name || el.id || '';
}

// ─────────────────────────────────────────────────────────────────
// Map label text → profile field value
// ─────────────────────────────────────────────────────────────────
function matchByLabel(label, p) {
  if (!label) return null;
  const L = label.toLowerCase();

  if (/first.?name|given.?name|forename/i.test(L))           return p.firstName;
  if (/last.?name|surname|family.?name/i.test(L))            return p.lastName;
  if (/full.?name|your name|^name$|legal name/i.test(L))     return p.fullName;
  if (/email|e-mail|electronic mail/i.test(L))               return p.email;
  if (/phone|mobile|cell|tel(ephone)?|contact number/i.test(L)) return p.phone;
  if (/linkedin/i.test(L))                                   return p.linkedInUrl;
  if (/github/i.test(L))                                     return p.githubUrl;
  if (/portfolio|personal (site|web)/i.test(L))              return p.portfolioUrl;
  if (/website|personal url|online profile/i.test(L))        return p.portfolioUrl || p.linkedInUrl;
  if (/\bcity\b/i.test(L))                                   return p.city;
  if (/\bstate\b|\bprovince\b/i.test(L))                     return p.state;
  if (/zip|postal.?code|post.?code/i.test(L))                return p.zipCode;
  if (/country/i.test(L))                                    return p.country;
  if (/^address\s*1$|^addr\s*1$|^address line\s*1$|street.*address|mailing.*address/i.test(L)) return p.streetAddress || p.location || '';
  if (/^address\s*2$|^addr\s*2$|^address line\s*2$|apt|suite|unit/i.test(L)) return '';
  if (/^address\s*3$|^addr\s*3$/i.test(L))                   return '';
  if (/\bcounty\b/i.test(L))                                  return p.county || p.city || '';
  if (/location|\baddress\b|where.*based|home location/i.test(L)) return p.streetAddress || p.location || '';
  if (/current (company|employer|organization|org)\b/i.test(L)) return p.experience?.[0]?.company || '';
  if (/current (title|role|position|job title)/i.test(L))    return p.experience?.[0]?.title || p.headline;
  if (/job title|professional title|headline/i.test(L))      return p.headline;
  if (/years? of exp|how many years|experience level|years.*work/i.test(L)) {
    return rangeToSingleNumber(p.yearsOfExperience || '');
  }
  if (/salary|compensation|expected pay/i.test(L))           return p.desiredSalary;
  if (/notice period|available.*start|start date/i.test(L))  return p.noticePeriod;
  if (/pronouns?/i.test(L))                                  return p.pronouns || 'Prefer not to say';
  if (/university|school|college|institution/i.test(L))      return p.education?.[0]?.school || '';
  if (/degree|qualification/i.test(L))                       return p.education?.[0]?.degree || '';
  if (/field of study|major|discipline/i.test(L))            return p.education?.[0]?.field || '';
  if (/gpa|grade point/i.test(L))                            return p.education?.[0]?.gpa || '';
  if (/skills?/i.test(L) && p.skills?.length)               return p.skills.join(', ');
  if (/summary|about (me|yourself)|tell us/i.test(L))        return p.summary;
  return null;
}

function matchSelectByLabel(label, p) {
  const L = label.toLowerCase();
  if (/country/i.test(L))                                    return p.country || 'United States';
  if (/\bstate\b|\bprovince\b/i.test(L))                     return p.state || '';
  if (/\bcity\b/i.test(L))                                    return p.city  || '';
  if (/zip|postal.?code|post.?code/i.test(L))                return p.zipCode || '';
  if (/\bcounty\b/i.test(L))                                   return p.county || p.city || '';
  if (/^address\s*1$|^addr\s*1$|street.*address|address.?line.*1/i.test(L)) return p.streetAddress || p.location || '';
  if (/^address\s*2$|^addr\s*2$|address.?line.*2|apartment|suite|unit/i.test(L)) return '';
  if (/authorized|eligible|visa|work permit|legally.*work/i.test(L)) return 'Yes';
  if (/sponsor/i.test(L))                                    return p.requireSponsorship ? 'Yes' : 'No';
  if (/relocat/i.test(L))                                    return p.willingToRelocate  ? 'Yes' : 'No';
  if (/notice|start date|available/i.test(L))                return p.noticePeriod || '';
  if (/years? of exp|experience level/i.test(L)) {
    const y = parseInt(rangeToSingleNumber(p.yearsOfExperience || ''), 10);
    if (!isNaN(y)) {
      const opts = document.querySelectorAll('option');
      let best = null, bestDiff = Infinity;
      opts.forEach(o => {
        const m = o.text.match(/(\d+)/);
        if (m) { const d = Math.abs(parseInt(m[1]) - y); if (d < bestDiff) { bestDiff = d; best = o.value; } }
      });
      return best;
    }
  }
  if (/employment type|job type|work type/i.test(L))            return p.employmentType  || 'Full-time';
  if (/remote|hybrid|on.?site|work.*arrangement/i.test(L))      return p.workType        || 'Remote';
  if (/gender|sex/i.test(L))                                  return p.gender          || 'Prefer not to say';
  if (/pronoun/i.test(L))                                       return p.pronouns         || 'Prefer not to say';
  if (/race|ethnicit/i.test(L))                                 return p.race             || 'Prefer not to say';
  if (/veteran|military/i.test(L))                              return p.veteranStatus    || 'I am not a protected veteran';
  if (/disabilit/i.test(L))                                     return p.disabilityStatus || 'I do not have a disability';
  if (/how.*hear|referral|source.*job|learn.*about/i.test(L))   return p.howDidYouHear   || 'LinkedIn';
  if (/currently.*employ/i.test(L))                             return p.currentlyEmployed ? 'Yes' : 'No';
  if (/previously.*applied|applied.*before|prior.*applic/i.test(L)) return 'No';
  if (/served.*military|military.*service/i.test(L))            return 'No';
  if (/privacy|consent.*collect|data.*collection/i.test(L))     return 'Yes';
  if (/background.?check/i.test(L))                             return p.backgroundCheck  ? 'Yes' : 'No';
  if (/drug.?test/i.test(L))                                    return p.drugTest         ? 'Yes' : 'No';
  if (/criminal/i.test(L))                                      return p.criminalRecord   ? 'Yes' : 'No';
  if (/driver.?licen/i.test(L))                                 return p.driverLicense    ? 'Yes' : 'No';
  if (/18.*years|legal.*age|of age/i.test(L))                   return 'Yes';
  if (/language/i.test(L))                                      return p.languages        || 'English';
  if (/salary|compensation/i.test(L))                           return p.desiredSalary    || '';
  if (/state|province/i.test(L))                        return p.state            || '';
  if (/city/i.test(L))                                      return p.city             || '';
  return null;
}

// ─────────────────────────────────────────────────────────────────
// FileInjector
// ─────────────────────────────────────────────────────────────────
class FileInjector {
  static async injectFromUrl(url, fileName, inputs) {
    if (!url || !inputs?.length) return 0;
    let file;
    try {
      const ext  = fileName.split('.').pop()?.toLowerCase();
      const mime = { pdf:'application/pdf', doc:'application/msword', docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document', txt:'text/plain' }[ext] || 'application/octet-stream';

      if (url.startsWith('data:')) {
        const base64 = url.split(',')[1];
        if (!base64) throw new Error('Invalid base64 data URL');
        const binary = atob(base64);
        const bytes  = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
        file = new File([bytes], fileName, { type: mime });
      } else {
        const res  = await fetch(url, { mode: 'cors' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        file = new File([blob], fileName, { type: mime });
      }
    } catch (e) {
      console.error('❌ FileInjector failed:', e.message);
      return 0;
    }

    let count = 0;
    for (const input of inputs) {
      if (input.disabled) continue;
      try {
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
        input.dispatchEvent(new Event('input',  { bubbles: true }));
        count++;
        console.log(`✅ Injected "${fileName}" (${Math.round(file.size/1024)}KB) into`, input);
      } catch (e) {
        console.warn('⚠️ Could not set file on input:', e.message);
      }
    }
    return count;
  }

  static classify() {
    const all        = Array.from(document.querySelectorAll('input[type="file"]:not([disabled])'));
    const resume     = [], transcript = [], other = [];
    for (const inp of all) {
      const lbl = getLabel(inp).toLowerCase();
      if (/resume|cv\b|curriculum vitae/i.test(lbl))                resume.push(inp);
      else if (/transcript|academic record|grade|certificate/i.test(lbl)) transcript.push(inp);
      else if (/cover.?letter/i.test(lbl))                          {}
      else                                                           other.push(inp);
    }
    if (!resume.length     && other.length) resume.push(other.shift());
    if (!transcript.length && other.length) transcript.push(other.shift());
    return { resume, transcript };
  }
}

// ─────────────────────────────────────────────────────────────────
// Platform fillers
// ─────────────────────────────────────────────────────────────────

async function fillGreenhouse(p) {
  let filled = 0;
  const exact = [
    { sel: '#first_name, input[name="first_name"]',   val: p.firstName  },
    { sel: '#last_name,  input[name="last_name"]',    val: p.lastName   },
    { sel: '#email,      input[name="email"]',        val: p.email      },
    { sel: '#phone,      input[name="phone"]',        val: p.phone      },
    { sel: '#job_application_location, input[name="location"]', val: p.city || p.location },
  ];
  for (const { sel, val } of exact) {
    if (!val) continue;
    const el = document.querySelector(sel);
    if (el && !el.value) { setReactValue(el, val); filled++; }
  }
  const urlInputs = document.querySelectorAll(
    'input[name*="text_value"], input[data-qa="question-field"], ' +
    '.application-question input[type="text"], .field input[type="text"]'
  );
  for (const inp of urlInputs) {
    if (inp.value) continue;
    const lbl = getLabel(inp).toLowerCase();
    const val = matchByLabel(lbl, p);
    if (val) { setReactValue(inp, val); filled++; }
  }
  filled += await smartScan(p);
  return { filled };
}

async function fillLever(p) {
  let filled = 0;
  const nameField = document.querySelector('input[name="name"]');
  if (nameField && !nameField.value) { setReactValue(nameField, p.fullName); filled++; }
  const exact = [
    { sel: 'input[name="email"]',          val: p.email       },
    { sel: 'input[name="phone"]',          val: p.phone       },
    { sel: 'input[name="org"]',            val: p.experience?.[0]?.company || '' },
    { sel: 'input[name="location"]',       val: p.city || p.location },
    { sel: 'input[name="urls[LinkedIn]"]', val: p.linkedInUrl },
    { sel: 'input[name="urls[GitHub]"]',   val: p.githubUrl   },
    { sel: 'input[name="urls[Portfolio]"]',val: p.portfolioUrl },
    { sel: 'input[name="urls[Other]"]',    val: p.portfolioUrl || p.linkedInUrl },
    { sel: 'input[name="urls[Linkedin]"]', val: p.linkedInUrl },
    { sel: 'input[name="urls[Github]"]',   val: p.githubUrl   },
  ];
  for (const { sel, val } of exact) {
    if (!val) continue;
    const el = document.querySelector(sel);
    if (el && !el.value) { setReactValue(el, val); filled++; }
  }
  const cl = document.querySelector('textarea[name="comments"]');
  if (cl && !cl.value && p.summary) { setReactValue(cl, p.summary); filled++; }
  const linkInputs = document.querySelectorAll('.application-additional-cards input[type="text"]');
  for (const inp of linkInputs) {
    if (inp.value) continue;
    const val = matchByLabel(getLabel(inp).toLowerCase(), p);
    if (val) { setReactValue(inp, val); filled++; }
  }
  return { filled };
}

function wdSetValue(el, value) {
  if (!el || el.disabled || el.readOnly) return false;
  try {
    const proto  = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, value); else el.value = value;
    el.dispatchEvent(new Event('input',  { bubbles: true, cancelable: true }));
    el.dispatchEvent(new Event('change', { bubbles: true, cancelable: true }));
    el.dispatchEvent(new Event('blur',   { bubbles: true, cancelable: true }));
    return true;
  } catch { return false; }
}

function wdInput(automationId) {
  const w = document.querySelector(`[data-automation-id="${automationId}"]`);
  if (!w) return null;
  if (w.tagName === 'INPUT' || w.tagName === 'TEXTAREA') return w;
  return w.querySelector('input:not([type="hidden"]):not([type="file"]), textarea') || null;
}

async function wdPickListbox(automationId, preferredText) {
  const wrapper = document.querySelector(`[data-automation-id="${automationId}"]`);
  if (!wrapper) return false;
  const trigger = wrapper.querySelector('button, [role="combobox"], [aria-haspopup]') || wrapper;
  trigger.click();
  await delay(700);
  const pref = (preferredText || '').toLowerCase();
  for (let attempt = 0; attempt < 4; attempt++) {
    const options = Array.from(document.querySelectorAll(
      '[data-automation-id="promptOption"], [role="option"]'
    )).filter(o => o.offsetParent !== null);
    if (options.length) {
      const match = (pref && options.find(o => o.textContent?.trim().toLowerCase().includes(pref))) || options[0];
      if (match) { match.click(); await delay(300); return true; }
    }
    await delay(400);
  }
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  return false;
}

async function wdTypeCombobox(automationId, value) {
  if (!value) return false;
  const wrapper = document.querySelector(`[data-automation-id="${automationId}"]`);
  if (!wrapper) return false;
  const trigger = wrapper.querySelector('[role="combobox"], button[aria-haspopup]') || wrapper;
  trigger.click();
  await delay(400);
  const inp = wrapper.querySelector('input') || document.querySelector('[data-automation-id="searchBox"] input');
  if (inp) { wdSetValue(inp, value); await delay(700); }
  const valueLow = value.toLowerCase();
  const options  = Array.from(document.querySelectorAll(
    '[data-automation-id="promptOption"], [role="option"]'
  )).filter(o => o.offsetParent !== null);
  if (options.length) {
    const match = options.find(o => o.textContent?.trim().toLowerCase().includes(valueLow)) || options[0];
    if (match) { match.click(); await delay(300); return true; }
  }
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  return false;
}

async function fillWorkday(p) {
  let filled = 0;
  await waitForSelector('[data-automation-id]', 8000);
  await delay(2000);
  for (let step = 0; step < 15; step++) {
    const stepFilled = await fillWorkdayStep(p);
    filled += stepFilled;
    await delay(800);
    const nextBtn = findWorkdayNext();
    if (!nextBtn) break;
    const txt = (nextBtn.textContent || '').trim().toLowerCase();
    if (txt.includes('submit') || txt.includes('done') || txt.includes('review')) break;
    const urlBefore = window.location.href;
    nextBtn.click();
    await delay(2500);
    if (window.location.href !== urlBefore) break;
    await delay(500);
  }
  return { filled };
}

async function fillWorkdayStep(p) {
  let filled = 0;
  const textFields = [
    { id: 'legalNameSection_firstName',  val: p.firstName  },
    { id: 'legalNameSection_lastName',   val: p.lastName   },
    { id: 'firstName',                   val: p.firstName  },
    { id: 'lastName',                    val: p.lastName   },
    { id: 'emailAddress',                val: p.email      },
    { id: 'email',                       val: p.email      },
    { id: 'addressSection_addressLine1', val: p.location   },
    { id: 'addressSection_postalCode',   val: p.zipCode    },
    { id: 'linkedIn',                    val: p.linkedInUrl },
    { id: 'website',                     val: p.portfolioUrl },
  ];
  for (const { id, val } of textFields) {
    if (!val) continue;
    const el = wdInput(id);
    if (el && !el.value?.trim() && !el.disabled) { if (wdSetValue(el, val)) { filled++; await delay(50); } }
  }
  const phoneIds = ['phoneSection_phoneNumber', 'phone-number', 'phoneNumber', 'phone'];
  for (const id of phoneIds) {
    const el = wdInput(id);
    if (el && !el.value?.trim() && p.phone) {
      const digits = p.phone.replace(/^\+\d{1,3}[\s-]?/, '').replace(/\D/g, '');
      if (wdSetValue(el, digits || p.phone)) { filled++; break; }
    }
  }
  await wdPickListbox('phoneDeviceType', 'Mobile');
  const countrySelect = document.querySelector(
    'select[data-automation-id="addressSection_countryRegion"], select[data-automation-id*="country" i]'
  );
  if (countrySelect) setSelectValue(countrySelect, p.country || 'United States');
  else await wdPickListbox('addressSection_countryRegion', p.country || 'United States');
  if (p.state) {
    const stateSelect = document.querySelector(
      'select[data-automation-id="addressSection_stateProvince"], select[data-automation-id*="state" i]'
    );
    if (stateSelect) setSelectValue(stateSelect, p.state);
    else await wdTypeCombobox('addressSection_stateProvince', p.state);
  }
  const cityEl = wdInput('addressSection_city');
  if (cityEl && !cityEl.value?.trim() && p.city) {
    if (!wdSetValue(cityEl, p.city)) await wdTypeCombobox('addressSection_city', p.city);
    else filled++;
  }
  await wdPickListbox('howDidYouHearAboutUs', 'LinkedIn');
  await fillWorkdayRadios(p);
  filled += await smartScan(p);
  return filled;
}

async function fillWorkdayRadios(p) {
  const containers = document.querySelectorAll(
    '[data-automation-id*="radio" i], [role="radiogroup"], fieldset,' +
    '[data-automation-id*="yesNo" i], [data-automation-id*="boolean" i]'
  );
  for (const container of containers) {
    const questionText = (
      container.querySelector('label, legend, [data-automation-id*="label" i]')?.textContent ||
      container.previousElementSibling?.textContent || ''
    ).toLowerCase();
    if (!questionText) continue;
    let answer = null;
    if (/sponsor/i.test(questionText))                      answer = p.requireSponsorship ? 'yes' : 'no';
    if (/relocat/i.test(questionText))                      answer = p.willingToRelocate  ? 'yes' : 'no';
    if (/currently.*employ/i.test(questionText))            answer = 'no';
    if (/authorized|legally.*work|eligible.*work/i.test(questionText)) answer = 'yes';
    if (/18.*year|over.*18/i.test(questionText))            answer = 'yes';
    if (/background.*check/i.test(questionText))            answer = 'yes';
    if (/disability|veteran/i.test(questionText))           answer = null;
    if (!answer) continue;
    const radios = container.querySelectorAll('input[type="radio"]');
    let clicked = false;
    for (const r of radios) {
      const lbl = (getLabel(r) + ' ' + (r.value || '')).toLowerCase();
      if (lbl.includes(answer)) { if (!r.checked) { r.click(); r.dispatchEvent(new Event('change', { bubbles: true })); } clicked = true; break; }
    }
    if (!clicked) {
      const wdRadios = container.querySelectorAll('[role="radio"]');
      for (const r of wdRadios) {
        const lbl = (r.getAttribute('aria-label') || r.textContent || '').toLowerCase();
        if (lbl.includes(answer)) { r.click(); await delay(100); break; }
      }
    }
  }
}

function findWorkdayNext() {
  const ids = ['bottom-navigation-next-button', 'bottom-navigation-forward-button', 'nextButton', 'saveAndContinueButton'];
  for (const id of ids) {
    const el = document.querySelector(`[data-automation-id="${id}"]`);
    if (el && !el.disabled && el.offsetParent !== null) return el;
  }
  return Array.from(document.querySelectorAll('button')).find(b => {
    const t = (b.textContent || '').trim().toLowerCase();
    return (t === 'next' || t === 'continue' || t === 'save and continue') && !b.disabled && b.offsetParent !== null;
  }) || null;
}

async function fillIndeed(p) {
  let filled = 0;
  await waitForSelector('.ia-BasePage, #ia-container, [class*="IA-module"], [data-testid="ia-SmartApply"]', 10000);
  await delay(800);
  for (let step = 0; step < 12; step++) {
    await delay(500);
    const stepFilled = await fillIndeedStep(p);
    filled += stepFilled;
    await delay(300);
    await fillIndeedScreeners(p);
    await delay(200);
    const nextBtn = findIndeedNext();
    if (!nextBtn) break;
    const txt = (nextBtn.textContent || '').trim().toLowerCase();
    if (txt.includes('submit') || txt.includes('apply now') || txt.includes('review your application')) break;
    nextBtn.click();
    await delay(1000);
  }
  return { filled };
}

async function fillIndeedStep(p) {
  let filled = 0;
  const ariaFields = [
    { labels: ['First name', 'First Name'],                        val: p.firstName  },
    { labels: ['Last name', 'Last Name'],                          val: p.lastName   },
    { labels: ['Full name', 'Full Name', 'Name'],                  val: p.fullName   },
    { labels: ['Email', 'Email address', 'Email Address'],         val: p.email      },
    { labels: ['Phone number', 'Phone Number', 'Phone'],           val: p.phone      },
    { labels: ['City', 'Location', 'Home location', 'Home Location'], val: p.city || p.location },
    { labels: ['LinkedIn profile', 'LinkedIn URL', 'LinkedIn'],   val: p.linkedInUrl },
    { labels: ['Website', 'Portfolio', 'Personal website'],        val: p.portfolioUrl },
  ];
  for (const { labels, val } of ariaFields) {
    if (!val) continue;
    for (const label of labels) {
      const el = document.querySelector(`input[aria-label="${label}"]`) ||
                 document.querySelector(`input[aria-label*="${label}"]`);
      if (el && !el.value && !el.disabled) { setReactValue(el, val); filled++; break; }
    }
  }
  filled += await smartScan(p);
  return filled;
}

async function fillIndeedScreeners(p) {
  const groups = document.querySelectorAll('fieldset, [class*="screener"], [class*="Screener"], [class*="question"]');
  for (const group of groups) {
    const text = (group.querySelector('legend, [class*="title"], p, label')?.textContent || '').toLowerCase();
    let answer = null;
    if (/authorized|legally.*work|eligible.*work/i.test(text))  answer = 'yes';
    if (/require.*sponsor|need.*sponsor/i.test(text))           answer = p.requireSponsorship ? 'yes' : 'no';
    if (/relocat/i.test(text))                                  answer = p.willingToRelocate  ? 'yes' : 'no';
    if (/18.*year|over.*18|adult/i.test(text))                  answer = 'yes';
    if (/background.*check/i.test(text))                        answer = 'yes';
    if (/full.?time/i.test(text))                               answer = 'yes';
    if (/driver.?licen/i.test(text))                            answer = 'yes';
    if (!answer) continue;
    const radios = group.querySelectorAll('input[type="radio"]');
    for (const r of radios) {
      const lbl = (getLabel(r) + ' ' + (r.value || '')).toLowerCase();
      if (lbl.includes(answer)) { if (!r.checked) r.click(); break; }
    }
  }
}

function findIndeedNext() {
  const selectors = ['[data-testid="ia-continueButton"]', '[class*="ContinueButton"]', 'button[id*="continue" i]', 'button[data-dd-action-name*="continue" i]'];
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el && !el.disabled && el.offsetParent !== null) return el;
  }
  return Array.from(document.querySelectorAll('button')).find(b => {
    const t = (b.textContent || '').trim().toLowerCase();
    return (t === 'continue' || t === 'next') && !b.disabled && b.offsetParent !== null;
  }) || null;
}

async function fillAshby(p) {
  let filled = 0;
  const exact = [
    { sel: 'input[name="firstName"], input[name="first_name"]', val: p.firstName },
    { sel: 'input[name="lastName"],  input[name="last_name"]',  val: p.lastName  },
    { sel: 'input[name="email"],     input[type="email"]',      val: p.email     },
    { sel: 'input[name="phone"],     input[type="tel"]',        val: p.phone     },
    { sel: 'input[name="location"],  input[name="city"]',       val: p.location  },
    { sel: 'input[name="linkedin"],  input[name="linkedinUrl"]',val: p.linkedInUrl },
    { sel: 'input[name="github"],    input[name="githubUrl"]',  val: p.githubUrl },
    { sel: 'input[name="website"],   input[name="portfolio"]',  val: p.portfolioUrl },
  ];
  for (const { sel, val } of exact) {
    if (!val) continue;
    for (const s of sel.split(',')) {
      const el = document.querySelector(s.trim());
      if (el && !el.value && !el.disabled) { setReactValue(el, val); filled++; break; }
    }
  }
  filled += await smartScan(p);
  return { filled };
}

async function fillICims(p) {
  let filled = 0;
  const patterns = [
    { re: /firstname|fname|first.name/i, val: p.firstName },
    { re: /lastname|lname|last.name/i,   val: p.lastName  },
    { re: /email/i,                       val: p.email     },
    { re: /phone/i,                       val: p.phone     },
    { re: /address|addr1|addressLine1/i, val: p.location  },
    { re: /city/i,                        val: p.city      },
    { re: /zip|postal/i,                  val: p.zipCode   },
    { re: /linkedin/i,                    val: p.linkedInUrl },
  ];
  const inputs = document.querySelectorAll('#iCIMS_MainColumn input[type="text"], #iCIMS_MainColumn input[type="email"], #iCIMS_MainColumn input[type="tel"]');
  for (const inp of inputs) {
    if (inp.value || inp.disabled) continue;
    const hint = (inp.id || '').toLowerCase() + ' ' + (inp.name || '').toLowerCase();
    for (const { re, val } of patterns) {
      if (!val) continue;
      if (re.test(hint) || re.test(getLabel(inp).toLowerCase())) { setReactValue(inp, val); filled++; break; }
    }
  }
  const stateEl = document.querySelector('select[id*="state" i], select[name*="state" i]');
  if (stateEl && p.state) setSelectValue(stateEl, p.state);
  filled += await smartScan(p);
  return { filled };
}

async function fillJobvite(p) {
  let filled = 0;
  const exact = [
    { sel: 'input[id*="firstName" i], input[name*="firstName" i]', val: p.firstName },
    { sel: 'input[id*="lastName" i],  input[name*="lastName" i]',  val: p.lastName  },
    { sel: 'input[id*="email" i],     input[type="email"]',        val: p.email     },
    { sel: 'input[id*="phone" i],     input[type="tel"]',          val: p.phone     },
    { sel: 'input[id*="linkedin" i]',                              val: p.linkedInUrl },
    { sel: 'input[id*="github" i]',                                val: p.githubUrl  },
    { sel: 'input[id*="website" i],   input[id*="portfolio" i]',   val: p.portfolioUrl },
  ];
  for (const { sel, val } of exact) {
    if (!val) continue;
    for (const s of sel.split(',')) {
      const el = document.querySelector(s.trim());
      if (el && !el.value && !el.disabled) { setReactValue(el, val); filled++; break; }
    }
  }
  filled += await smartScan(p);
  return { filled };
}

function srQueryAll(selector, root = document) {
  const results = [];
  try { results.push(...root.querySelectorAll(selector)); } catch {}
  const all = root.querySelectorAll ? root.querySelectorAll('*') : [];
  for (const el of all) {
    if (el.shadowRoot) results.push(...srQueryAll(selector, el.shadowRoot));
  }
  return results;
}
function srQuery(selector, root = document) { return srQueryAll(selector, root)[0] || null; }

function srSetValue(el, value) {
  if (!el || el.disabled || el.readOnly) return false;
  try {
    const proto  = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, value); else el.value = value;
    el.dispatchEvent(new Event('input',  { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur',   { bubbles: true }));
    return true;
  } catch { return false; }
}

function srGetLabel(el) {
  if (el.id) {
    const root = el.getRootNode();
    const lbl  = root.querySelector?.(`label[for="${CSS.escape(el.id)}"]`);
    if (lbl) return lbl.textContent?.trim() || '';
  }
  if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
  if (el.placeholder)               return el.placeholder;
  const container = el.closest('[data-test], .form-group, .field, label');
  if (container) {
    const lbl = container.querySelector('label');
    if (lbl && !lbl.contains(el)) return lbl.textContent?.trim() || '';
  }
  return el.name || el.id || '';
}

async function fillSmartRecruiters(p) {
  await delay(2000);
  await waitForShadowElement('oc-personal-information, [data-test="personal-information"]', 10000);
  await delay(1000);
  let filled = 0;
  const allInputs  = srQueryAll('input:not([type="hidden"]):not([type="file"]):not([type="submit"])');
  const allSelects = srQueryAll('select');
  const fieldDefs = [
    { val: p.firstName,    tests: [(el) => /first.?name|given/i.test(srGetLabel(el)), (el) => el.getAttribute('data-test') === 'firstName', (el) => el.name === 'firstName' || el.id === 'firstName'] },
    { val: p.lastName,     tests: [(el) => /last.?name|surname/i.test(srGetLabel(el)), (el) => el.getAttribute('data-test') === 'lastName',  (el) => el.name === 'lastName'  || el.id === 'lastName'  ] },
    { val: p.email,        tests: [(el) => el.type === 'email', (el) => /email/i.test(srGetLabel(el)), (el) => el.name === 'email' || el.id === 'email'] },
    { val: p.phone,        tests: [(el) => el.type === 'tel',   (el) => /phone|mobile/i.test(srGetLabel(el)), (el) => el.name === 'phone' || el.name === 'phoneNumber'] },
    { val: p.city,         tests: [(el) => /\bcity\b/i.test(srGetLabel(el)), (el) => el.name === 'city' || el.id === 'city'] },
    { val: p.zipCode,      tests: [(el) => /zip|postal/i.test(srGetLabel(el)), (el) => el.name === 'zipCode' || el.name === 'zip'] },
    { val: p.linkedInUrl,  tests: [(el) => /linkedin/i.test(srGetLabel(el)),  (el) => el.name === 'web-linkedIn' || el.name === 'linkedin'] },
    { val: p.githubUrl,    tests: [(el) => /github/i.test(srGetLabel(el)),    (el) => el.name === 'web-github'   || el.name === 'github'   ] },
    { val: p.portfolioUrl, tests: [(el) => /website|portfolio/i.test(srGetLabel(el)), (el) => el.name === 'web-website' || el.name === 'website'] },
  ];
  for (const { val, tests } of fieldDefs) {
    if (!val) continue;
    for (const input of allInputs) {
      if (input.value?.trim() || input.disabled) continue;
      if (tests.some(test => { try { return test(input); } catch { return false; } })) {
        if (srSetValue(input, val)) { filled++; break; }
      }
    }
  }
  for (const sel of allSelects) {
    if (sel.value && sel.value !== '' && sel.value !== '0') continue;
    const lbl = srGetLabel(sel).toLowerCase();
    if (/country/i.test(lbl))              setSelectValue(sel, p.country || 'United States');
    else if (/state|province/i.test(lbl))  setSelectValue(sel, p.state || '');
  }
  const allTextareas = srQueryAll('textarea:not([disabled])');
  for (const ta of allTextareas) {
    if (ta.value?.trim()) continue;
    const lbl = srGetLabel(ta).toLowerCase();
    if (/cover.?letter/i.test(lbl)) continue;
    if (/summary|about|message/i.test(lbl) && p.summary) { srSetValue(ta, p.summary); filled++; }
  }
  return { filled };
}

function waitForShadowElement(selector, timeout = 8000) {
  return new Promise(resolve => {
    if (srQuery(selector)) { resolve(); return; }
    let elapsed = 0;
    const interval = setInterval(() => {
      elapsed += 200;
      if (srQuery(selector) || elapsed >= timeout) { clearInterval(interval); resolve(); }
    }, 200);
  });
}

async function fillBambooHR(p) {
  let filled = 0;
  const exact = [
    { sel: '#firstName,   input[name="firstName"]',  val: p.firstName  },
    { sel: '#lastName,    input[name="lastName"]',   val: p.lastName   },
    { sel: '#email,       input[name="email"]',      val: p.email      },
    { sel: '#phone,       input[name="phone"]',      val: p.phone      },
    { sel: '#address,     input[name="address"]',    val: p.location   },
    { sel: '#city,        input[name="city"]',       val: p.city       },
    { sel: '#state,       input[name="state"]',      val: p.state      },
    { sel: '#zip,         input[name="zip"]',        val: p.zipCode    },
    { sel: 'input[id*="linkedin" i]',                val: p.linkedInUrl },
  ];
  for (const { sel, val } of exact) {
    if (!val) continue;
    for (const s of sel.split(',')) {
      const el = document.querySelector(s.trim());
      if (el && !el.value && !el.disabled) { setReactValue(el, val); filled++; break; }
    }
  }
  filled += await smartScan(p);
  return { filled };
}

async function fillTaleo(p) {
  const filled = await smartScan(p);
  return { filled };
}

async function fillRecruitee(p) {
  let filled = 0;
  const exact = [
    { sel: 'input[name*="first_name" i], input[id*="first" i]', val: p.firstName },
    { sel: 'input[name*="last_name" i],  input[id*="last" i]',  val: p.lastName  },
    { sel: 'input[name*="email" i],      input[type="email"]',  val: p.email     },
    { sel: 'input[name*="phone" i],      input[type="tel"]',    val: p.phone     },
    { sel: 'input[name*="linkedin" i]',                         val: p.linkedInUrl },
    { sel: 'input[name*="github" i]',                           val: p.githubUrl  },
    { sel: 'input[name*="website" i]',                          val: p.portfolioUrl },
  ];
  for (const { sel, val } of exact) {
    if (!val) continue;
    for (const s of sel.split(',')) {
      const el = document.querySelector(s.trim());
      if (el && !el.value && !el.disabled) { setReactValue(el, val); filled++; break; }
    }
  }
  filled += await smartScan(p);
  return { filled };
}

async function fillWellfound(p) {
  let filled = 0;
  const exact = [
    { sel: 'input[name*="first_name" i], input[name*="firstName" i]', val: p.firstName },
    { sel: 'input[name*="last_name" i],  input[name*="lastName" i]',  val: p.lastName  },
    { sel: 'input[name*="email" i],      input[type="email"]',         val: p.email     },
    { sel: 'input[name*="phone" i],      input[type="tel"]',           val: p.phone     },
    { sel: 'input[name*="linkedin" i]',                                val: p.linkedInUrl },
    { sel: 'input[name*="github" i]',                                  val: p.githubUrl  },
    { sel: 'input[name*="website" i]',                                 val: p.portfolioUrl },
  ];
  for (const { sel, val } of exact) {
    if (!val) continue;
    for (const s of sel.split(',')) {
      const el = document.querySelector(s.trim());
      if (el && !el.value && !el.disabled) { setReactValue(el, val); filled++; break; }
    }
  }
  filled += await smartScan(p);
  return { filled };
}

// ─────────────────────────────────────────────────────────────────
// Smart scan — handles all field types including checkboxes
// ─────────────────────────────────────────────────────────────────
async function smartScan(p) {
  const root = document;
  let filled = 0;

  // ── Text inputs ───────────────────────────────────────────────────
  const inputs = root.querySelectorAll(
    'input:not([type="hidden"]):not([type="file"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([disabled]):not([readonly])'
  );
  for (const inp of inputs) {
    if (inp.value && inp.value.trim() !== '') continue;
    const lbl = getLabel(inp);
    let val   = matchByLabel(lbl, p);
    if (val === null || val === undefined || String(val).trim() === '') continue;
    val = String(val);
    if (inp.type === 'number' || inp.getAttribute('inputmode') === 'numeric') {
      val = rangeToSingleNumber(val);
    }
    if (/year/i.test(lbl) && val.includes('-')) {
      val = rangeToSingleNumber(val);
    }
    setReactValue(inp, val);
    filled++;
  }

  // ── Native selects ─────────────────────────────────────────────────
  const selects = root.querySelectorAll('select:not([disabled])');
  for (const sel of selects) {
    if (sel.value && sel.value !== '' && sel.value !== '0' && sel.value !== 'null') continue;
    const lbl = getLabel(sel);
    const val = matchSelectByLabel(lbl, p);
    if (val) setSelectValue(sel, val);
  }

  // ── Custom div-based dropdowns (React-Select, Greenhouse screeners, etc.) ──
  const customDropdownTriggers = root.querySelectorAll(
    '[class*="control"]:not(input):not(select),' +
    '[role="combobox"]:not(input):not(select),' +
    '[class*="select" i]:not(select):not(option):not(input),' +
    '[class*="Select" i]:not(select):not(option):not(input),' +
    '[class*="dropdown" i]:not(select):not(input)'
  );

  for (const trigger of customDropdownTriggers) {
    if (trigger.closest('select')) continue;
    if (trigger.querySelector('select, input[type="hidden"]')?.value &&
        trigger.querySelector('select, input[type="hidden"]').value !== '') continue;

    const placeholderText = (
      trigger.querySelector('[class*="placeholder" i], [class*="Placeholder" i]')?.textContent ||
      trigger.textContent || ''
    ).trim().toLowerCase();
    const looksEmpty = placeholderText.startsWith('select') || placeholderText === '' || placeholderText === '—';
    if (!looksEmpty) continue;

    const lbl = getCustomDropdownLabel(trigger);
    if (!lbl || lbl.length < 3) continue;

    const val = matchSelectByLabel(lbl, p);
    if (!val) continue;

    const didFill = await fillCustomDropdown(trigger, val);
    if (didFill) { filled++; console.log(`  📦 Custom dropdown "${lbl.slice(0,50)}" → "${val}"`); }
  }

  // ── Textareas ─────────────────────────────────────────────────────
  const textareas = root.querySelectorAll('textarea:not([disabled])');
  for (const ta of textareas) {
    if (ta.value && ta.value.trim().length > 10) continue;
    const lbl = getLabel(ta).toLowerCase();
    if (/cover.?letter|covering letter/i.test(lbl)) continue;
    const val = matchByLabel(lbl, p);
    if (val) { setReactValue(ta, String(val)); filled++; }
  }

  // ── Radio groups ──────────────────────────────────────────────────
  const groups = root.querySelectorAll('[role="radiogroup"], fieldset');
  for (const g of groups) {
    const legend = (g.querySelector('legend, [role="group"] label, p')?.textContent || '').toLowerCase();
    let answer = null;
    if (/sponsor/i.test(legend))                               answer = p.requireSponsorship ? 'yes' : 'no';
    if (/relocat/i.test(legend))                               answer = p.willingToRelocate  ? 'yes' : 'no';
    if (/authoriz|legally.*work|eligible.*work/i.test(legend)) answer = 'yes';
    if (/currently employ/i.test(legend))                      answer = 'yes';
    if (/18.*year|adult/i.test(legend))                        answer = 'yes';
    if (/veteran/i.test(legend))                               answer = p.veteranStatus    || 'not a protected veteran';
    if (/disabilit/i.test(legend))                             answer = p.disabilityStatus || 'no';
    if (!answer) continue;
    const isDecline = /veteran|disabilit/i.test(legend);
    const radios = g.querySelectorAll('input[type="radio"]');
    for (const r of radios) {
      const lbl = (getLabel(r) + ' ' + (r.value || '')).toLowerCase();
      if (isDecline) {
        if (/not a.*veteran|not.*protected|i don|no.*disab|prefer not|decline|choose not|i do not have/i.test(lbl)) {
          if (!r.checked) r.click(); break;
        }
      } else {
        if (lbl.includes(answer)) { if (!r.checked) r.click(); break; }
      }
    }
  }

  // ── Checkboxes ────────────────────────────────────────────────────
  const allCheckboxes = root.querySelectorAll('input[type="checkbox"]:not([disabled])');

  for (const cb of allCheckboxes) {
    if (cb.checked) continue;

    const cbLbl         = getCbLabel(cb).toLowerCase().trim();
    const questionLabel = getCheckboxGroupLabel(cb).toLowerCase().trim();
    const fullText      = (questionLabel + ' ' + cbLbl).trim();

    // ── Pronouns ──────────────────────────────────────────────────
    if (/pronoun/i.test(questionLabel) && p.pronouns && p.pronouns !== 'Prefer not to say') {
      const target  = p.pronouns.toLowerCase().replace(/\s*\/\s*/g, '/').replace(/\s+/g, '');
      const cbNorm  = cbLbl.replace(/\s*\/\s*/g, '/').replace(/\s+/g, '');
      if (target.split('/')[0] && cbNorm.split('/')[0] && target.split('/')[0] === cbNorm.split('/')[0]) {
        cb.click(); cb.dispatchEvent(new Event('change', { bubbles: true })); filled++;
      }
      continue;
    }

    // ── Gender ────────────────────────────────────────────────────
    if (/gender|sex\b/i.test(questionLabel) && p.gender && p.gender !== 'Prefer not to say') {
      const target = p.gender.toLowerCase();
      if (cbLbl.includes(target.split(' ')[0]) || target.includes(cbLbl.split(' ')[0])) {
        cb.click(); cb.dispatchEvent(new Event('change', { bubbles: true })); filled++;
      }
      continue;
    }

    // ── Race / Ethnicity ──────────────────────────────────────────
    if (/race|ethnicit/i.test(questionLabel) && p.race && p.race !== 'Prefer not to say') {
      const target = p.race.toLowerCase();
      if (cbLbl.includes(target.split(' ')[0]) || target.includes(cbLbl.split(' ')[0])) {
        cb.click(); cb.dispatchEvent(new Event('change', { bubbles: true })); filled++;
      }
      continue;
    }

    // ── Veteran ───────────────────────────────────────────────────
    if (/veteran|military/i.test(questionLabel)) {
      if (/not a.*veteran|not.*protected|prefer not|decline|choose not|i don|i am not/i.test(cbLbl)) {
        cb.click(); cb.dispatchEvent(new Event('change', { bubbles: true })); filled++;
      }
      continue;
    }

    // ── Disability ────────────────────────────────────────────────
    if (/disabilit/i.test(questionLabel)) {
      if (/no.*disab|i do not|prefer not|decline|choose not|not.*disab|i am not/i.test(cbLbl)) {
        cb.click(); cb.dispatchEvent(new Event('change', { bubbles: true })); filled++;
      }
      continue;
    }

    // ── Skills / Tech ─────────────────────────────────────────────
    if (/skills?|technologies|tech.?stack|expertise/i.test(questionLabel) && p.skills?.length) {
      const skillList = (Array.isArray(p.skills) ? p.skills : String(p.skills).split(',')).map(s => s.trim().toLowerCase());
      if (skillList.some(s => s && cbLbl && (s === cbLbl || cbLbl.includes(s) || s.includes(cbLbl)))) {
        cb.click(); cb.dispatchEvent(new Event('change', { bubbles: true })); filled++;
      }
      continue;
    }

    // ── Work/Employment type ───────────────────────────────────────
    if (/work.*type|employment.*type|job.*type|work.*arrangement/i.test(questionLabel)) {
      const target = (p.workType || p.employmentType || '').toLowerCase();
      if (target && (cbLbl.includes(target.split(/[-\s]/)[0]) || target.includes(cbLbl))) {
        cb.click(); cb.dispatchEvent(new Event('change', { bubbles: true })); filled++;
      }
      continue;
    }

    // ── Screener yes/no checkbox groups ───────────────────────────
    // Handles cases like a question "Are you authorized to work?" with
    // separate Yes / No checkboxes (common on Greenhouse, Ashby, generic forms)
    if (questionLabel && questionLabel.length >= 3) {
      let screenerAnswer = null;

      if (/authorized|legally.*work|eligible.*work|right.*work/i.test(fullText))   screenerAnswer = true;
      if (/require.*sponsor|need.*sponsor/i.test(fullText))                         screenerAnswer = p.requireSponsorship ?? false;
      if (/willing.*relocat|open.*relocat/i.test(fullText))                         screenerAnswer = p.willingToRelocate  ?? false;
      if (/18.*year|over.*18|legal.*age|\bof age\b/i.test(fullText))               screenerAnswer = true;
      if (/background.?check/i.test(fullText))                                      screenerAnswer = p.backgroundCheck ?? true;
      if (/drug.?test|substance/i.test(fullText))                                   screenerAnswer = p.drugTest ?? true;
      if (/driver.?licen/i.test(fullText))                                          screenerAnswer = p.driverLicense ?? true;
      if (/full.?time/i.test(fullText))                                             screenerAnswer = true;
      if (/currently.*employ/i.test(fullText))                                      screenerAnswer = p.currentlyEmployed ?? false;
      if (/previously.*applied|applied.*before/i.test(fullText))                    screenerAnswer = false;

      if (screenerAnswer !== null) {
        const isYesCheckbox = /^yes$|^yes[\s,\b]/i.test(cbLbl);
        const isNoCheckbox  = /^no$|^no[\s,\b]/i.test(cbLbl);

        if (screenerAnswer === true  && isYesCheckbox) {
          cb.click(); cb.dispatchEvent(new Event('change', { bubbles: true })); filled++;
        } else if (screenerAnswer === false && isNoCheckbox) {
          cb.click(); cb.dispatchEvent(new Event('change', { bubbles: true })); filled++;
        } else if (!isYesCheckbox && !isNoCheckbox && screenerAnswer === true) {
          // Single checkbox for this question (not a yes/no split) — check it
          cb.click(); cb.dispatchEvent(new Event('change', { bubbles: true })); filled++;
        }
        continue;
      }
    }

    // ── Consent / agreement standalone checkboxes ─────────────────
    let shouldCheck = null;

    if (/i agree|i consent|i acknowledge|i certify|i confirm|i understand|i accept/i.test(fullText))  shouldCheck = true;
    else if (/terms.*service|terms.*use|privacy.?polic|data.*polic|eula|cookie.*polic/i.test(fullText)) shouldCheck = true;
    else if (/background.?check/i.test(fullText))            shouldCheck = p.backgroundCheck  ?? true;
    else if (/drug.?test|substance/i.test(fullText))         shouldCheck = p.drugTest         ?? true;
    else if (/18.*year|over.*18|\bof age\b/i.test(fullText)) shouldCheck = p.over18           ?? true;
    else if (/driver.?licen/i.test(fullText))                shouldCheck = p.driverLicense    ?? true;
    else if (/authorized|eligible.*work|right.*work|legally.*work/i.test(fullText)) shouldCheck = true;
    else if (/full.?time|open.*work|available.*work|actively.*seek/i.test(fullText)) shouldCheck = true;
    else if (/sponsor/i.test(fullText))                      shouldCheck = p.requireSponsorship ?? false;
    else if (/relocat/i.test(fullText))                      shouldCheck = p.willingToRelocate  ?? false;
    // Don't auto-opt into newsletters/marketing emails
    else if (/receive.*email|email.*update|newsletter|job.*alert|marketing/i.test(fullText)) shouldCheck = false;

    if (shouldCheck === true) {
      cb.click(); cb.dispatchEvent(new Event('change', { bubbles: true })); filled++;
    }
  }

  return filled;
}

// ── Get the question label for a checkbox's group ─────────────────
function getCheckboxGroupLabel(cb) {
  let node = cb.parentElement;
  for (let i = 0; i < 7; i++) {
    if (!node || node === document.body) break;

    if (node.tagName === 'FIELDSET') {
      const legend = node.querySelector(':scope > legend');
      if (legend) return legend.textContent || '';
    }

    if (node.getAttribute?.('role') === 'group') {
      const lid = node.getAttribute('aria-labelledby');
      if (lid) { const el = document.getElementById(lid); if (el) return el.textContent || ''; }
      const al = node.getAttribute('aria-label');
      if (al) return al;
    }

    let sib = node.previousElementSibling;
    while (sib) {
      const tag = sib.tagName?.toLowerCase();
      const cls = (sib.className || '').toLowerCase();
      const isLabel = tag === 'label' || tag === 'legend' || /^h[1-6]$/.test(tag) ||
                      /\blabel\b|\bheading\b|\btitle\b|\bquestion\b|\bprompt\b/.test(cls);
      if (isLabel && !sib.querySelector('input, select, textarea')) {
        const text = (sib.textContent || '').trim();
        if (text && text.length > 1 && text.length < 120) return text;
      }
      sib = sib.previousElementSibling;
    }

    const parent = node.parentElement;
    if (parent) {
      const candidate = parent.querySelector('label:not(:has(input)):not(:has(select)), legend, h2, h3, h4');
      if (candidate && !candidate.contains(cb)) {
        const text = (candidate.textContent || '').trim();
        if (text && text.length > 1 && text.length < 120) return text;
      }
    }

    node = node.parentElement;
  }
  return '';
}

// ── Get the label text for a single checkbox ──────────────────────
function getCbLabel(cb) {
  const wrap = cb.closest('label');
  if (wrap) return (wrap.textContent || '').replace(/\s+/g, ' ').trim();
  if (cb.id) {
    const lbl = document.querySelector(`label[for="${CSS.escape(cb.id)}"]`);
    if (lbl) return (lbl.textContent || '').trim();
  }
  if (cb.getAttribute('aria-label')) return cb.getAttribute('aria-label');
  if (cb.getAttribute('aria-labelledby')) {
    const ids = cb.getAttribute('aria-labelledby').split(' ');
    return ids.map(id => document.getElementById(id)?.textContent?.trim()).filter(Boolean).join(' ');
  }
  const next = cb.nextElementSibling;
  if (next && next.tagName !== 'INPUT') return (next.textContent || '').trim();
  return (cb.parentElement?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);
}

// ─────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function waitForSelector(selector, timeout = 6000) {
  return new Promise(resolve => {
    if (document.querySelector(selector)) { resolve(); return; }
    const obs = new MutationObserver(() => {
      if (document.querySelector(selector)) { obs.disconnect(); resolve(); }
    });
    obs.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => { obs.disconnect(); resolve(); }, timeout);
  });
}

// ─────────────────────────────────────────────────────────────────
// Main dispatch
// ─────────────────────────────────────────────────────────────────
async function fillForm(profile, platform) {
  console.log(`🤖 Filling ${platform} form…`);
  let result;
  switch (platform) {
    case 'greenhouse':      result = await fillGreenhouse(profile);      break;
    case 'lever':           result = await fillLever(profile);           break;
    case 'workday':         result = await fillWorkday(profile);         break;
    case 'indeed':          result = await fillIndeed(profile);          break;
    case 'ashby':           result = await fillAshby(profile);           break;
    case 'icims':           result = await fillICims(profile);           break;
    case 'jobvite':         result = await fillJobvite(profile);         break;
    case 'smartrecruiters': result = await fillSmartRecruiters(profile); break;
    case 'bamboohr':        result = await fillBambooHR(profile);        break;
    case 'taleo':           result = await fillTaleo(profile);           break;
    case 'recruitee':       result = await fillRecruitee(profile);       break;
    case 'wellfound':       result = await fillWellfound(profile);       break;
    default:                result = { filled: await smartScan(profile) };
  }
  console.log(`✅ Filled ${result.filled} fields on ${platform}`);
  return result;
}

// ─────────────────────────────────────────────────────────────────
// Floating sidebar
// ─────────────────────────────────────────────────────────────────
class PreciprocalSidebar {
  constructor() {
    this.platform   = detectPlatform();
    this.isAuth     = false;
    this.authToken  = null;
    this.authEmail  = null;
    this.authUserId = null;
    this.profile    = null;
    this.files      = null;
    this.state      = 'idle';
  }

  async init() {
    if (!isApplicationPage()) {
      console.log('ℹ️ Not an application page — skipping sidebar');
      return;
    }
    await this._checkAuth();
    this._injectStyles();
    this._render();

    // ── START JOB TRACKER — runs silently on every application page ──
    watchForApplicationSuccess(this.platform);

    console.log(`✅ Preciprocal sidebar on ${this.platform}`);
  }

  async _checkAuth() {
    try {
      const resp      = await chrome.runtime.sendMessage({ type: 'CHECK_AUTH' });
      this.isAuth     = resp.authenticated;
      this.authUserId = resp.user?.uid || resp.user?.userId || null;
      this.authEmail  = resp.user?.email || null;
      const tk        = await chrome.runtime.sendMessage({ type: 'GET_TOKEN' });
      this.authToken  = tk.token || tk.idToken || null;
      if (!this.authToken && this.authUserId) this.authToken = this.authUserId;
    } catch (e) {
      console.warn('⚠️ Auth check failed:', e.message);
    }
  }

  _platformLabel() {
    return {
      greenhouse:      '🌿 Greenhouse',
      lever:           '🎚️ Lever',
      workday:         '☁️ Workday',
      indeed:          '🔵 Indeed',
      ashby:           '🔷 Ashby',
      icims:           '🔵 iCIMS',
      jobvite:         '📋 Jobvite',
      smartrecruiters: '🧠 SmartRecruiters',
      taleo:           '🟦 Taleo',
      bamboohr:        '🎋 BambooHR',
      recruitee:       '🔹 Recruitee',
      wellfound:       '🚀 Wellfound',
      generic:         '📄 Application',
    }[this.platform] || '📄 Application';
  }

  _render() {
    document.getElementById('prc-sidebar')?.remove();
    const sidebar = document.createElement('div');
    sidebar.id = 'prc-sidebar';

    const platformName = this._platformLabel().replace(/^[^\s]+\s/, ''); // strip emoji

    sidebar.innerHTML = `
      <div id="prc-sidebar-inner">

        <!-- Header -->
        <div class="prc-sb-header">
          <div class="prc-sb-brand">
            <svg width="18" height="18" viewBox="0 0 64 64" fill="none">
              <path d="M32 10L54 32L32 54L10 32L32 10Z" fill="white" opacity="0.9"/>
              <path d="M32 22L42 32L32 42L22 32L32 22Z" fill="white"/>
            </svg>
            <span class="prc-sb-name">Preciprocal</span>
          </div>
          <button class="prc-sb-collapse" id="prc-collapse-btn" title="Collapse">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7"/></svg>
          </button>
        </div>

        <!-- Body -->
        <div class="prc-sb-body">

          ${!this.isAuth ? `

            <!-- Unauthenticated -->
            <div class="prc-sb-hero">
              <p class="prc-sb-hero-title">Apply with Preciprocal</p>
              <p class="prc-sb-hero-sub">Auto-fill any job application in seconds using your profile.</p>
            </div>

            <div class="prc-sb-checklist">
              <div class="prc-sb-check-item">
                <div class="prc-sb-check-icon">
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>
                </div>
                <span>Create your Preciprocal account</span>
                <button class="prc-sb-go" id="prc-signin-btn">GO</button>
              </div>
              <div class="prc-sb-check-item prc-sb-check-dim">
                <div class="prc-sb-check-icon">
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>
                </div>
                <span>Complete your profile</span>
                <div class="prc-sb-go prc-sb-go-dim">GO</div>
              </div>
            </div>

            <button class="prc-sb-cta prc-sb-cta-disabled">Start Applying</button>

          ` : `

            <!-- Authenticated -->
            <div class="prc-sb-hero">
              <p class="prc-sb-hero-title">Apply with Preciprocal</p>
              <p class="prc-sb-hero-sub">Auto-fill this ${platformName} application using your profile.</p>
            </div>

            <div id="prc-fill-status" class="prc-sb-status" style="display:none;"></div>
            <div id="prc-file-status" class="prc-sb-file-status" style="display:none;">
              <div id="prc-resume-status" class="prc-sb-file-row"></div>
              <div id="prc-transcript-status" class="prc-sb-file-row"></div>
            </div>

            <button class="prc-sb-cta" id="prc-autofill-btn">
              <span id="prc-fill-icon">
                <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
              </span>
              <span id="prc-fill-label">Start Applying</span>
            </button>

            <div class="prc-sb-actions">
              <button class="prc-sb-link" id="prc-rerun-btn">Re-run fill</button>
              <span class="prc-sb-dot">·</span>
              <button class="prc-sb-link prc-sb-link-dim" id="prc-debug-btn">Debug</button>
            </div>

          `}
        </div>

      </div>

      <!-- Collapsed tab -->
      <button id="prc-expand-btn" class="prc-sb-tab" title="Open Preciprocal">
        <svg width="14" height="14" viewBox="0 0 64 64" fill="none">
          <path d="M32 10L54 32L32 54L10 32L32 10Z" fill="white" opacity="0.9"/>
          <path d="M32 22L42 32L32 42L22 32L32 22Z" fill="white"/>
        </svg>
      </button>
    `;

    document.body.appendChild(sidebar);
    this._listen();
  }

  _listen() {
    document.getElementById('prc-collapse-btn')?.addEventListener('click', () => {
      document.getElementById('prc-sidebar-inner').style.display = 'none';
      document.getElementById('prc-expand-btn').style.display    = 'flex';
    });
    document.getElementById('prc-expand-btn')?.addEventListener('click', () => {
      document.getElementById('prc-sidebar-inner').style.display = 'flex';
      document.getElementById('prc-expand-btn').style.display    = 'none';
    });
    document.getElementById('prc-signin-btn')?.addEventListener('click',   () => window.open(`${PRECIPROCAL_URL}/sign-in`, '_blank'));
    document.getElementById('prc-autofill-btn')?.addEventListener('click', () => this._run());
    document.getElementById('prc-rerun-btn')?.addEventListener('click',    () => this._rerun());
    document.getElementById('prc-debug-btn')?.addEventListener('click',    () => this._debug());
  }

  async _run() {
    if (this.state === 'loading') return;
    const btn      = document.getElementById('prc-autofill-btn');
    const label    = document.getElementById('prc-fill-label');
    const icon     = document.getElementById('prc-fill-icon');
    const statusEl = document.getElementById('prc-fill-status');
    const fileEl   = document.getElementById('prc-file-status');

    this.state = 'loading';
    btn?.classList.add('loading');
    if (label) label.textContent = 'Loading profile…';
    if (icon)  icon.innerHTML    = '<span class="prc-sb-spinner"></span>';

    try {
      if (!this.profile) {
        try {
          const s   = await chrome.storage.local.get(['preciprocal_auto_apply_profile', 'preciprocal_auto_apply_timestamp', 'preciprocal_auto_apply_files']);
          const age = Date.now() - (s.preciprocal_auto_apply_timestamp || 0);
          if (s.preciprocal_auto_apply_profile && age < 5 * 60 * 1000) {
            this.profile = s.preciprocal_auto_apply_profile;
            this.files   = s.preciprocal_auto_apply_files || null;
          }
        } catch {}
      }

      if (!this.profile) {
        if (!this.authToken) throw new Error('Not signed in — open the extension and sign in first');
        if (label) label.textContent = 'Fetching profile…';
        const res = await fetch(`${PRECIPROCAL_URL}/api/extension/auto-apply`, {
          headers: { 'x-extension-token': this.authToken, 'x-user-email': this.authEmail || '', 'x-user-id': this.authUserId || '' },
        });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || `HTTP ${res.status}`); }
        const data   = await res.json();
        this.profile = data.applyProfile;
        this.files   = data.files || null;
      }

      if (!this.profile) throw new Error('Profile unavailable');

      try {
        await chrome.storage.local.set({
          preciprocal_auto_apply_profile:   this.profile,
          preciprocal_auto_apply_files:     this.files || null,
          preciprocal_auto_apply_timestamp: Date.now(),
        });
      } catch {}

      if (label) label.textContent = 'Finding Apply button…';
      const onDetailPage = isJobDetailPage();
      if (onDetailPage) {
        const clicked = await clickApplyAndWaitForForm(statusEl);
        if (!clicked) {
          if (label) label.textContent = 'Opening application…';
          if (icon)  icon.textContent  = '🔗';
          btn?.classList.remove('loading');
          if (statusEl) {
            statusEl.style.display = 'block';
            statusEl.className = 'prc-sb-status info';
            statusEl.innerHTML = '🔗 Application opened in new tab — auto-filling there.';
          }
          this.state = 'filled';
          return;
        }
        await delay(800);
      } else {
        if (statusEl) {
          statusEl.style.display = 'block';
          statusEl.className = 'prc-sb-status info';
          statusEl.innerHTML = '📝 Application form detected — filling…';
        }
      }

      if (label) label.textContent = 'Filling form…';
      const { filled } = await fillForm(this.profile, this.platform);

      if (label) label.textContent = 'Uploading files…';
      const fileResult = await this._injectFiles(fileEl);

      this.state = 'filled';
      btn?.classList.remove('loading');
      btn?.classList.add('done');
      if (icon)  icon.textContent  = '✅';
      if (label) label.textContent = `Filled ${filled} fields`;

      let html = `<strong>✅ Done!</strong> ${filled} fields filled.`;
      if (fileResult.resume)     html += '<br><small>📄 Resume uploaded</small>';
      if (fileResult.transcript) html += '<br><small>🎓 Transcript uploaded</small>';
      html += '<br><small>Review everything before submitting.</small>';
      if (statusEl) { statusEl.style.display = 'block'; statusEl.className = 'prc-sb-status success'; statusEl.innerHTML = html; }

    } catch (err) {
      console.error('❌ Autofill error:', err);
      this.state = 'error';
      btn?.classList.remove('loading');
      if (icon)  icon.textContent  = '❌';
      if (label) label.textContent = 'Try Again';
      if (statusEl) { statusEl.style.display = 'block'; statusEl.className = 'prc-sb-status error'; statusEl.textContent = err.message || 'Auto-fill failed'; }
      setTimeout(() => { if (icon) icon.textContent = '⚡'; if (label) label.textContent = 'Auto-Fill + Upload Files'; this.state = 'idle'; }, 4000);
    }
  }

  async _rerun() {
    if (this.state === 'loading') return;
    this.state = 'idle';
    const btn    = document.getElementById('prc-autofill-btn');
    const status = document.getElementById('prc-fill-status');
    const fileEl = document.getElementById('prc-file-status');
    btn?.classList.remove('done', 'error');
    if (status) { status.style.display = 'none'; status.innerHTML = ''; }
    if (fileEl) { fileEl.style.display = 'none'; }
    await new Promise(r => setTimeout(r, 150));
    this._run();
  }

  _debug() {
    const inputs  = srQueryAll('input:not([type="hidden"])');
    const selects = srQueryAll('select');
    const info    = [];
    for (const el of [...inputs, ...selects]) {
      info.push({
        tag: el.tagName.toLowerCase(), type: el.type || 'select',
        name: el.name || '—', id: el.id || '—',
        placeholder: el.placeholder || '—', autocomplete: el.getAttribute('autocomplete') || '—',
        ariaLabel: el.getAttribute('aria-label') || '—', dataTest: el.getAttribute('data-test') || '—',
        label: srGetLabel(el).slice(0, 60) || '—',
        value: el.value ? '(filled)' : '(empty)', inShadow: el.getRootNode() !== document ? '✓' : '',
      });
    }
    console.group(`🔍 Preciprocal Debug [${this.platform}] — ${info.length} fields`);
    console.table(info);
    console.groupEnd();
    const statusEl = document.getElementById('prc-fill-status');
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.className = 'prc-sb-status info';
      statusEl.innerHTML = `🔍 Found <strong>${info.length} fields</strong>.<br><small>F12 → Console for details.</small>`;
    }
  }

  async _injectFiles(fileEl) {
    const result = { resume: false, transcript: false };
    if (!this.files) return result;
    if (fileEl) fileEl.style.display = 'block';
    const { resume, transcript } = FileInjector.classify();
    if (this.files.resume?.available && this.files.resume.url) {
      this._setFileRow('prc-resume-status', '📄 Resume', 'uploading');
      const n = await FileInjector.injectFromUrl(this.files.resume.url, this.files.resume.fileName, resume);
      result.resume = n > 0;
      this._setFileRow('prc-resume-status', '📄 Resume', result.resume ? 'done' : 'manual');
    } else if (this.files.resume && !this.files.resume.available) {
      this._setFileRow('prc-resume-status', '📄 Resume', 'missing');
    }
    if (this.files.transcript?.available && this.files.transcript.url) {
      this._setFileRow('prc-transcript-status', '🎓 Transcript', 'uploading');
      const n = await FileInjector.injectFromUrl(this.files.transcript.url, this.files.transcript.fileName, transcript);
      result.transcript = n > 0;
      this._setFileRow('prc-transcript-status', '🎓 Transcript', result.transcript ? 'done' : 'manual');
    } else if (this.files.transcript && !this.files.transcript.available) {
      this._setFileRow('prc-transcript-status', '🎓 Transcript', 'missing');
    }
    return result;
  }

  _setFileRow(id, label, state) {
    const el = document.getElementById(id);
    if (!el) return;
    const icons = { uploading:'⏳', done:'✅', manual:'⚠️', missing:'➖' };
    const texts = { uploading:'Uploading…', done:'Uploaded', manual:'Attach manually', missing:'Not in profile' };
    el.innerHTML = `${icons[state]} ${label}: <em>${texts[state]}</em>`;
    el.className = `prc-sb-file-row prc-file-${state}`;
  }

  _injectStyles() {
    if (document.getElementById('prc-sidebar-styles')) return;
    const s = document.createElement('style');
    s.id = 'prc-sidebar-styles';
    s.textContent = `

      /* ─── Sidebar wrapper ─── */
      #prc-sidebar {
        position: fixed; top: 50%; right: 0;
        transform: translateY(-50%);
        z-index: 2147483647;
        display: flex; align-items: center;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }

      /* ─── Card ─── */
      #prc-sidebar-inner {
        display: flex; flex-direction: column;
        width: 240px;
        background: #111827;
        border: 1px solid rgba(255,255,255,0.1);
        border-right: none;
        border-radius: 16px 0 0 16px;
        box-shadow: -6px 0 32px rgba(0,0,0,0.5);
        overflow: hidden;
      }

      /* ─── Header ─── */
      .prc-sb-header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 14px 16px;
        border-bottom: 1px solid rgba(255,255,255,0.07);
      }
      .prc-sb-brand { display: flex; align-items: center; gap: 9px; }
      .prc-sb-brand svg { flex-shrink: 0; }
      .prc-sb-name { font-size: 14px; font-weight: 700; color: #f9fafb; letter-spacing: -0.02em; }
      .prc-sb-collapse {
        background: none; border: none; color: rgba(255,255,255,0.25);
        cursor: pointer; padding: 5px; border-radius: 6px;
        display: flex; align-items: center; justify-content: center;
        transition: all 0.15s;
      }
      .prc-sb-collapse:hover { color: rgba(255,255,255,0.7); background: rgba(255,255,255,0.07); }

      /* ─── Body ─── */
      .prc-sb-body { padding: 16px; display: flex; flex-direction: column; gap: 14px; }

      /* ─── Hero text ─── */
      .prc-sb-hero { text-align: center; }
      .prc-sb-hero-title { font-size: 14px; font-weight: 700; color: #f9fafb; margin: 0 0 6px; letter-spacing: -0.02em; }
      .prc-sb-hero-sub { font-size: 11.5px; color: rgba(255,255,255,0.45); margin: 0; line-height: 1.6; }

      /* ─── Checklist (unauthenticated) ─── */
      .prc-sb-checklist {
        display: flex; flex-direction: column; gap: 0;
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 10px; overflow: hidden;
      }
      .prc-sb-check-item {
        display: flex; align-items: center; gap: 10px;
        padding: 11px 12px;
        border-bottom: 1px solid rgba(255,255,255,0.06);
      }
      .prc-sb-check-item:last-child { border-bottom: none; }
      .prc-sb-check-icon {
        width: 28px; height: 28px; border-radius: 8px; flex-shrink: 0;
        background: rgba(255,255,255,0.06);
        display: flex; align-items: center; justify-content: center;
        color: rgba(255,255,255,0.5);
      }
      .prc-sb-check-item span { font-size: 11.5px; color: #e5e7eb; flex: 1; line-height: 1.4; font-weight: 500; }
      .prc-sb-check-dim .prc-sb-check-icon { color: rgba(255,255,255,0.2); }
      .prc-sb-check-dim span { color: rgba(255,255,255,0.3); }

      /* GO badge */
      .prc-sb-go {
        display: flex; align-items: center; justify-content: center;
        background: #4f46e5; color: #fff;
        font-size: 10px; font-weight: 700; letter-spacing: 0.04em;
        padding: 4px 9px; border-radius: 20px; border: none; cursor: pointer;
        flex-shrink: 0; font-family: inherit; transition: background 0.15s;
      }
      .prc-sb-go:hover { background: #4338ca; }
      .prc-sb-go-dim { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.3); cursor: default; }

      /* ─── Primary CTA button ─── */
      .prc-sb-cta {
        display: flex; align-items: center; justify-content: center; gap: 7px;
        width: 100%; padding: 11px 16px; border-radius: 10px; border: none;
        font-size: 13px; font-weight: 700; letter-spacing: -0.01em;
        cursor: pointer; font-family: inherit; transition: all 0.15s;
        background: #4f46e5; color: #fff;
        box-shadow: 0 2px 12px rgba(79,70,229,0.35);
      }
      .prc-sb-cta:hover { background: #4338ca; box-shadow: 0 2px 16px rgba(79,70,229,0.5); }
      .prc-sb-cta:active { transform: scale(0.98); }
      .prc-sb-cta.loading { opacity: 0.65; cursor: wait; pointer-events: none; }
      .prc-sb-cta.done { background: #059669; box-shadow: 0 2px 12px rgba(5,150,105,0.3); pointer-events: none; }
      .prc-sb-cta.error { background: #dc2626; box-shadow: none; }
      .prc-sb-cta-disabled { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.3); box-shadow: none; cursor: default; pointer-events: none; }

      /* ─── Link actions ─── */
      .prc-sb-actions { display: flex; align-items: center; justify-content: center; gap: 6px; }
      .prc-sb-dot { font-size: 11px; color: rgba(255,255,255,0.15); }
      .prc-sb-link {
        background: none; border: none; cursor: pointer; font-family: inherit;
        font-size: 11px; color: rgba(255,255,255,0.4); padding: 0; transition: color 0.15s;
      }
      .prc-sb-link:hover { color: rgba(255,255,255,0.75); }
      .prc-sb-link-dim { color: rgba(255,255,255,0.2); font-size: 10px; }
      .prc-sb-link-dim:hover { color: rgba(255,255,255,0.45); }

      /* ─── Status ─── */
      .prc-sb-status { padding: 9px 11px; border-radius: 8px; font-size: 11px; line-height: 1.5; }
      .prc-sb-status.success { background: rgba(16,185,129,0.1); border: 1px solid rgba(16,185,129,0.2); color: #6ee7b7; }
      .prc-sb-status.error   { background: rgba(239,68,68,0.1);  border: 1px solid rgba(239,68,68,0.2);  color: #fca5a5; }
      .prc-sb-status.info    { background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.2); color: #a5b4fc; }

      /* ─── File rows ─── */
      .prc-sb-file-status { display: flex; flex-direction: column; gap: 4px; padding: 9px 11px; background: rgba(255,255,255,0.03); border-radius: 8px; border: 1px solid rgba(255,255,255,0.07); }
      .prc-sb-file-row { font-size: 11px; line-height: 1.4; color: rgba(255,255,255,0.3); }
      .prc-sb-file-row em { font-style: normal; }
      .prc-file-done      { color: #6ee7b7; }
      .prc-file-uploading { color: #93c5fd; }
      .prc-file-manual    { color: #fcd34d; }
      .prc-file-missing   { color: rgba(255,255,255,0.2); }

      /* ─── Spinner ─── */
      .prc-sb-spinner { display: inline-block; width: 13px; height: 13px; border: 2px solid rgba(255,255,255,0.2); border-top-color: #fff; border-radius: 50%; animation: prc-sb-spin 0.65s linear infinite; }
      @keyframes prc-sb-spin { to { transform: rotate(360deg); } }

      /* ─── Collapsed tab ─── */
      .prc-sb-tab {
        display: none; width: 30px; height: 60px;
        background: #111827;
        border: 1px solid rgba(255,255,255,0.1); border-right: none;
        border-radius: 10px 0 0 10px;
        cursor: pointer; align-items: center; justify-content: center;
        box-shadow: -3px 0 16px rgba(0,0,0,0.4);
        transition: background 0.15s;
      }
      .prc-sb-tab:hover { background: #1e293b; }

      @media (max-width: 900px) { #prc-sidebar-inner { width: 220px; } }
      @media print { #prc-sidebar { display: none !important; } }

    `;
    (document.head || document.documentElement).appendChild(s);
  }
}

// ─────────────────────────────────────────────────────────────────
// Boot + SPA navigation watcher
// ─────────────────────────────────────────────────────────────────

let _instance    = null;
let _lastUrl     = window.location.href;
let _autoFilling = false;

async function boot() {
  if (_instance) return;
  _instance = new PreciprocalSidebar();
  await _instance.init();
}

async function onNavigation() {
  const currentUrl = window.location.href;
  if (currentUrl === _lastUrl) return;
  _lastUrl = currentUrl;
  console.log('🔄 Preciprocal: navigation detected →', currentUrl);
  document.getElementById('prc-sidebar')?.remove();
  _instance = null;

  // Reset tracker for the new page/job
  _applicationTracked = false;

  await new Promise(r => setTimeout(r, 500));
  if (!isApplicationPage()) return;
  _instance = new PreciprocalSidebar();
  await _instance.init();

  if (!_autoFilling) {
    try {
      const stored = await chrome.storage.local.get(['preciprocal_auto_apply_profile', 'preciprocal_auto_apply_timestamp', 'preciprocal_auto_apply_files']);
      const age    = Date.now() - (stored.preciprocal_auto_apply_timestamp || 0);
      if (stored.preciprocal_auto_apply_profile && age < 10 * 60 * 1000) {
        console.log('⚡ Preciprocal: auto-triggering fill on new page');
        _autoFilling = true;
        await new Promise(r => setTimeout(r, 3000));

        const platform = detectPlatform();
        const profile  = stored.preciprocal_auto_apply_profile;
        const label    = document.getElementById('prc-fill-label');
        const icon     = document.getElementById('prc-fill-icon');
        if (label) label.textContent = 'Auto-filling…';
        if (icon)  icon.innerHTML    = '<span class="prc-sb-spinner"></span>';
        document.getElementById('prc-autofill-btn')?.classList.add('loading');

        const statusEl = document.getElementById('prc-fill-status');
        const onDetail = isJobDetailPage();
        if (onDetail) {
          await clickApplyAndWaitForForm(statusEl);
          await delay(800);
        }

        const { filled } = await fillForm(profile, platform);
        const btn = document.getElementById('prc-autofill-btn');
        btn?.classList.remove('loading');
        btn?.classList.add('done');
        if (icon)  icon.textContent  = '✅';
        if (label) label.textContent = `Filled ${filled} fields`;
        if (statusEl) {
          statusEl.style.display = 'block';
          statusEl.className = 'prc-sb-status success';
          statusEl.innerHTML = `<strong>✅ Done!</strong> ${filled} fields filled.<br><small>Review before submitting.</small>`;
        }
        _autoFilling = false;
      }
    } catch (e) {
      console.warn('⚠️ Auto-fill on navigation failed:', e.message);
      _autoFilling = false;
    }
  }
}

(function patchHistory() {
  const originalPush    = history.pushState.bind(history);
  const originalReplace = history.replaceState.bind(history);
  history.pushState    = function(...args) { originalPush(...args);    setTimeout(onNavigation, 100); };
  history.replaceState = function(...args) { originalReplace(...args); setTimeout(onNavigation, 100); };
  window.addEventListener('popstate', () => setTimeout(onNavigation, 100));
})();

let _domChangeTimer = null;
const _domObserver  = new MutationObserver(() => {
  const currentUrl = window.location.href;
  if (currentUrl !== _lastUrl) return;
  clearTimeout(_domChangeTimer);
  _domChangeTimer = setTimeout(async () => {
    if (_autoFilling || !_instance) return;
    const emptyRequired = document.querySelectorAll(
      '[data-automation-id*="firstName"] input:placeholder-shown,' +
      '[data-automation-id*="lastName"] input:placeholder-shown,' +
      '[data-automation-id*="email"] input:placeholder-shown'
    );
    if (emptyRequired.length > 0) {
      console.log('🔵 Preciprocal: detected new empty fields, re-triggering fill');
      await onNavigation();
    }
  }, 1500);
});
_domObserver.observe(document.body, { childList: true, subtree: false });

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 800));
} else {
  setTimeout(boot, 800);
}
setTimeout(boot, 2500);

console.log('✅ Preciprocal external-apply.js ready (auto-fill + job tracker + SPA navigation watcher)');
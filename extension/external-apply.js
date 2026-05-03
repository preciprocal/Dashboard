// external-apply.js
// Preciprocal Universal Auto-Apply — sidebar for external job boards
// Platforms: Greenhouse, Lever, Workday/MyWorkdayJobs, Indeed Smart Apply,
//            Ashby, iCIMS, Jobvite, SmartRecruiters, Taleo, BambooHR,
//            Recruitee, Wellfound/AngelList + generic fallback
// + Job Tracker: auto-logs every submitted application to Preciprocal
//
// ─────────────────────────────────────────────────────────────────
// REQUIRED: Add this handler to background.js (service worker has no
// CORS restrictions, so it can fetch Firebase Storage URLs freely):
//
//   chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
//     if (msg.type === 'FETCH_FILE') {
//       fetch(msg.url)
//         .then(r => r.blob())
//         .then(blob => {
//           const reader = new FileReader();
//           reader.onload = () => {
//             const base64 = reader.result.split(',')[1];
//             sendResponse({ base64, mimeType: blob.type });
//           };
//           reader.onerror = () => sendResponse(null);
//           reader.readAsDataURL(blob);
//         })
//         .catch(() => sendResponse(null));
//       return true; // keep port open for async response
//     }
//   });
// ─────────────────────────────────────────────────────────────────

console.log('🚀 Preciprocal external-apply.js on:', window.location.hostname);

const IS_DEV = false;
const PRECIPROCAL_URL = IS_DEV ? 'http://localhost:3000' : 'https://app.preciprocal.com';

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
  if (document.querySelector('[data-fkit-id]')) return 'icims';
  return 'generic';
}

// ─────────────────────────────────────────────────────────────────
// JOB TRACKER
// ─────────────────────────────────────────────────────────────────

const PLATFORM_NAMES = {
  greenhouse:'Greenhouse', lever:'Lever', workday:'Workday', indeed:'Indeed',
  ashby:'Ashby', icims:'iCIMS', jobvite:'Jobvite', smartrecruiters:'SmartRecruiters',
  taleo:'Taleo', bamboohr:'BambooHR', recruitee:'Recruitee', wellfound:'Wellfound', generic:'Other',
};

const SUCCESS_SIGNALS = {
  greenhouse:      { selectors:['.confirmation','[class*="confirmation"]','#confirmation'], text:['thank you','application submitted','application received','successfully applied'] },
  lever:           { selectors:['.confirmation-page','[class*="confirmation"]'], text:['thank you','application submitted','successfully applied'] },
  workday:         { selectors:['[data-automation-id="thankYouPage"]','[class*="confirmation"]'], text:['thank you','application submitted','successfully submitted'] },
  indeed:          { selectors:['[data-testid="application-confirmation"]','.ia-PostApply','[class*="PostApply"]'], text:['application submitted','your application has been submitted','successfully applied'] },
  ashby:           { selectors:['[class*="confirmation"]','[class*="success"]','[class*="thank"]'], text:['thank you','application submitted','successfully applied'] },
  icims:           { selectors:['[id*="SuccessPage"]','[class*="success"]','.iCIMS_SuccessPage'], text:['thank you','application submitted','application complete'] },
  jobvite:         { selectors:['#jv-apply-success','.jv-apply-success','[class*="success"]'], text:['thank you','application received','successfully submitted'] },
  smartrecruiters: { selectors:['[class*="thank-you"]','[class*="success"]','.application-complete'], text:['thank you','application submitted','successfully applied'] },
  taleo:           { selectors:['[id*="confirmation"]','[class*="confirmation"]'], text:['thank you','application submitted','successfully submitted'] },
  bamboohr:        { selectors:['[class*="confirmation"]','#applicationConfirmation'], text:['thank you','application submitted','application received'] },
  recruitee:       { selectors:['[class*="success"]','[class*="thank"]','[class*="confirmation"]'], text:['thank you','application submitted','successfully applied'] },
  wellfound:       { selectors:['[class*="confirmation"]','[class*="success"]'], text:['application submitted','successfully applied','thank you'] },
  generic:         { selectors:['[class*="confirmation"]','[class*="success"]','[class*="thank"]'], text:['thank you','application submitted','successfully applied'] },
};

let _applicationTracked = false;

function isSuccessPage(platform) {
  const signals = SUCCESS_SIGNALS[platform] || SUCCESS_SIGNALS.generic;
  for (const sel of signals.selectors) {
    try { const el = document.querySelector(sel); if (el && el.offsetParent !== null) return true; } catch {}
  }
  const bodyText = (document.body?.textContent || '').toLowerCase();
  return signals.text.some(t => bodyText.includes(t));
}

// ─────────────────────────────────────────────────────────────────
// RICH JOB DATA EXTRACTION
// ─────────────────────────────────────────────────────────────────

function extractText(selectors, root) {
  root = root || document;
  for (const sel of selectors) {
    try {
      const el = root.querySelector(sel);
      if (el) {
        const t = (el.textContent || el.innerText || '').replace(/\s+/g, ' ').trim();
        if (t && t.length > 0 && t.length < 500) return t;
      }
    } catch {}
  }
  return null;
}

function extractJobInfoFromPage() {
  const platform = detectPlatform();

  const titleSelectors = {
    greenhouse:['h1.app-title','.job-title','h1'], lever:['h2.posting-name','.posting-headline h2','h2','h1'],
    workday:['[data-automation-id="jobPostingTitle"]','h2','h1'], indeed:['[data-testid="jobsearch-JobInfoHeader-title"]','h1.jobTitle','h1'],
    ashby:['h1','.job-title','h2'], icims:['.iCIMS_JobTitle','h1','.icims-job-title'],
    jobvite:['.jv-job-header-name','h1','.job-title'], smartrecruiters:['h1.job-title','.job-title h1','h1'],
    taleo:['#requisitionDescriptionInterface h1','.jobTitle','h1'], bamboohr:['h2.BambooRich','h1','.job-title'],
    recruitee:['h1','.job-title'], wellfound:['h1','.job-title','[data-test="job-title"]'],
    generic:['h1','h2','.job-title','.position-title'],
  };
  const companySelectors = {
    greenhouse:['.company-name','.employer'], lever:['.main-header-text h1','.company-name'],
    workday:[], indeed:['[data-testid="inlineHeader-companyName"]','.icl-u-lg-mr--sm'],
    ashby:['.company-name'], icims:['.iCIMS_CompanyName'], jobvite:['.jv-company-name'],
    smartrecruiters:['.company-name'], taleo:[], bamboohr:[], recruitee:['.company-name'],
    wellfound:['[data-test="company-name"]'], generic:['.company-name','.employer'],
  };
  const locationSelectors = {
    greenhouse:['.location','.job-location','[class*="location"]'], lever:['.location','.sort-by-time','[class*="location"]'],
    workday:['[data-automation-id="locations"]','[data-automation-id="location"]','.location'],
    indeed:['[data-testid="job-location"]','[class*="location"]'], ashby:['.location','[class*="location"]'],
    icims:['.iCIMS_JobLocation','[class*="location"]'], jobvite:['.jv-job-detail-location','[class*="location"]'],
    smartrecruiters:['[class*="location"]','.job-location'], taleo:['[class*="location"]'],
    bamboohr:['[class*="location"]'], recruitee:['[class*="location"]'],
    wellfound:['[data-test="location"]','[class*="location"]'],
    generic:['[class*="location"]','.location','[data-location]'],
  };
  const salarySelectors = {
    greenhouse:['[class*="salary"]','[class*="compensation"]'], lever:['[class*="salary"]','[class*="compensation"]'],
    workday:['[data-automation-id="salary"]','[data-automation-id="compensationSection"]','[class*="salary"]'],
    indeed:['[class*="salary-snippet"]','[data-testid="job-salary"]','.salaryText','[class*="compensation"]'],
    ashby:['[class*="salary"]','[class*="compensation"]','[class*="pay"]'],
    icims:['[class*="salary"]','[class*="compensation"]'], jobvite:['[class*="salary"]','[class*="compensation"]'],
    smartrecruiters:['[class*="salary"]','[class*="compensation"]'], taleo:['[class*="salary"]'],
    bamboohr:['[class*="salary"]','[class*="pay"]'], recruitee:['[class*="salary"]'],
    wellfound:['[data-test="salary"]','[class*="salary"]','[class*="compensation"]'],
    generic:['[class*="salary"]','[class*="compensation"]','[class*="pay"]'],
  };
  const jobTypeSelectors = {
    greenhouse:['[class*="job-type"]','[class*="employment"]'], lever:['[class*="commitment"]','[class*="employment"]','.sort-by-team'],
    workday:['[data-automation-id="time"]','[data-automation-id="jobType"]'],
    indeed:['[class*="job-type"]','[data-testid="job-type-label"]'],
    ashby:['[class*="employment"]','[class*="type"]'], icims:['[class*="jobType"]','[class*="employment"]'],
    jobvite:['[class*="type"]'], smartrecruiters:['[class*="job-type"]'], taleo:['[class*="jobType"]'],
    bamboohr:['[class*="employment"]'], recruitee:['[class*="employment"]'],
    wellfound:['[data-test="job-type"]','[class*="type"]'],
    generic:['[class*="job-type"]','[class*="employment-type"]','[class*="type"]'],
  };
  const remoteSelectors = {
    greenhouse:['[class*="remote"]','[class*="work-type"]'], lever:['[class*="remote"]','[class*="work-type"]'],
    workday:['[data-automation-id="remote"]','[class*="remote"]'],
    indeed:['[class*="remote"]','[data-testid="remote-badge"]'],
    ashby:['[class*="remote"]','[class*="location-type"]'],
    icims:['[class*="remote"]'], jobvite:['[class*="remote"]'], smartrecruiters:['[class*="remote"]'],
    taleo:['[class*="remote"]'], bamboohr:['[class*="remote"]'], recruitee:['[class*="remote"]'],
    wellfound:['[data-test="remote"]','[class*="remote"]'],
    generic:['[class*="remote"]','[class*="work-from"]','[class*="location-type"]'],
  };
  const departmentSelectors = {
    greenhouse:['.department','[class*="department"]'], lever:['.team','.sort-by-team','[class*="department"]'],
    workday:['[data-automation-id="department"]'], ashby:['[class*="department"]','[class*="team"]'],
    smartrecruiters:['[class*="department"]'], wellfound:['[data-test="department"]'],
    generic:['[class*="department"]','[class*="team"]','.team'],
  };
  const descriptionSelectors = {
    greenhouse:['#content .content','.job-description','#job-description'],
    lever:['.posting-description','.content'],
    workday:['[data-automation-id="job-description"]','[class*="description"]'],
    indeed:['#jobDescriptionText','[class*="description"]'],
    ashby:['[class*="description"]','.ashby-job-posting-brief-description'],
    icims:['#iCIMS_MainColumn .iCIMS_JobDescription','[class*="description"]'],
    jobvite:['.jv-job-detail-description','[class*="description"]'],
    smartrecruiters:['[class*="description"]','.job-sections'], taleo:['[class*="description"]'],
    bamboohr:['[class*="description"]'], recruitee:['[class*="description"]'],
    wellfound:['[data-test="description"]','[class*="description"]'],
    generic:['[class*="description"]','#job-description','.job-desc','[class*="about-role"]'],
  };
  const dateSelectors = {
    greenhouse:['[class*="posted"]','time'], lever:['[class*="posting-date"]','time'],
    workday:['[data-automation-id="postedDate"]','time'], indeed:['[data-testid="job-age"]','[class*="posted"]','time'],
    ashby:['time','[class*="posted"]'], icims:['[class*="date"]','time'], jobvite:['[class*="date"]','time'],
    smartrecruiters:['time','[class*="posted"]'], generic:['time[datetime]','[class*="posted"]','[class*="date"]'],
  };

  const getText = (selectorMap) => {
    const sels = selectorMap[platform] || selectorMap.generic || [];
    return extractText(sels);
  };

  let jobTitle = null;
  for (const sel of (titleSelectors[platform] || titleSelectors.generic)) {
    try {
      const el = document.querySelector(sel);
      if (el) { const t = (el.textContent||'').trim(); if (t && t.length < 200) { jobTitle = t; break; } }
    } catch {}
  }
  let company = null;
  for (const sel of (companySelectors[platform] || [])) {
    try {
      const el = document.querySelector(sel);
      if (el) { const t = (el.textContent||'').trim(); if (t && t.length < 100) { company = t; break; } }
    } catch {}
  }
  if (!company) {
    const host = window.location.hostname; const parts = host.split('.');
    const atsPlatforms = ['greenhouse','lever','workday','indeed','ashby','icims','jobvite','smartrecruiters','taleo','bamboohr','recruitee','wellfound','angel','myworkdayjobs'];
    if (parts.length >= 3 && atsPlatforms.some(p => parts[1].includes(p))) company = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
    else if (parts.length >= 2) { const domain = parts[parts.length-2]; if (!atsPlatforms.includes(domain)) company = domain.charAt(0).toUpperCase() + domain.slice(1); }
  }
  if (!jobTitle) {
    const title = document.title || '';
    if (title.includes(' - ')) jobTitle = title.split(' - ')[0].trim();
    else if (title.includes(' | ')) jobTitle = title.split(' | ')[0].trim();
    else jobTitle = title.trim() || 'Unknown Position';
  }
  if (!company) company = 'Unknown Company';
  if (jobTitle.length > 100) jobTitle = jobTitle.slice(0, 100);
  if (company.length > 100)  company  = company.slice(0, 100);

  const location   = getText(locationSelectors);
  const salary     = getText(salarySelectors);
  const jobType    = getText(jobTypeSelectors);
  const remote     = getText(remoteSelectors);
  const department = getText(departmentSelectors);
  const postedDate = getText(dateSelectors);

  let description = null;
  for (const sel of (descriptionSelectors[platform] || descriptionSelectors.generic)) {
    try {
      const el = document.querySelector(sel);
      if (el) { const t = (el.textContent||el.innerText||'').replace(/\s+/g,' ').trim(); if (t && t.length > 50) { description = t.slice(0,3000); break; } }
    } catch {}
  }

  let workArrangement = remote;
  if (!workArrangement) {
    const pageText = (document.body?.textContent||'').toLowerCase();
    if (/\bfully remote\b|\b100%\s*remote\b/.test(pageText))              workArrangement = 'Remote';
    else if (/\bhybrid\b/.test(pageText))                                 workArrangement = 'Hybrid';
    else if (/\bon.?site\b|\bin.?office\b|\bin person\b/.test(pageText)) workArrangement = 'On-site';
  }

  let employmentType = jobType;
  if (!employmentType) {
    const pageText = (document.body?.textContent||'').toLowerCase();
    if (/\bpart.?time\b/.test(pageText))                    employmentType = 'Part-time';
    else if (/\bcontract\b|\bfreelance\b/.test(pageText))   employmentType = 'Contract';
    else if (/\binternship\b|\bintern\b/.test(pageText))    employmentType = 'Internship';
    else if (/\bfull.?time\b/.test(pageText))               employmentType = 'Full-time';
  }

  let seniority = null;
  const titleLower = (jobTitle||'').toLowerCase();
  if (/\bstaff\b|\bprincipal\b|\bdistinguished\b/.test(titleLower))          seniority = 'Staff';
  else if (/\bsenior\b|\bsr\.?\s/.test(titleLower))                          seniority = 'Senior';
  else if (/\bjunior\b|\bjr\.?\s|entry.?level|associate/.test(titleLower))   seniority = 'Junior';
  else if (/\blead\b/.test(titleLower))                                       seniority = 'Lead';
  else if (/\bmanager\b|\bdirector\b|\bvp\b|\bhead of\b/.test(titleLower))   seniority = 'Manager+';
  else if (/\bintern\b/.test(titleLower))                                     seniority = 'Intern';
  else                                                                        seniority = 'Mid-level';

  return { jobTitle, company, location:location||null, salary:salary||null, jobType:employmentType||null,
    workArrangement:workArrangement||null, department:department||null, postedDate:postedDate||null,
    description:description||null, seniority:seniority||null, jobUrl:window.location.href };
}

async function trackJobApplication(platform) {
  if (_applicationTracked) return;
  _applicationTracked = true;
  const jobInfo = extractJobInfoFromPage();
  const jobData = {
    jobTitle:jobInfo.jobTitle, company:jobInfo.company, jobBoard:PLATFORM_NAMES[platform]||'Other',
    jobUrl:jobInfo.jobUrl, appliedAt:new Date().toISOString(), status:'Applied',
    source:'chrome_extension', autoTracked:true,
    location:jobInfo.location, salary:jobInfo.salary, jobType:jobInfo.jobType,
    workArrangement:jobInfo.workArrangement, department:jobInfo.department,
    postedDate:jobInfo.postedDate, description:jobInfo.description,
    seniority:jobInfo.seniority, platform,
  };
  console.log('📋 Preciprocal: tracking job application →', jobInfo.jobTitle, 'at', jobInfo.company);
  try {
    chrome.runtime.sendMessage({ type:'JOB_APPLICATION_SUBMITTED', data:jobData }, (response) => {
      if (chrome.runtime.lastError) { console.warn('⚠️ Job tracker:', chrome.runtime.lastError.message); return; }
      if (response?.success) {
        if (!response.queued) { console.log('✅ Job application saved to tracker'); showTrackingToast(jobInfo.jobTitle, jobInfo.company); }
        else console.log('📥 Job queued locally (will sync when signed in)');
      }
    });
  } catch (err) { console.warn('⚠️ Job tracker error:', err.message); }
}

function showTrackingToast(jobTitle, company) {
  if (document.getElementById('prc-tracker-toast')) return;
  if (!document.getElementById('prc-toast-styles')) {
    const style = document.createElement('style');
    style.id = 'prc-toast-styles';
    style.textContent = `
      @keyframes prcToastIn  { from{transform:translateY(40px);opacity:0} to{transform:translateY(0);opacity:1} }
      @keyframes prcToastOut { from{transform:translateY(0);opacity:1}    to{transform:translateY(20px);opacity:0} }
    `;
    (document.head||document.documentElement).appendChild(style);
  }
  const toast = document.createElement('div');
  toast.id = 'prc-tracker-toast';
  toast.style.cssText = `position:fixed;bottom:24px;left:24px;background:#ffffff;border:1px solid #e5e7eb;color:#111827;padding:12px 16px;border-radius:12px;box-shadow:0 4px 24px rgba(0,0,0,0.12);z-index:2147483646;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;display:flex;align-items:flex-start;gap:10px;max-width:280px;animation:prcToastIn 0.35s cubic-bezier(0.175,0.885,0.32,1.275)`;
  toast.innerHTML = `<span style="font-size:18px;line-height:1;">✅</span><div><div style="font-weight:700;font-size:12px;color:#7c3aed;margin-bottom:2px;">Added to Job Tracker</div><div style="color:#6b7280;font-size:11px;line-height:1.4;">${jobTitle}<br>@ ${company}</div></div>`;
  document.body.appendChild(toast);
  setTimeout(() => { toast.style.animation = 'prcToastOut 0.3s ease forwards'; setTimeout(() => toast.remove(), 300); }, 4500);
}

function watchForApplicationSuccess(platform) {
  if (isSuccessPage(platform)) { trackJobApplication(platform); return; }
  let lastUrl = window.location.href;
  const urlWatcher = setInterval(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      setTimeout(() => { if (isSuccessPage(platform)) { clearInterval(urlWatcher); domWatcher.disconnect(); trackJobApplication(platform); } }, 800);
    }
  }, 600);
  const domWatcher = new MutationObserver(() => {
    if (isSuccessPage(platform)) { domWatcher.disconnect(); clearInterval(urlWatcher); trackJobApplication(platform); }
  });
  domWatcher.observe(document.body, { childList:true, subtree:true });
  document.addEventListener('submit', (e) => {
    const form = e.target;
    const action = (form.action||'').toLowerCase();
    const isApplyForm = /apply|application|submit/i.test(action) ||
      !!form.querySelector('[name*="resume"],[name*="firstName"],[name*="first_name"],input[type="email"]');
    if (isApplyForm) setTimeout(() => { if (isSuccessPage(platform)) { clearInterval(urlWatcher); domWatcher.disconnect(); trackJobApplication(platform); } }, 1500);
  }, true);
}

// ─────────────────────────────────────────────────────────────────
// APPLY BUTTON FINDER & CLICKER
// ─────────────────────────────────────────────────────────────────

const APPLY_BUTTON_SELECTORS = [
  'a[href*="apply"]','button[id*="apply" i]','a[id*="apply" i]',
  'button[class*="apply" i]','a[class*="apply" i]',
  'button[data-qa*="apply" i]','a[data-qa*="apply" i]',
  'button[data-automation-id*="apply" i]','[data-testid*="apply" i]',
  '#apply_button','.apply-button','a.apply-now','.template-btn-submit',
  'a.postings-btn','[data-automation-id="applyButton"]','[data-automation-id="apply-button"]',
  '.ia-continueButton','[data-testid="indeedApplyButton"]','[data-test="apply-button"]',
  'button[data-id="apply"]','#applyButton','.iCIMS_JobsTable .iCIMS_Anchor',
  'button.styles_applyButton__','button[type="submit"][class*="apply" i]',
  '.btn-apply','.apply-now-btn','#applyNow','.apply-cta',
];
const APPLY_KEYWORDS = ['apply now','apply for this job','apply for this position','apply for this role','apply to this job','apply today','apply online','submit application','start application','begin application','apply'];
const APPLY_EXCLUDE_KEYWORDS = ['already applied','application submitted','view application','withdraw','not interested','easy apply','quick apply'];

function findApplyButton() {
  for (const sel of APPLY_BUTTON_SELECTORS) {
    try {
      const els = document.querySelectorAll(sel);
      for (const el of els) {
        if (!el || el.offsetParent === null || el.disabled) continue;
        const text = (el.textContent||el.value||el.getAttribute('aria-label')||'').toLowerCase().trim();
        if (APPLY_EXCLUDE_KEYWORDS.some(kw => text.includes(kw))) continue;
        const isSpecific = sel.includes('#') || sel.includes('applyButton') || sel.includes('apply-button') || sel.includes('postings-btn');
        if (isSpecific || APPLY_KEYWORDS.some(kw => text.includes(kw))) { console.log('✅ Found apply button via selector:', sel, '| text:', text.slice(0,40)); return el; }
      }
    } catch {}
  }
  const candidates = Array.from(document.querySelectorAll('button,a,[role="button"]')).filter(el => el.offsetParent !== null && !el.disabled);
  for (const el of candidates) {
    const text = (el.textContent||el.value||el.getAttribute('aria-label')||'').toLowerCase().trim();
    if (APPLY_EXCLUDE_KEYWORDS.some(kw => text.includes(kw))) continue;
    if (APPLY_KEYWORDS.some(kw => text === kw || text.startsWith(kw))) { console.log('✅ Found apply button via text scan:', text.slice(0,40)); return el; }
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
  if ((host.includes('workday.com')||host.includes('myworkdayjobs.com')) && document.querySelector('[data-automation-id="legalNameSection_firstName"],[data-automation-id="firstName"]')) return false;
  if (document.querySelector('.ia-BasePage,#ia-container')) return false;
  const hasVisibleForm = !!(document.querySelector('#first_name,#last_name,input[name="first_name"],input[name="email"],input[name="name"]')||document.querySelector('#iCIMS_MainColumn')||document.querySelector('[data-automation-id="legalNameSection_firstName"]')||document.querySelector('form[action*="apply"],form[id*="apply" i],form[class*="apply" i]'));
  if (hasVisibleForm) return false;
  return !!findApplyButton();
}

async function clickApplyAndWaitForForm(statusEl) {
  const applyBtn = findApplyButton();
  if (!applyBtn) { console.log('ℹ️ No apply button found — assuming form is already visible'); return false; }
  console.log('🖱️ Clicking apply button:', applyBtn.textContent?.trim().slice(0,40));
  if (statusEl) { statusEl.style.display='block'; statusEl.className='prc-sb-status info'; statusEl.innerHTML='🖱️ Clicking Apply button…'; }
  const target = applyBtn.getAttribute('target');
  const href   = applyBtn.getAttribute('href');
  const opensNewTab = target === '_blank' || (href && !href.startsWith('#') && !href.startsWith('javascript'));
  if (opensNewTab && href) { console.log('🔗 Apply button opens new tab — navigating...'); return false; }
  applyBtn.click();
  if (statusEl) statusEl.innerHTML = '⏳ Waiting for application form…';
  const formAppeared = await waitForApplicationForm(8000);
  if (formAppeared) { console.log('✅ Application form appeared after clicking Apply'); if (statusEl) statusEl.innerHTML = '📝 Form detected — filling…'; return true; }
  console.log('ℹ️ Form not detected in current DOM — may have navigated');
  return false;
}

function waitForApplicationForm(timeout = 8000) {
  return new Promise(resolve => {
    const formSelectors = ['#first_name','#last_name','input[name="first_name"]','input[name="name"]','input[name="email"]','[data-automation-id="legalNameSection_firstName"]','.ia-BasePage','#iCIMS_MainColumn','form[action*="apply"]','input[aria-label*="First name" i]','input[aria-label*="Email" i]','.application-form','#applicationForm','#jv-apply-form'];
    const check = () => formSelectors.some(sel => { try { return !!document.querySelector(sel); } catch { return false; } });
    if (check()) { resolve(true); return; }
    const obs = new MutationObserver(() => { if (check()) { obs.disconnect(); resolve(true); } });
    obs.observe(document.body, { childList:true, subtree:true });
    setTimeout(() => { obs.disconnect(); resolve(false); }, timeout);
  });
}

function isApplicationPage() {
  const host = window.location.hostname;
  const path = window.location.pathname.toLowerCase();
  const url  = window.location.href.toLowerCase();
  if (host.includes('greenhouse.io') && (path.includes('/application')||url.includes('?gh_jid')||url.includes('#app'))) return true;
  if (host.includes('lever.co') && path.match(/\/[^/]+\/[a-f0-9-]{36}(\/apply)?/)) return true;
  if (host.includes('workday.com')||host.includes('myworkdayjobs.com')) return path.includes('/apply')||path.includes('/job/')||!!document.querySelector('[data-automation-id]');
  if (host.includes('indeed.com') && (path.includes('/apply')||url.includes('smartapply'))) return true;
  if (host.includes('ashbyhq.com') && (path.includes('/application')||path.includes('/jobs'))) return true;
  if (host.includes('icims.com') && (path.includes('apply')||!!document.querySelector('#iCIMS_MainColumn'))) return true;
  if (host.includes('jobvite.com') && (path.includes('/apply')||path.includes('/job'))) return true;
  if (host.includes('smartrecruiters.com') && (path.includes('/apply')||path.includes('/jobs'))) return true;
  if (host.includes('taleo.net') && path.includes('apply')) return true;
  if (host.includes('bamboohr.com') && path.includes('/careers')) return true;
  if (host.includes('wellfound.com')||host.includes('angel.co')) return true;
  const hasForms = !!(document.querySelector('#first_name,#last_name,input[name="first_name"],input[name="name"],input[name="email"],[data-automation-id="legalNameSection_firstName"],.ia-BasePage,#applicationForm,#jv-apply-form'));
  const hasApplyBtn = !!findApplyButton();
  const keywordInUrl = /apply|application|job|career|position|opening/i.test(path+url);
  return hasForms || hasApplyBtn || keywordInUrl;
}

// ─────────────────────────────────────────────────────────────────
// PROFILE NORMALIZATION
// ─────────────────────────────────────────────────────────────────

function normalizeProfile(p) {
  if (!p) return p;
  if (!p.firstName && p.fullName) { const parts = (p.fullName||'').trim().split(/\s+/); p.firstName = parts[0]||''; p.lastName = parts.slice(1).join(' ')||''; }
  if (!p.city && p.location) { const parts = p.location.split(','); p.city = (parts[0]||'').trim(); p.state = (parts[1]||'').trim(); }
  if (typeof p.skills === 'string') p.skills = p.skills.split(',').map(s=>s.trim()).filter(Boolean);
  if (!Array.isArray(p.skills)) p.skills = [];
  if (!Array.isArray(p.education))  p.education  = [];
  if (!Array.isArray(p.experience)) p.experience = [];
  return p;
}

// ─────────────────────────────────────────────────────────────────
// IMPROVED SCORING ENGINE (replaces strSimilarity + fuzzyPickOption)
// ─────────────────────────────────────────────────────────────────

// US state name ↔ abbreviation lookup
const STATE_NAME_TO_ABBR = {
  'alabama':'AL','alaska':'AK','arizona':'AZ','arkansas':'AR','california':'CA',
  'colorado':'CO','connecticut':'CT','delaware':'DE','florida':'FL','georgia':'GA',
  'hawaii':'HI','idaho':'ID','illinois':'IL','indiana':'IN','iowa':'IA',
  'kansas':'KS','kentucky':'KY','louisiana':'LA','maine':'ME','maryland':'MD',
  'massachusetts':'MA','michigan':'MI','minnesota':'MN','mississippi':'MS',
  'missouri':'MO','montana':'MT','nebraska':'NE','nevada':'NV','new hampshire':'NH',
  'new jersey':'NJ','new mexico':'NM','new york':'NY','north carolina':'NC',
  'north dakota':'ND','ohio':'OH','oklahoma':'OK','oregon':'OR','pennsylvania':'PA',
  'rhode island':'RI','south carolina':'SC','south dakota':'SD','tennessee':'TN',
  'texas':'TX','utah':'UT','vermont':'VT','virginia':'VA','washington':'WA',
  'west virginia':'WV','wisconsin':'WI','wyoming':'WY','district of columbia':'DC',
  'puerto rico':'PR','guam':'GU','virgin islands':'VI','american samoa':'AS',
};
const STATE_ABBR_TO_NAME = Object.fromEntries(Object.entries(STATE_NAME_TO_ABBR).map(([k,v]) => [v.toLowerCase(),k]));

function getAllStateVariants(value) {
  if (!value) return [];
  const v   = value.trim().toLowerCase();
  const out = [v];
  if (STATE_NAME_TO_ABBR[v]) { out.push(STATE_NAME_TO_ABBR[v].toLowerCase()); out.push(STATE_NAME_TO_ABBR[v]); }
  if (STATE_ABBR_TO_NAME[v]) { out.push(STATE_ABBR_TO_NAME[v]); }
  return [...new Set(out)];
}

/**
 * Score how well `candidate` text matches `desired` value.
 * Returns 0–1. Threshold for acceptance is typically 0.45.
 */
function scoreMatch(desired, candidate) {
  if (!desired || !candidate) return 0;
  const d = desired.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const c = candidate.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  if (!d || !c) return 0;

  // Tier 1: exact
  if (c === d) return 1;

  // Tier 2: prefix / contains
  if (c.startsWith(d) || d.startsWith(c)) return 0.95;
  if (c.includes(d) || d.includes(c)) return 0.85;

  // Tier 3: state name ↔ abbreviation
  const stateVariants = getAllStateVariants(desired);
  for (const sv of stateVariants) {
    const svn = sv.toLowerCase();
    if (c === svn || c.startsWith(svn) || c.includes(svn)) return 0.92;
  }

  // Tier 4: word overlap
  const dWords = d.split(/\s+/).filter(w => w.length > 1);
  const cWords = c.split(/\s+/).filter(w => w.length > 1);
  if (dWords.length && cWords.length) {
    const matches = dWords.filter(w => cWords.some(cw => cw.includes(w) || w.includes(cw)));
    const overlap = matches.length / Math.max(dWords.length, cWords.length);
    if (overlap > 0) return 0.5 + overlap * 0.35;
  }

  // Tier 5: bigram (Dice coefficient)
  const bigrams = (s) => { const b = new Set(); for (let i = 0; i < s.length-1; i++) b.add(s.slice(i,i+2)); return b; };
  const db = bigrams(d), cb = bigrams(c);
  if (db.size === 0 || cb.size === 0) return 0;
  let shared = 0; db.forEach(bg => { if (cb.has(bg)) shared++; });
  return (2 * shared) / (db.size + cb.size);
}

/**
 * Pick the best matching option from an array of { text, value?, _el } objects.
 * Returns null if best score is below threshold.
 */
function bestMatch(options, desired, threshold = 0.45) {
  if (!desired || !options.length) return null;
  let best = null, bestScore = -1;
  for (const opt of options) {
    const text = (opt.text || opt.label || opt.value || '').trim();
    if (!text || /^(select|choose|--|please select|none)$/i.test(text)) continue;
    const score = scoreMatch(desired, text);
    if (score > bestScore) { bestScore = score; best = opt; }
  }
  return bestScore >= threshold ? best : null;
}

// Keep fuzzyPickOption as alias for backwards compatibility with platform-specific fillers
function fuzzyPickOption(options, desiredValue) {
  return bestMatch(options, desiredValue);
}

// ─────────────────────────────────────────────────────────────────
// FORM FILLING UTILITIES
// ─────────────────────────────────────────────────────────────────

function setReactValue(el, value) {
  if (!el || el.disabled || el.readOnly) return false;
  try {
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (nativeSetter) nativeSetter.call(el, value);
    else              el.value = value;
    const tracker = el._valueTracker;
    if (tracker) { try { tracker.setValue(''); } catch {} }
    el.dispatchEvent(new Event('input',  { bubbles:true, cancelable:true, composed:true }));
    el.dispatchEvent(new Event('change', { bubbles:true, cancelable:true, composed:true }));
    el.dispatchEvent(new FocusEvent('focus', { bubbles:true }));
    el.dispatchEvent(new FocusEvent('blur',  { bubbles:true, relatedTarget:document.body }));
    return true;
  } catch { return false; }
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

function getLabel(el) {
  if (el.id) { const lbl = document.querySelector(`label[for="${CSS.escape(el.id)}"]`); if (lbl) return (lbl.textContent||'').trim(); }
  if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
  if (el.getAttribute('aria-labelledby')) {
    const ids = el.getAttribute('aria-labelledby').split(' ');
    const texts = ids.map(id => document.getElementById(id)?.textContent?.trim()).filter(Boolean);
    if (texts.length) return texts.join(' ');
  }
  if (el.placeholder) return el.placeholder;
  const container = el.closest('[class*="field"],[class*="form-group"],[class*="input-wrapper"],[class*="question"],[class*="FormField"],fieldset,label,.sc-form-item');
  if (container) {
    const lbl = container.querySelector('label,[class*="label"],[class*="Label"],legend,p[class*="title"]');
    if (lbl && !lbl.contains(el)) return (lbl.textContent||'').trim();
    const text = (container.textContent||'').replace(/\s+/g,' ').trim().slice(0,60);
    if (text) return text;
  }
  return el.name || el.id || '';
}

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
  if (/years? of exp|how many years|experience level|years.*work/i.test(L)) return rangeToSingleNumber(p.yearsOfExperience||'');
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
    const y = parseInt(rangeToSingleNumber(p.yearsOfExperience||''), 10);
    if (!isNaN(y)) {
      const opts = document.querySelectorAll('option');
      let best = null, bestDiff = Infinity;
      opts.forEach(o => { const m = o.text.match(/(\d+)/); if (m) { const d = Math.abs(parseInt(m[1])-y); if (d < bestDiff) { bestDiff = d; best = o.value; } } });
      return best;
    }
  }
  if (/employment type|job type|work type/i.test(L))          return p.employmentType || 'Full-time';
  if (/remote|hybrid|on.?site|work.*arrangement/i.test(L))    return p.workType || 'Remote';
  if (/gender|sex/i.test(L))                                  return p.gender || 'Prefer not to say';
  if (/pronoun/i.test(L))                                     return p.pronouns || 'Prefer not to say';
  if (/race|ethnicit/i.test(L))                               return p.race || 'Prefer not to say';
  if (/veteran|military/i.test(L))                            return p.veteranStatus || 'I am not a protected veteran';
  if (/disabilit/i.test(L))                                   return p.disabilityStatus || 'I do not have a disability';
  if (/how.*hear|referral|source.*job|learn.*about/i.test(L)) return p.howDidYouHear || 'LinkedIn';
  if (/currently.*employ/i.test(L))                           return p.currentlyEmployed ? 'Yes' : 'No';
  if (/previously.*applied|applied.*before|prior.*applic/i.test(L)) return 'No';
  if (/served.*military|military.*service/i.test(L))          return 'No';
  if (/privacy|consent.*collect|data.*collection/i.test(L))   return 'Yes';
  if (/background.?check/i.test(L))                           return p.backgroundCheck  ? 'Yes' : 'No';
  if (/drug.?test/i.test(L))                                  return p.drugTest         ? 'Yes' : 'No';
  if (/criminal/i.test(L))                                    return p.criminalRecord   ? 'Yes' : 'No';
  if (/driver.?licen/i.test(L))                               return p.driverLicense    ? 'Yes' : 'No';
  if (/18.*years|legal.*age|of age/i.test(L))                 return 'Yes';
  if (/language/i.test(L))                                    return p.languages || 'English';
  if (/salary|compensation/i.test(L))                         return p.desiredSalary || '';
  if (/state|province/i.test(L))                              return p.state || '';
  if (/city/i.test(L))                                        return p.city  || '';
  return null;
}

// ─────────────────────────────────────────────────────────────────
// IMPROVED NATIVE <SELECT> FILLER
// ─────────────────────────────────────────────────────────────────

function setSelectValue(el, desiredValue) {
  if (!el || !desiredValue) return false;
  const options = Array.from(el.options);
  const optList = options.map(o => ({ text: o.text, value: o.value, _el: o }));
  const match   = bestMatch(optList, desiredValue);
  if (!match) return false;

  const opt = match._el;
  if (el.value === opt.value) return true;

  const nativeSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set;
  if (nativeSetter) nativeSetter.call(el, opt.value);
  else              el.value = opt.value;

  const tracker = el._valueTracker;
  if (tracker) { try { tracker.setValue(''); } catch {} }

  el.dispatchEvent(new Event('input',  { bubbles:true, cancelable:true, composed:true }));
  el.dispatchEvent(new Event('change', { bubbles:true, cancelable:true, composed:true }));
  el.dispatchEvent(new FocusEvent('focus', { bubbles:true }));
  el.dispatchEvent(new FocusEvent('blur',  { bubbles:true, relatedTarget:document.body }));
  return true;
}

// ─────────────────────────────────────────────────────────────────
// IMPROVED CUSTOM DROPDOWN ENGINE
// Covers: React Select, Radix, Headless UI, MUI, Ant Design,
//         iCIMS fkit listboxes, Workday comboboxes, generic [role="listbox"]
// ─────────────────────────────────────────────────────────────────

/**
 * Collect all currently-visible option elements from any open dropdown.
 * Tries 13 selectors in priority order.
 */
function collectOpenOptions() {
  const OPTION_SELECTORS = [
    '[role="option"]',
    '[role="listbox"] > *',
    '[class*="select__option"]',
    '[class*="__option"]:not([class*="indicator"]):not([class*="container"])',
    '[class*="menu-item"]:not([class*="header"])',
    '[class*="MenuItem"]',
    '[class*="option" i]:not(select):not(input):not([class*="container"])',
    '[data-option-value]',
    '[data-value]',
    'li[id*="option"]',
    'li[class*="option" i]',
    '[class*="dropdown" i] li',
    '[class*="listbox" i] li',
  ];
  for (const sel of OPTION_SELECTORS) {
    try {
      const els = Array.from(document.querySelectorAll(sel))
        .filter(el => el.offsetParent !== null && (el.textContent||'').trim().length > 0);
      if (els.length >= 2) return els;
    } catch {}
  }
  return [];
}

/**
 * Click a dropdown option using a full synthetic mouse event sequence.
 */
async function clickOption(el) {
  el.scrollIntoView({ block:'nearest' });
  el.dispatchEvent(new MouseEvent('mouseover',  { bubbles:true }));
  el.dispatchEvent(new MouseEvent('mouseenter', { bubbles:true }));
  el.dispatchEvent(new MouseEvent('mousemove',  { bubbles:true }));
  el.dispatchEvent(new MouseEvent('mousedown',  { bubbles:true, cancelable:true }));
  el.dispatchEvent(new MouseEvent('mouseup',    { bubbles:true, cancelable:true }));
  el.click();
  el.dispatchEvent(new MouseEvent('click',      { bubbles:true, cancelable:true }));
  await new Promise(r => setTimeout(r, 80));
}

/**
 * Open a dropdown trigger using multiple strategies.
 */
async function openDropdownTrigger(trigger) {
  // Strategy 1: focus + click
  trigger.focus?.();
  trigger.dispatchEvent(new MouseEvent('mousedown', { bubbles:true, cancelable:true }));
  trigger.dispatchEvent(new MouseEvent('mouseup',   { bubbles:true }));
  trigger.click();
  await new Promise(r => setTimeout(r, 350));
  let opts = collectOpenOptions();
  if (opts.length) return opts;

  // Strategy 2: Enter key
  trigger.dispatchEvent(new KeyboardEvent('keydown', { key:'Enter', bubbles:true }));
  await new Promise(r => setTimeout(r, 250));
  opts = collectOpenOptions();
  if (opts.length) return opts;

  // Strategy 3: Space key
  trigger.dispatchEvent(new KeyboardEvent('keydown', { key:' ', bubbles:true }));
  await new Promise(r => setTimeout(r, 250));
  opts = collectOpenOptions();
  if (opts.length) return opts;

  // Strategy 4: ArrowDown (Radix/Headless UI)
  trigger.dispatchEvent(new KeyboardEvent('keydown', { key:'ArrowDown', bubbles:true }));
  await new Promise(r => setTimeout(r, 350));
  return collectOpenOptions();
}

/**
 * Close any open dropdown.
 */
function closeAnyDropdown() {
  document.dispatchEvent(new KeyboardEvent('keydown', { key:'Escape', bubbles:true }));
  document.body.click();
}

/**
 * Get a human-readable label for any dropdown trigger/container element.
 */
function getDropdownLabel(el) {
  // 1. aria-labelledby
  const ids = (el.getAttribute('aria-labelledby')||'').split(' ').filter(Boolean);
  for (const id of ids) {
    const labelEl = document.getElementById(id);
    if (labelEl) { const t = (labelEl.textContent||'').trim(); if (t && t.length < 120) return t; }
  }
  // 2. aria-label
  const al = el.getAttribute('aria-label');
  if (al && al.length < 120) return al.trim();

  // 3. Input child id → label[for]
  const inp = el.querySelector('input');
  if (inp?.id) {
    const lbl = document.querySelector(`label[for="${CSS.escape(inp.id)}"]`);
    if (lbl) return (lbl.textContent||'').trim();
  }

  // 4. Walk up DOM for label siblings or parent labels
  let node = el.parentElement;
  for (let depth = 0; depth < 8; depth++) {
    if (!node || node === document.body) break;
    const labelInContainer = node.querySelector(':scope > label, :scope > legend');
    if (labelInContainer && !labelInContainer.contains(el)) {
      const t = (labelInContainer.textContent||'').trim();
      if (t && t.length > 1 && t.length < 120) return t;
    }
    let sib = node.previousElementSibling;
    while (sib) {
      const tag = sib.tagName?.toLowerCase();
      const cls = (sib.className||'').toLowerCase();
      if (tag==='label'||tag==='legend'||/^h[1-6]$/.test(tag)||/\blabel\b|\bquestion\b|\bprompt\b/.test(cls)) {
        const t = (sib.textContent||'').trim();
        if (t && t.length > 1 && t.length < 120) return t;
      }
      sib = sib.previousElementSibling;
    }
    node = node.parentElement;
  }

  // 5. data-* attributes
  for (const attr of ['data-label','data-name','data-field','data-question','data-automation-id']) {
    const v = el.getAttribute(attr) || el.closest(`[${attr}]`)?.getAttribute(attr);
    if (v && v.length > 1 && v.length < 120) return v.trim();
  }

  // 6. Placeholder as last resort
  const ph = el.querySelector('[class*="placeholder" i],[data-placeholder]');
  if (ph) return (ph.textContent||'').trim();

  return '';
}

/**
 * Master custom dropdown filler.
 * Handles React Select, Radix, Headless UI, MUI, Ant Design, iCIMS, Workday, generic listboxes.
 */
async function fillCustomDropdown(trigger, desiredValue) {
  if (!trigger || !desiredValue) return false;

  // Delegate React Select to dedicated handler
  const cls = trigger.className || '';
  const isReactSelect = /select__control|SelectControl/i.test(cls) ||
                        trigger.getAttribute('role') === 'combobox' ||
                        !!trigger.querySelector('[class*="select__input"],[class*="__input"]');
  if (isReactSelect) return fillReactSelect(trigger, desiredValue);

  // Find search/filter input inside trigger (for filterable dropdowns)
  const searchInput =
    trigger.querySelector('input[type="text"],input:not([type="hidden"]):not([type="file"])') ||
    trigger.closest('[class*="select" i],[role="combobox"]')?.querySelector('input');

  // Open the dropdown
  const options = await openDropdownTrigger(trigger);

  if (!options.length) {
    console.warn('⚠️ fillCustomDropdown: no options found for', desiredValue);
    closeAnyDropdown();
    return false;
  }

  // Type to filter if there's a search input
  if (searchInput && searchInput.tagName === 'INPUT') {
    const typeVal = getAllStateVariants(desiredValue)[1] || desiredValue;
    setReactValue(searchInput, typeVal);
    searchInput.dispatchEvent(new InputEvent('input', { bubbles:true, data:typeVal }));
    await new Promise(r => setTimeout(r, 500));
    const filtered = collectOpenOptions();
    if (filtered.length) {
      const optList = filtered.map(o => ({ text:(o.textContent||'').trim(), _el:o }));
      const match   = bestMatch(optList, desiredValue);
      if (match) { await clickOption(match._el); return true; }
    }
  }

  // Pick best match from visible options
  const optList = options.map(o => ({ text:(o.textContent||'').trim(), _el:o }));
  const match   = bestMatch(optList, desiredValue);

  if (match) {
    console.log(`  ✅ Custom dropdown: "${desiredValue}" → "${match.text}"`);
    await clickOption(match._el);
    return true;
  }

  console.warn(`  ⚠️ No match for "${desiredValue}" among`, optList.map(o=>o.text).slice(0,6));
  closeAnyDropdown();
  return false;
}

function getReactSelectLabel(controlEl) {
  if (!controlEl) return '';
  const inp = controlEl.querySelector('input');
  const ids = (controlEl.getAttribute('aria-labelledby')||inp?.getAttribute('aria-labelledby')||'').split(' ').filter(Boolean);
  for (const id of ids) { const el = document.getElementById(id); if (el) return (el.textContent||'').trim(); }
  const al = controlEl.getAttribute('aria-label') || inp?.getAttribute('aria-label') || '';
  if (al) return al.trim();
  if (inp?.id) { const lbl = document.querySelector('label[for="'+CSS.escape(inp.id)+'"]'); if (lbl) return (lbl.textContent||'').trim(); }
  let node = controlEl.parentElement;
  for (let i = 0; i < 8; i++) {
    if (!node || node === document.body) break;
    const labelInContainer = node.querySelector('label');
    if (labelInContainer && !labelInContainer.contains(controlEl)) { const t = (labelInContainer.textContent||'').trim(); if (t && t.length > 1 && t.length < 120) return t; }
    let sib = node.previousElementSibling;
    while (sib) {
      const tag = sib.tagName?.toLowerCase(); const cls = (sib.className||'').toLowerCase();
      const isLabel = tag==='label'||tag==='legend'||/^h[1-6]$/.test(tag)||/\blabel\b|\bheading\b|\btitle\b|\bquestion\b|\bprompt\b/.test(cls);
      if (isLabel && !sib.querySelector('input,select,textarea')) { const t = (sib.textContent||'').trim(); if (t && t.length > 1 && t.length < 120) return t; }
      sib = sib.previousElementSibling;
    }
    node = node.parentElement;
  }
  for (const attr of ['data-label','data-name','data-field','data-question']) {
    const v = controlEl.getAttribute(attr) || controlEl.closest('['+attr+']')?.getAttribute(attr);
    if (v) return v.trim();
  }
  const placeholder = controlEl.querySelector('[class*="placeholder" i]');
  if (placeholder) return (placeholder.textContent||'').trim();
  return '';
}

/**
 * Fill a React Select dropdown specifically.
 */
async function fillReactSelect(controlEl, desiredValue) {
  if (!controlEl || !desiredValue) return false;

  // Already has correct value?
  const currentSV = controlEl.querySelector('[class*="single-value"],[class*="singleValue"]');
  if (currentSV) {
    const cur = (currentSV.textContent||'').trim().toLowerCase();
    if (cur && !/^select/i.test(cur) && scoreMatch(desiredValue.toLowerCase(), cur) > 0.8) return true;
  }

  // Open
  controlEl.dispatchEvent(new MouseEvent('mousedown', { bubbles:true, cancelable:true }));
  controlEl.click();
  await new Promise(r => setTimeout(r, 400));

  if (!isReactSelectOpen(controlEl)) {
    const indicator = controlEl.querySelector('[class*="indicator" i]:not([class*="separator"])');
    if (indicator) { indicator.click(); await new Promise(r => setTimeout(r, 350)); }
  }

  // Find open menu (handles portalled menus appended to <body>)
  const getMenu = () => {
    const parent = controlEl.closest('[class*="select-shell"],[class*="select__container"],[class*="container"]') || controlEl.parentElement;
    const inParent = parent?.querySelector('[class*="select__menu"],[class*="__menu-list"]');
    if (inParent && inParent.offsetParent !== null) return inParent;
    const bodyMenus = Array.from(document.querySelectorAll('[class*="select__menu"],[class*="__menu"]'))
      .filter(m => m.offsetParent !== null);
    return bodyMenus[bodyMenus.length-1] || null;
  };

  let menu = getMenu();
  if (!menu) { await new Promise(r => setTimeout(r, 500)); menu = getMenu(); }
  if (!menu) { console.warn('⚠️ React Select: menu did not open for:', desiredValue); closeAnyDropdown(); return false; }

  const getOptionEls = (menuEl) => {
    for (const sel of ['[class*="select__option"]','[class*="__option"]','[role="option"]','div[id*="option"]','li']) {
      const found = Array.from(menuEl.querySelectorAll(sel)).filter(o => o.offsetParent !== null && (o.textContent||'').trim());
      if (found.length) return found;
    }
    return [];
  };

  let optionEls = getOptionEls(menu);
  if (!optionEls.length) { await new Promise(r => setTimeout(r, 400)); optionEls = getOptionEls(menu); }
  if (!optionEls.length) { closeAnyDropdown(); return false; }

  const optList = optionEls.map(o => ({ text:(o.textContent||'').trim(), _el:o }));
  const best    = bestMatch(optList, desiredValue);

  if (best) {
    console.log(`  ✅ React Select: "${desiredValue}" → "${best.text}"`);
    best._el.dispatchEvent(new MouseEvent('mousedown', { bubbles:true }));
    best._el.click();
    await new Promise(r => setTimeout(r, 250));
    return true;
  }

  console.warn(`  ⚠️ React Select: no match for "${desiredValue}"`);
  closeAnyDropdown();
  return false;
}

function isReactSelectOpen(controlEl) {
  if (controlEl.getAttribute('aria-expanded') === 'true') return true;
  const container = controlEl.closest('[class*="select__container"],[class*="container"]');
  if (container?.getAttribute('aria-expanded') === 'true') return true;
  const parent = controlEl.closest('[class*="select-shell"],[class*="select__container"]') || controlEl.parentElement;
  const menu = parent?.querySelector('[class*="select__menu"]') ||
               Array.from(document.querySelectorAll('[class*="select__menu"]')).find(m => m.offsetParent !== null);
  return !!menu;
}

// ─────────────────────────────────────────────────────────────────
// FILE INJECTION
// ─────────────────────────────────────────────────────────────────

class FileInjector {
  static async _fetchViaBackground(url, fileName) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type:'FETCH_FILE', url, fileName }, (response) => {
          if (chrome.runtime.lastError || !response?.base64) resolve(null);
          else resolve(response);
        });
        setTimeout(() => resolve(null), 15000);
      } catch { resolve(null); }
    });
  }
  static _base64ToFile(base64, fileName, mimeType) {
    try {
      const binary = atob(base64); const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return new File([bytes], fileName, { type:mimeType });
    } catch { return null; }
  }
  static _getMime(fileName) {
    const ext = (fileName||'').split('.').pop()?.toLowerCase();
    return { pdf:'application/pdf', doc:'application/msword', docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document', txt:'text/plain' }[ext] || 'application/octet-stream';
  }
  static async injectFromUrl(url, fileName, inputs) {
    if (!url || !inputs?.length) return 0;
    const mime = FileInjector._getMime(fileName);
    let file = null;
    if (url.startsWith('data:')) { const base64 = url.split(',')[1]; if (base64) file = FileInjector._base64ToFile(base64, fileName, mime); }
    if (!file) {
      console.log('📡 Fetching file via background script:', fileName);
      const resp = await FileInjector._fetchViaBackground(url, fileName);
      if (resp?.base64) { file = FileInjector._base64ToFile(resp.base64, fileName, resp.mimeType||mime); if (file) console.log(`✅ Background fetch success: ${fileName} (${Math.round(file.size/1024)}KB)`); }
    }
    if (!file) {
      try {
        console.log('📡 Attempting direct fetch:', fileName);
        const res = await fetch(url, { mode:'cors', credentials:'omit' });
        if (res.ok) { const blob = await res.blob(); file = new File([blob], fileName, { type:mime }); console.log(`✅ Direct fetch success: ${fileName} (${Math.round(file.size/1024)}KB)`); }
      } catch (err) { console.warn('⚠️ Direct fetch failed:', err.message); }
    }
    if (!file) { console.error('❌ All fetch strategies failed for:', fileName); return 0; }
    let count = 0;
    for (const input of inputs) {
      if (input.disabled) continue;
      try {
        const dt = new DataTransfer(); dt.items.add(file);
        try { input.files = dt.files; } catch { const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'files'); if (d?.set) d.set.call(input, dt.files); }
        input.dispatchEvent(new Event('change', { bubbles:true }));
        input.dispatchEvent(new Event('input',  { bubbles:true }));
        count++;
        console.log(`✅ File injected into input:`, input.name||input.id||'(unnamed)');
      } catch (err) { console.warn('⚠️ Could not inject file:', err.message); }
    }
    return count;
  }
  static classify() {
    const all = Array.from(document.querySelectorAll('input[type="file"]:not([disabled])'));
    const resume = [], transcript = [], other = [];
    for (const inp of all) {
      const lbl = getLabel(inp).toLowerCase();
      if (/resume|cv\b|curriculum vitae/i.test(lbl))                   resume.push(inp);
      else if (/transcript|academic record|grade|certificate/i.test(lbl)) transcript.push(inp);
      else if (/cover.?letter/i.test(lbl))                             {}
      else                                                              other.push(inp);
    }
    if (!resume.length     && other.length) resume.push(other.shift());
    if (!transcript.length && other.length) transcript.push(other.shift());
    return { resume, transcript };
  }
}

// ─────────────────────────────────────────────────────────────────
// PLATFORM-SPECIFIC FILL FUNCTIONS
// ─────────────────────────────────────────────────────────────────

async function fillGreenhouse(p) {
  let filled = 0;
  const exact = [
    { sel:'#first_name,input[name="first_name"]',                      val:p.firstName },
    { sel:'#last_name,input[name="last_name"]',                        val:p.lastName  },
    { sel:'#email,input[name="email"]',                                val:p.email     },
    { sel:'#phone,input[name="phone"]',                                val:p.phone     },
    { sel:'#job_application_location,input[name="location"]',          val:p.city||p.location },
  ];
  for (const { sel, val } of exact) {
    if (!val) continue;
    for (const s of sel.split(',')) {
      const el = document.querySelector(s.trim());
      if (el && !el.value) { setReactValue(el, val); filled++; break; }
    }
  }
  const urlInputs = document.querySelectorAll('input[name*="text_value"],input[data-qa="question-field"],.application-question input[type="text"],.field input[type="text"]');
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
    { sel:'input[name="email"]',           val:p.email },
    { sel:'input[name="phone"]',           val:p.phone },
    { sel:'input[name="org"]',             val:p.experience?.[0]?.company||'' },
    { sel:'input[name="location"]',        val:p.city||p.location },
    { sel:'input[name="urls[LinkedIn]"]',  val:p.linkedInUrl },
    { sel:'input[name="urls[GitHub]"]',    val:p.githubUrl },
    { sel:'input[name="urls[Portfolio]"]', val:p.portfolioUrl },
    { sel:'input[name="urls[Other]"]',     val:p.portfolioUrl||p.linkedInUrl },
    { sel:'input[name="urls[Linkedin]"]',  val:p.linkedInUrl },
    { sel:'input[name="urls[Github]"]',    val:p.githubUrl },
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
    const tracker = el._valueTracker;
    if (tracker) { try { tracker.setValue(''); } catch {} }
    el.dispatchEvent(new Event('input',  { bubbles:true, cancelable:true, composed:true }));
    el.dispatchEvent(new Event('change', { bubbles:true, cancelable:true, composed:true }));
    el.dispatchEvent(new FocusEvent('focus', { bubbles:true }));
    el.dispatchEvent(new FocusEvent('blur',  { bubbles:true, relatedTarget:document.body }));
    return true;
  } catch { return false; }
}

function wdInput(automationId) {
  const w = document.querySelector(`[data-automation-id="${automationId}"]`);
  if (!w) return null;
  if (w.tagName === 'INPUT' || w.tagName === 'TEXTAREA') return w;
  return w.querySelector('input:not([type="hidden"]):not([type="file"]),textarea') || null;
}

async function wdPickListbox(automationId, preferredText) {
  const wrapper = document.querySelector(`[data-automation-id="${automationId}"]`);
  if (!wrapper) return false;
  const trigger = wrapper.querySelector('button,[role="combobox"],[aria-haspopup]') || wrapper;
  trigger.click();
  await delay(700);
  const pref = (preferredText||'').toLowerCase();
  for (let attempt = 0; attempt < 4; attempt++) {
    const options = Array.from(document.querySelectorAll('[data-automation-id="promptOption"],[role="option"]')).filter(o => o.offsetParent !== null);
    if (options.length) {
      const optList = options.map(o => ({ text:(o.textContent||'').trim(), _el:o }));
      const match   = pref ? bestMatch(optList, preferredText) : null;
      const chosen  = match || { _el:options[0] };
      chosen._el.click();
      await delay(300);
      return true;
    }
    await delay(400);
  }
  closeAnyDropdown();
  return false;
}

async function wdTypeCombobox(automationId, value) {
  if (!value) return false;
  const wrapper = document.querySelector(`[data-automation-id="${automationId}"]`);
  if (!wrapper) return false;
  const trigger = wrapper.querySelector('[role="combobox"],button[aria-haspopup]') || wrapper;
  trigger.click();
  await delay(400);
  const inp = wrapper.querySelector('input') || document.querySelector('[data-automation-id="searchBox"] input');
  if (inp) {
    const typeVal = getAllStateVariants(value)[1] || value;
    wdSetValue(inp, typeVal);
    await delay(700);
  }
  const options = Array.from(document.querySelectorAll('[data-automation-id="promptOption"],[role="option"]')).filter(o => o.offsetParent !== null);
  if (options.length) {
    const optList = options.map(o => ({ text:(o.textContent||'').trim(), _el:o }));
    const match   = bestMatch(optList, value);
    const chosen  = match || { _el:options[0] };
    chosen._el.click();
    await delay(300);
    return true;
  }
  closeAnyDropdown();
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
    const txt = (nextBtn.textContent||'').trim().toLowerCase();
    if (txt.includes('submit')||txt.includes('done')||txt.includes('review')) break;
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
    { id:'legalNameSection_firstName',  val:p.firstName },
    { id:'legalNameSection_lastName',   val:p.lastName  },
    { id:'firstName',                   val:p.firstName },
    { id:'lastName',                    val:p.lastName  },
    { id:'emailAddress',                val:p.email     },
    { id:'email',                       val:p.email     },
    { id:'addressSection_addressLine1', val:p.streetAddress||p.location },
    { id:'addressSection_postalCode',   val:p.zipCode   },
    { id:'linkedIn',                    val:p.linkedInUrl },
    { id:'website',                     val:p.portfolioUrl },
  ];
  for (const { id, val } of textFields) {
    if (!val) continue;
    const el = wdInput(id);
    if (el && !el.value?.trim() && !el.disabled) { if (wdSetValue(el, val)) { filled++; await delay(50); } }
  }

  await wdPickListbox('phoneDeviceType', 'Mobile');

  if (p.phone) {
    const localPhone = p.phone.replace(/^\+\d{1,3}[\s\-.]?/,'').replace(/\D/g,'');
    const phoneVal   = localPhone || p.phone.replace(/\D/g,'');
    const phoneIds   = ['phoneSection_phoneNumber','phone-number','phoneNumber','phone','phoneNumberSection_phoneNumber','workPhone','mobilePhone'];
    let phoneFilled = false;
    for (const id of phoneIds) {
      const el = wdInput(id);
      if (el && !el.disabled) {
        const cur = (el.value||'').trim();
        if (!cur || /^\+?\d{1,3}$/.test(cur)) { if (wdSetValue(el, phoneVal)) { filled++; phoneFilled = true; break; } }
      }
    }
    if (!phoneFilled) {
      const allWrappers = document.querySelectorAll('[data-automation-id]');
      for (const wrapper of allWrappers) {
        const aid = (wrapper.getAttribute('data-automation-id')||'').toLowerCase();
        if (!/phone/i.test(aid)) continue;
        const inp = wrapper.querySelector('input[type="text"]:not([disabled]):not([readonly]),input[type="tel"]:not([disabled]):not([readonly]),input:not([type]):not([disabled]):not([readonly])');
        if (inp) { const cur = (inp.value||'').trim(); if (!cur||/^\+?\d{1,3}$/.test(cur)) { if (wdSetValue(inp, phoneVal)) { filled++; break; } } }
      }
    }
  }

  const targetCountry = p.country || 'United States';
  const countrySelect = document.querySelector('select[data-automation-id="addressSection_countryRegion"],select[data-automation-id*="country" i]');
  if (countrySelect) setSelectValue(countrySelect, targetCountry);
  else await wdPickListbox('addressSection_countryRegion', targetCountry);
  await delay(1200);

  if (p.state) {
    let stateFilled = false;
    for (let attempt = 0; attempt < 5 && !stateFilled; attempt++) {
      if (attempt > 0) await delay(600 * attempt);
      const stateSelect = document.querySelector('select[data-automation-id="addressSection_stateProvince"],select[data-automation-id*="stateProvince" i],select[data-automation-id*="state" i]');
      if (stateSelect) { if (setSelectValue(stateSelect, p.state)) { stateFilled = true; break; } }
      const stateWrapper = document.querySelector('[data-automation-id="addressSection_stateProvince"],[data-automation-id*="stateProvince"]');
      if (stateWrapper) {
        const currentText = stateWrapper.querySelector('[data-automation-id="selectedItem"],[role="option"][aria-selected="true"]')?.textContent?.trim();
        if (currentText && currentText !== 'Select One' && currentText !== '') { stateFilled = true; break; }
        stateFilled = await wdTypeCombobox('addressSection_stateProvince', p.state);
      }
    }
    if (stateFilled) filled++;
  }

  const cityEl = wdInput('addressSection_city');
  if (cityEl && !cityEl.value?.trim() && p.city) {
    if (wdSetValue(cityEl, p.city)) filled++;
    else await wdTypeCombobox('addressSection_city', p.city);
  }

  await wdPickListbox('howDidYouHearAboutUs', p.howDidYouHear || 'LinkedIn');
  await fillWorkdayRadios(p);
  filled += await smartScan(p);
  return filled;
}

async function fillWorkdayRadios(p) {
  const containers = document.querySelectorAll('[data-automation-id*="radio" i],[role="radiogroup"],fieldset,[data-automation-id*="yesNo" i],[data-automation-id*="boolean" i]');
  for (const container of containers) {
    const questionText = (container.querySelector('label,legend,[data-automation-id*="label" i]')?.textContent || container.previousElementSibling?.textContent || '').toLowerCase();
    if (!questionText) continue;
    let answer = null;
    if (/sponsor/i.test(questionText))                     answer = p.requireSponsorship ? 'yes' : 'no';
    if (/relocat/i.test(questionText))                     answer = p.willingToRelocate  ? 'yes' : 'no';
    if (/currently.*employ/i.test(questionText))           answer = 'no';
    if (/authorized|legally.*work|eligible.*work/i.test(questionText)) answer = 'yes';
    if (/18.*year|over.*18/i.test(questionText))           answer = 'yes';
    if (/background.*check/i.test(questionText))           answer = 'yes';
    if (!answer) continue;
    const radios = container.querySelectorAll('input[type="radio"]');
    let clicked = false;
    for (const r of radios) {
      const lbl = (getLabel(r)+' '+(r.value||'')).toLowerCase();
      if (lbl.includes(answer)) { if (!r.checked) { r.click(); r.dispatchEvent(new Event('change',{bubbles:true})); } clicked = true; break; }
    }
    if (!clicked) {
      const wdRadios = container.querySelectorAll('[role="radio"]');
      for (const r of wdRadios) {
        const lbl = (r.getAttribute('aria-label')||r.textContent||'').toLowerCase();
        if (lbl.includes(answer)) { r.click(); await delay(100); break; }
      }
    }
  }
}

function findWorkdayNext() {
  const ids = ['bottom-navigation-next-button','bottom-navigation-forward-button','nextButton','saveAndContinueButton'];
  for (const id of ids) { const el = document.querySelector(`[data-automation-id="${id}"]`); if (el && !el.disabled && el.offsetParent !== null) return el; }
  return Array.from(document.querySelectorAll('button')).find(b => {
    const t = (b.textContent||'').trim().toLowerCase();
    return (t==='next'||t==='continue'||t==='save and continue') && !b.disabled && b.offsetParent !== null;
  }) || null;
}

async function fillIndeed(p) {
  let filled = 0;
  await waitForSelector('.ia-BasePage,#ia-container,[class*="IA-module"],[data-testid="ia-SmartApply"]', 10000);
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
    const txt = (nextBtn.textContent||'').trim().toLowerCase();
    if (txt.includes('submit')||txt.includes('apply now')||txt.includes('review your application')) break;
    nextBtn.click();
    await delay(1000);
  }
  return { filled };
}

async function fillIndeedStep(p) {
  let filled = 0;
  const ariaFields = [
    { labels:['First name','First Name'],                        val:p.firstName },
    { labels:['Last name','Last Name'],                          val:p.lastName  },
    { labels:['Full name','Full Name','Name'],                   val:p.fullName  },
    { labels:['Email','Email address','Email Address'],          val:p.email     },
    { labels:['Phone number','Phone Number','Phone'],            val:p.phone     },
    { labels:['City','Location','Home location','Home Location'],val:p.city||p.location },
    { labels:['LinkedIn profile','LinkedIn URL','LinkedIn'],     val:p.linkedInUrl },
    { labels:['Website','Portfolio','Personal website'],         val:p.portfolioUrl },
  ];
  for (const { labels, val } of ariaFields) {
    if (!val) continue;
    for (const label of labels) {
      const el = document.querySelector(`input[aria-label="${label}"]`) || document.querySelector(`input[aria-label*="${label}"]`);
      if (el && !el.value && !el.disabled) { setReactValue(el, val); filled++; break; }
    }
  }
  filled += await smartScan(p);
  return filled;
}

async function fillIndeedScreeners(p) {
  const groups = document.querySelectorAll('fieldset,[class*="screener"],[class*="Screener"],[class*="question"]');
  for (const group of groups) {
    const text = (group.querySelector('legend,[class*="title"],p,label')?.textContent||'').toLowerCase();
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
      const lbl = (getLabel(r)+' '+(r.value||'')).toLowerCase();
      if (lbl.includes(answer)) { if (!r.checked) r.click(); break; }
    }
  }
}

function findIndeedNext() {
  const selectors = ['[data-testid="ia-continueButton"]','[class*="ContinueButton"]','button[id*="continue" i]','button[data-dd-action-name*="continue" i]'];
  for (const sel of selectors) { const el = document.querySelector(sel); if (el && !el.disabled && el.offsetParent !== null) return el; }
  return Array.from(document.querySelectorAll('button')).find(b => {
    const t = (b.textContent||'').trim().toLowerCase();
    return (t==='continue'||t==='next') && !b.disabled && b.offsetParent !== null;
  }) || null;
}

async function fillAshby(p) {
  let filled = 0;
  const exact = [
    { sel:'input[name="firstName"],input[name="first_name"]', val:p.firstName },
    { sel:'input[name="lastName"],input[name="last_name"]',   val:p.lastName  },
    { sel:'input[name="email"],input[type="email"]',          val:p.email     },
    { sel:'input[name="phone"],input[type="tel"]',            val:p.phone     },
    { sel:'input[name="location"],input[name="city"]',        val:p.location  },
    { sel:'input[name="linkedin"],input[name="linkedinUrl"]', val:p.linkedInUrl },
    { sel:'input[name="github"],input[name="githubUrl"]',     val:p.githubUrl },
    { sel:'input[name="website"],input[name="portfolio"]',    val:p.portfolioUrl },
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
  function fkitInput(fkitId) {
    const w = document.querySelector(`[data-fkit-id="${fkitId}"]`);
    if (!w) return null;
    return w.querySelector('input:not([type="hidden"]):not([type="file"]):not([disabled])') || null;
  }
  function fillFkit(fkitId, val) {
    if (!val) return false;
    const el = fkitInput(fkitId);
    if (el && !el.value?.trim()) { setReactValue(el, val); return true; }
    return false;
  }
  if (fillFkit('name--firstName',     p.firstName))  filled++;
  if (fillFkit('name--lastName',      p.lastName))   filled++;
  if (fillFkit('email--emailAddress', p.email))      filled++;
  if (fillFkit('address--addressLine1', p.streetAddress||p.location)) filled++;
  if (fillFkit('address--city',       p.city))       filled++;
  if (fillFkit('address--postalCode', p.zipCode))    filled++;

  if (p.phone) {
    const localPhone = p.phone.replace(/^\+\d{1,3}[\s\-.]?/,'').replace(/\D/g,'');
    const phoneVal   = localPhone || p.phone.replace(/\D/g,'');
    let phoneEl = fkitInput('phoneNumber--phoneNumber');
    if (!phoneEl) phoneEl = document.querySelector('input[id="phoneNumber--phoneNumber"],input[name="phoneNumber"],input[id*="phoneNumber" i]:not([id*="country" i]):not([id*="extension" i]):not([id*="type" i])');
    if (phoneEl && !phoneEl.disabled) { setReactValue(phoneEl, phoneVal); filled++; }
  }

  if (p.state) { if (await icimsFillListbox('address--countryRegion', p.state)) filled++; }

  const classicInputs = document.querySelectorAll('#iCIMS_MainColumn input[type="text"],#iCIMS_MainColumn input[type="email"],#iCIMS_MainColumn input[type="tel"]');
  const classicPatterns = [
    { re:/firstname|fname|first.name/i, val:p.firstName },
    { re:/lastname|lname|last.name/i,   val:p.lastName  },
    { re:/email/i,                      val:p.email     },
    { re:/phone/i,                      val:p.phone?.replace(/^\+\d{1,3}[\s\-.]?/,'').replace(/\D/g,'') },
    { re:/address|addr/i,               val:p.streetAddress||p.location },
    { re:/city/i,                       val:p.city      },
    { re:/zip|postal/i,                 val:p.zipCode   },
    { re:/linkedin/i,                   val:p.linkedInUrl },
  ];
  for (const inp of classicInputs) {
    if (inp.disabled) continue;
    const cur = (inp.value||'').trim();
    if (cur && !/^\+?\d{1,3}$/.test(cur)) continue;
    const hint = ((inp.id||'')+' '+(inp.name||'')).toLowerCase();
    for (const { re, val } of classicPatterns) {
      if (!val) continue;
      if (re.test(hint)||re.test(getLabel(inp).toLowerCase())) { setReactValue(inp, val); filled++; break; }
    }
  }

  const classicStateEl = document.querySelector('#iCIMS_MainColumn select[id*="state" i],#iCIMS_MainColumn select[name*="state" i]');
  if (classicStateEl && p.state) setSelectValue(classicStateEl, p.state);

  filled += await smartScan(p);
  return { filled };
}

async function icimsFillListbox(fieldId, desiredValue) {
  if (!desiredValue) return false;
  const trigger =
    document.querySelector(`[data-fkit-id="${fieldId}"] button[aria-haspopup="listbox"]`) ||
    document.querySelector(`[data-fkit-id="${fieldId}"] button[aria-haspopup]`) ||
    document.querySelector(`button[id="${fieldId}"]`) ||
    document.querySelector(`button[name="${fieldId.replace(/.*--/,'')}"]`);
  if (!trigger) return false;

  const currentText = (trigger.textContent||'').trim();
  if (currentText && currentText !== 'Select One' && currentText !== '' && currentText !== '--') return true;

  trigger.click();
  await delay(400);

  const searchInput =
    trigger.parentElement?.querySelector('input[type="text"]') ||
    trigger.closest('[data-fkit-id]')?.querySelector('input[type="text"]') ||
    document.querySelector(`[data-fkit-id="${fieldId}"] input[type="text"]`);

  if (searchInput) {
    const typeVal = getAllStateVariants(desiredValue)[1] || desiredValue;
    setReactValue(searchInput, typeof typeVal === 'string' ? typeVal.toUpperCase() : desiredValue);
    await delay(500);
  }

  const getOpts = () => Array.from(document.querySelectorAll('[role="option"]')).filter(o => o.offsetParent !== null && (o.textContent||'').trim());
  let options = getOpts();
  if (!options.length) { await delay(500); options = getOpts(); }
  if (!options.length) { await delay(800); options = getOpts(); }
  if (!options.length) { closeAnyDropdown(); return false; }

  const optList = options.map(o => ({ text:o.textContent.trim(), _el:o }));
  const match   = bestMatch(optList, desiredValue);
  if (match) { match._el.click(); await delay(200); return true; }

  // Fallback: first option
  options[0].click(); await delay(200); return true;
}

async function fillJobvite(p) {
  let filled = 0;
  const exact = [
    { sel:'input[id*="firstName" i],input[name*="firstName" i]', val:p.firstName },
    { sel:'input[id*="lastName" i],input[name*="lastName" i]',   val:p.lastName  },
    { sel:'input[id*="email" i],input[type="email"]',            val:p.email     },
    { sel:'input[id*="phone" i],input[type="tel"]',              val:p.phone     },
    { sel:'input[id*="linkedin" i]',                             val:p.linkedInUrl },
    { sel:'input[id*="github" i]',                               val:p.githubUrl  },
    { sel:'input[id*="website" i],input[id*="portfolio" i]',     val:p.portfolioUrl },
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

function srQueryAll(selector, root) {
  root = root || document;
  const results = [];
  try { results.push(...root.querySelectorAll(selector)); } catch {}
  const all = root.querySelectorAll ? root.querySelectorAll('*') : [];
  for (const el of all) { if (el.shadowRoot) results.push(...srQueryAll(selector, el.shadowRoot)); }
  return results;
}
function srQuery(selector, root) { return srQueryAll(selector, root)[0] || null; }

function srSetValue(el, value) {
  if (!el || el.disabled || el.readOnly) return false;
  try {
    const proto  = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, value); else el.value = value;
    const tracker = el._valueTracker;
    if (tracker) { try { tracker.setValue(''); } catch {} }
    el.dispatchEvent(new Event('input',  { bubbles:true, composed:true }));
    el.dispatchEvent(new Event('change', { bubbles:true, composed:true }));
    el.dispatchEvent(new FocusEvent('focus', { bubbles:true }));
    el.dispatchEvent(new FocusEvent('blur',  { bubbles:true, relatedTarget:document.body }));
    return true;
  } catch { return false; }
}

function srGetLabel(el) {
  if (el.id) { const root = el.getRootNode(); const lbl = root.querySelector?.(`label[for="${CSS.escape(el.id)}"]`); if (lbl) return lbl.textContent?.trim()||''; }
  if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
  if (el.placeholder) return el.placeholder;
  const container = el.closest('[data-test],.form-group,.field,label');
  if (container) { const lbl = container.querySelector('label'); if (lbl && !lbl.contains(el)) return lbl.textContent?.trim()||''; }
  return el.name || el.id || '';
}

async function fillSmartRecruiters(p) {
  await delay(2000);
  await waitForShadowElement('oc-personal-information,[data-test="personal-information"]', 10000);
  await delay(1000);
  let filled = 0;
  const allInputs  = srQueryAll('input:not([type="hidden"]):not([type="file"]):not([type="submit"])');
  const allSelects = srQueryAll('select');
  const fieldDefs = [
    { val:p.firstName,    tests:[(el)=>/first.?name|given/i.test(srGetLabel(el)),(el)=>el.getAttribute('data-test')==='firstName',(el)=>el.name==='firstName'||el.id==='firstName'] },
    { val:p.lastName,     tests:[(el)=>/last.?name|surname/i.test(srGetLabel(el)),(el)=>el.getAttribute('data-test')==='lastName', (el)=>el.name==='lastName' ||el.id==='lastName' ] },
    { val:p.email,        tests:[(el)=>el.type==='email',(el)=>/email/i.test(srGetLabel(el)),(el)=>el.name==='email'||el.id==='email'] },
    { val:p.phone,        tests:[(el)=>el.type==='tel', (el)=>/phone|mobile/i.test(srGetLabel(el)),(el)=>el.name==='phone'||el.name==='phoneNumber'] },
    { val:p.city,         tests:[(el)=>/\bcity\b/i.test(srGetLabel(el)),(el)=>el.name==='city'||el.id==='city'] },
    { val:p.zipCode,      tests:[(el)=>/zip|postal/i.test(srGetLabel(el)),(el)=>el.name==='zipCode'||el.name==='zip'] },
    { val:p.linkedInUrl,  tests:[(el)=>/linkedin/i.test(srGetLabel(el)),(el)=>el.name==='web-linkedIn'||el.name==='linkedin'] },
    { val:p.githubUrl,    tests:[(el)=>/github/i.test(srGetLabel(el)),(el)=>el.name==='web-github'||el.name==='github'] },
    { val:p.portfolioUrl, tests:[(el)=>/website|portfolio/i.test(srGetLabel(el)),(el)=>el.name==='web-website'||el.name==='website'] },
  ];
  for (const { val, tests } of fieldDefs) {
    if (!val) continue;
    for (const input of allInputs) {
      const currentVal = (input.value||'').trim();
      if (currentVal && !/^\+?\d{1,3}$/.test(currentVal)) continue;
      if (tests.some(test => { try { return test(input); } catch { return false; } })) {
        if (srSetValue(input, val)) { filled++; break; }
      }
    }
  }
  for (const sel of allSelects) {
    if (sel.value && sel.value !== '' && sel.value !== '0') continue;
    const lbl = srGetLabel(sel).toLowerCase();
    if (/country/i.test(lbl))             setSelectValue(sel, p.country||'United States');
    else if (/state|province/i.test(lbl)) setSelectValue(sel, p.state||'');
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
    { sel:'#firstName,input[name="firstName"]',  val:p.firstName },
    { sel:'#lastName,input[name="lastName"]',    val:p.lastName  },
    { sel:'#email,input[name="email"]',          val:p.email     },
    { sel:'#phone,input[name="phone"]',          val:p.phone     },
    { sel:'#address,input[name="address"]',      val:p.location  },
    { sel:'#city,input[name="city"]',            val:p.city      },
    { sel:'#state,input[name="state"]',          val:p.state     },
    { sel:'#zip,input[name="zip"]',              val:p.zipCode   },
    { sel:'input[id*="linkedin" i]',             val:p.linkedInUrl },
  ];
  for (const { sel, val } of exact) {
    if (!val) continue;
    for (const s of sel.split(',')) {
      const el = document.querySelector(s.trim());
      if (el && !el.value && !el.disabled) { setReactValue(el, val); filled++; break; }
    }
  }
  const stateEl = document.querySelector('#state,select[name="state"]');
  if (stateEl && stateEl.tagName === 'SELECT' && p.state) setSelectValue(stateEl, p.state);
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
    { sel:'input[name*="first_name" i],input[id*="first" i]', val:p.firstName },
    { sel:'input[name*="last_name" i],input[id*="last" i]',   val:p.lastName  },
    { sel:'input[name*="email" i],input[type="email"]',       val:p.email     },
    { sel:'input[name*="phone" i],input[type="tel"]',         val:p.phone     },
    { sel:'input[name*="linkedin" i]',                        val:p.linkedInUrl },
    { sel:'input[name*="github" i]',                          val:p.githubUrl  },
    { sel:'input[name*="website" i]',                         val:p.portfolioUrl },
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
    { sel:'input[name*="first_name" i],input[name*="firstName" i]', val:p.firstName },
    { sel:'input[name*="last_name" i],input[name*="lastName" i]',   val:p.lastName  },
    { sel:'input[name*="email" i],input[type="email"]',             val:p.email     },
    { sel:'input[name*="phone" i],input[type="tel"]',               val:p.phone     },
    { sel:'input[name*="linkedin" i]',                              val:p.linkedInUrl },
    { sel:'input[name*="github" i]',                                val:p.githubUrl  },
    { sel:'input[name*="website" i]',                               val:p.portfolioUrl },
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
// SMART SCAN — fills everything on the page
// ─────────────────────────────────────────────────────────────────

async function smartScan(p) {
  let filled = 0;

  // ── Text inputs ──
  const inputs = document.querySelectorAll(
    'input:not([type="hidden"]):not([type="file"]):not([type="submit"])' +
    ':not([type="button"]):not([type="checkbox"]):not([type="radio"])' +
    ':not([disabled]):not([readonly])'
  );
  for (const inp of inputs) {
    if (inp.value && inp.value.trim() !== '') {
      const isPhoneLike = /phone|mobile|cell|tel/i.test(getLabel(inp)) || inp.type === 'tel';
      if (!(isPhoneLike && /^\+?\d{1,3}$/.test(inp.value.trim()))) continue;
    }
    const lbl = getLabel(inp);
    let val   = matchByLabel(lbl, p);
    if (val === null || val === undefined || String(val).trim() === '') continue;
    val = String(val);
    if (inp.type === 'number' || inp.getAttribute('inputmode') === 'numeric') val = rangeToSingleNumber(val);
    if (/year/i.test(lbl) && val.includes('-')) val = rangeToSingleNumber(val);
    if ((inp.type === 'tel' || /phone|mobile|cell/i.test(lbl)) && val.startsWith('+')) {
      const stripped = val.replace(/^\+\d{1,3}[\s-]?/,'').replace(/\D/g,'');
      if (stripped.length >= 7) val = stripped;
    }
    setReactValue(inp, val);
    filled++;
  }

  // ── Native <select> elements (improved with bestMatch scoring) ──
  const selects = document.querySelectorAll('select:not([disabled])');
  for (const sel of selects) {
    if (sel.value && sel.value !== '' && sel.value !== '0' && sel.value !== 'null') continue;
    const lbl = getLabel(sel);
    const val = matchSelectByLabel(lbl, p);
    if (val) { if (setSelectValue(sel, val)) filled++; }
  }

  // ── Custom dropdowns: React Select, Radix, MUI, Ant, iCIMS, Workday, etc. ──
  // Collect all plausible triggers
  const TRIGGER_SELECTORS = [
    'div[class*="select__control"]',
    'div[class*="SelectControl"]',
    '[role="combobox"]:not(input):not(select)',
    '[class*="MuiSelect-root"]',
    '[class*="ant-select-selector"]',
    '[aria-haspopup="listbox"]:not(input):not(select)',
    '[aria-haspopup="true"]:not(input):not(select):not(button[class*="close"]):not(button[class*="menu"])',
  ];

  const seen     = new Set();
  const triggers = [];
  for (const sel of TRIGGER_SELECTORS) {
    try {
      for (const el of document.querySelectorAll(sel)) {
        if (seen.has(el) || el.closest('select')) continue;
        seen.add(el);
        // Skip if clearly already filled (non-placeholder single value present)
        const sv = el.querySelector('[class*="single-value"],[class*="singleValue"]');
        if (sv && sv.textContent?.trim() && !/^(select|choose|--)/i.test(sv.textContent)) continue;
        triggers.push(el);
      }
    } catch {}
  }

  // Sort: country first → state → rest
  triggers.sort((a, b) => {
    const lA = getDropdownLabel(a).toLowerCase();
    const lB = getDropdownLabel(b).toLowerCase();
    const rA = /country/i.test(lA) ? -2 : /\bstate\b|\bprovince\b/i.test(lA) ? -1 : 0;
    const rB = /country/i.test(lB) ? -2 : /\bstate\b|\bprovince\b/i.test(lB) ? -1 : 0;
    return rA - rB;
  });

  for (const trigger of triggers) {
    const lbl = getDropdownLabel(trigger);
    if (!lbl || lbl.length < 2) continue;
    const desired = matchSelectByLabel(lbl, p);
    if (!desired) continue;
    console.log(`🎯 Custom dropdown: "${lbl.slice(0,50)}" → "${desired}"`);
    const ok = await fillCustomDropdown(trigger, desired);
    if (ok) {
      filled++;
      await delay(/country/i.test(lbl) ? 800 : 200);
    }
  }

  // ── EEOC React Select containers (Greenhouse-style) ──
  const eeocContainers = Array.from(document.querySelectorAll('.select__container,[class*="eeoc"] .select,[class*="eeoc__question"] [class*="select"]'));
  for (const container of eeocContainers) {
    const labelEl = container.querySelector('label');
    if (!labelEl) continue;
    const labelText = (labelEl.textContent||'').trim();
    if (!labelText) continue;
    const sv = container.querySelector('[class*="single-value"],[class*="singleValue"]');
    if (sv && sv.textContent?.trim() && !/^select/i.test(sv.textContent)) continue;
    const desired = matchSelectByLabel(labelText, p);
    if (!desired) continue;
    const trigger = container.querySelector('[class*="select__control"],[class*="__control"]');
    if (!trigger) continue;
    console.log(`🎯 EEOC React Select: "${labelText}" → "${desired}"`);
    const ok = await fillReactSelect(trigger, desired);
    if (ok) { filled++; }
    await delay(300);
  }

  // ── Textareas ──
  const textareas = document.querySelectorAll('textarea:not([disabled])');
  for (const ta of textareas) {
    if (ta.value && ta.value.trim().length > 10) continue;
    const lbl = getLabel(ta).toLowerCase();
    if (/cover.?letter|covering letter/i.test(lbl)) continue;
    const val = matchByLabel(lbl, p);
    if (val) { setReactValue(ta, String(val)); filled++; }
  }

  // ── Radio groups ──
  const groups = document.querySelectorAll('[role="radiogroup"],fieldset');
  for (const g of groups) {
    const legend = (g.querySelector('legend,[role="group"] label,p,h2,h3,h4,[class*="label" i]')?.textContent||'').toLowerCase();
    let desiredAnswer = null;
    if (/sponsor/i.test(legend))                                  desiredAnswer = p.requireSponsorship ? 'yes' : 'no';
    if (/relocat/i.test(legend))                                  desiredAnswer = p.willingToRelocate  ? 'yes' : 'no';
    if (/authoriz|legally.*work|eligible.*work|work.*authoriz/i.test(legend)) desiredAnswer = 'yes';
    if (/currently employ/i.test(legend))                         desiredAnswer = 'no';
    if (/18.*year|adult|of age/i.test(legend))                    desiredAnswer = 'yes';
    if (/veteran/i.test(legend))    desiredAnswer = p.veteranStatus    || 'not a protected veteran';
    if (/disabilit/i.test(legend))  desiredAnswer = p.disabilityStatus || 'no disability';
    if (/background.?check/i.test(legend)) desiredAnswer = 'yes';
    if (/drug.?test/i.test(legend))        desiredAnswer = 'yes';
    if (/gender|sex\b/i.test(legend))  desiredAnswer = p.gender   || 'prefer not to say';
    if (/pronouns?/i.test(legend))     desiredAnswer = p.pronouns || 'prefer not to say';
    if (/race|ethnicit/i.test(legend)) desiredAnswer = p.race     || 'prefer not to say';
    if (!desiredAnswer) continue;

    const radios  = Array.from(g.querySelectorAll('input[type="radio"]'));
    const DECLINE = /prefer not|decline|choose not|not to say|not wish|not disclose|i am not|i do not/i;
    const isEEO   = /veteran|disabilit|gender|race|pronoun/i.test(legend);

    if (isEEO && DECLINE.test(desiredAnswer)) {
      const opt = radios.find(r => DECLINE.test((getLabel(r)+' '+r.value).toLowerCase()));
      if (opt && !opt.checked) { opt.click(); opt.dispatchEvent(new Event('change',{bubbles:true})); }
      continue;
    }

    const radioOpts = radios.map(r => ({ text:(getLabel(r)+' '+(r.value||'')).toLowerCase(), _el:r }));
    const match     = bestMatch(radioOpts, desiredAnswer, 0.35);
    if (match && !match._el.checked) { match._el.click(); match._el.dispatchEvent(new Event('change',{bubbles:true})); }
  }

  // ── Checkboxes ──
  const allCheckboxes = document.querySelectorAll('input[type="checkbox"]:not([disabled])');
  for (const cb of allCheckboxes) {
    if (cb.checked) continue;
    const cbLbl         = getCbLabel(cb).toLowerCase().trim();
    const questionLabel = getCheckboxGroupLabel(cb).toLowerCase().trim();
    const fullText      = (questionLabel+' '+cbLbl).trim();

    if (/pronoun/i.test(questionLabel)) {
      const target = (p.pronouns||'Prefer not to say').toLowerCase();
      if (/prefer not|decline|not to say/i.test(target)) { if (/prefer not|decline|not to say|choose not|opt out/i.test(cbLbl)) { cb.click(); cb.dispatchEvent(new Event('change',{bubbles:true})); filled++; } }
      else { const sim = scoreMatch(target.replace(/\s*\/\s*/g,'/'), cbLbl.replace(/\s*\/\s*/g,'/')); if (sim >= 0.5) { cb.click(); cb.dispatchEvent(new Event('change',{bubbles:true})); filled++; } }
      continue;
    }
    if (/gender|sex\b/i.test(questionLabel)) {
      const target = (p.gender||'Prefer not to say').toLowerCase();
      if (/prefer not|decline|not to say/i.test(target)) { if (/prefer not|decline|not to say|choose not|opt out/i.test(cbLbl)) { cb.click(); cb.dispatchEvent(new Event('change',{bubbles:true})); filled++; } }
      else { if (scoreMatch(target, cbLbl) >= 0.5 || cbLbl.includes(target.split(' ')[0])) { cb.click(); cb.dispatchEvent(new Event('change',{bubbles:true})); filled++; } }
      continue;
    }
    if (/race|ethnicit/i.test(questionLabel)) {
      const target = (p.race||'Prefer not to say').toLowerCase();
      if (/prefer not|decline|not to say/i.test(target)) { if (/prefer not|decline|not to say|choose not|opt out/i.test(cbLbl)) { cb.click(); cb.dispatchEvent(new Event('change',{bubbles:true})); filled++; } }
      else { if (scoreMatch(target, cbLbl) >= 0.5 || cbLbl.includes(target.split(' ')[0])) { cb.click(); cb.dispatchEvent(new Event('change',{bubbles:true})); filled++; } }
      continue;
    }
    if (/veteran|military/i.test(questionLabel)) {
      if (/not a.*veteran|not.*protected|prefer not|decline|choose not|i don|i am not/i.test(cbLbl)) { cb.click(); cb.dispatchEvent(new Event('change',{bubbles:true})); filled++; }
      continue;
    }
    if (/disabilit/i.test(questionLabel)) {
      if (/no.*disab|i do not|prefer not|decline|choose not|not.*disab|i am not|do not have/i.test(cbLbl)) { cb.click(); cb.dispatchEvent(new Event('change',{bubbles:true})); filled++; }
      continue;
    }
    if (/skills?|technologies|tech.?stack|expertise/i.test(questionLabel) && p.skills?.length) {
      const skillList = p.skills.map(s => s.trim().toLowerCase());
      if (skillList.some(s => s && cbLbl && (s === cbLbl || cbLbl.includes(s) || s.includes(cbLbl) || scoreMatch(s,cbLbl) >= 0.7))) { cb.click(); cb.dispatchEvent(new Event('change',{bubbles:true})); filled++; }
      continue;
    }
    if (/work.*type|employment.*type|job.*type|work.*arrangement/i.test(questionLabel)) {
      const target = (p.workType||p.employmentType||'').toLowerCase();
      if (target && (cbLbl.includes(target.split(/[-\s]/)[0])||target.includes(cbLbl)||scoreMatch(target,cbLbl) >= 0.5)) { cb.click(); cb.dispatchEvent(new Event('change',{bubbles:true})); filled++; }
      continue;
    }
    if (questionLabel && questionLabel.length >= 3) {
      let screenerAnswer = null;
      if (/authorized|legally.*work|eligible.*work|right.*work|work.*authoriz/i.test(fullText)) screenerAnswer = true;
      if (/require.*sponsor|need.*sponsor/i.test(fullText))              screenerAnswer = p.requireSponsorship ?? false;
      if (/willing.*relocat|open.*relocat/i.test(fullText))              screenerAnswer = p.willingToRelocate  ?? false;
      if (/18.*year|over.*18|legal.*age|\bof age\b/i.test(fullText))     screenerAnswer = true;
      if (/background.?check/i.test(fullText))                           screenerAnswer = p.backgroundCheck ?? true;
      if (/drug.?test|substance/i.test(fullText))                        screenerAnswer = p.drugTest ?? true;
      if (/driver.?licen/i.test(fullText))                               screenerAnswer = p.driverLicense ?? true;
      if (/full.?time/i.test(fullText))                                  screenerAnswer = true;
      if (/currently.*employ/i.test(fullText))                           screenerAnswer = p.currentlyEmployed ?? false;
      if (/previously.*applied|applied.*before/i.test(fullText))         screenerAnswer = false;
      if (screenerAnswer !== null) {
        const isYes = /^yes$|^yes[\s,]/i.test(cbLbl) || scoreMatch(cbLbl,'yes') > 0.8;
        const isNo  = /^no$|^no[\s,]/i.test(cbLbl)  || scoreMatch(cbLbl,'no')  > 0.8;
        if (screenerAnswer === true  && isYes) { cb.click(); cb.dispatchEvent(new Event('change',{bubbles:true})); filled++; }
        else if (screenerAnswer === false && isNo) { cb.click(); cb.dispatchEvent(new Event('change',{bubbles:true})); filled++; }
        else if (!isYes && !isNo && screenerAnswer === true) { cb.click(); cb.dispatchEvent(new Event('change',{bubbles:true})); filled++; }
        continue;
      }
    }
    let shouldCheck = null;
    if (/i agree|i consent|i acknowledge|i certify|i confirm|i understand|i accept/i.test(fullText)) shouldCheck = true;
    else if (/terms.*service|terms.*use|privacy.?polic|data.*polic|eula|cookie.*polic/i.test(fullText)) shouldCheck = true;
    else if (/background.?check/i.test(fullText))             shouldCheck = p.backgroundCheck  ?? true;
    else if (/drug.?test|substance/i.test(fullText))          shouldCheck = p.drugTest         ?? true;
    else if (/18.*year|over.*18|\bof age\b/i.test(fullText))  shouldCheck = p.over18           ?? true;
    else if (/driver.?licen/i.test(fullText))                 shouldCheck = p.driverLicense    ?? true;
    else if (/authorized|eligible.*work|right.*work|legally.*work/i.test(fullText)) shouldCheck = true;
    else if (/full.?time|open.*work|available.*work|actively.*seek/i.test(fullText)) shouldCheck = true;
    else if (/sponsor/i.test(fullText))                       shouldCheck = p.requireSponsorship ?? false;
    else if (/relocat/i.test(fullText))                       shouldCheck = p.willingToRelocate  ?? false;
    else if (/receive.*email|email.*update|newsletter|job.*alert|marketing/i.test(fullText)) shouldCheck = false;
    if (shouldCheck === true) { cb.click(); cb.dispatchEvent(new Event('change',{bubbles:true})); filled++; }
  }

  return filled;
}

function getCheckboxGroupLabel(cb) {
  let node = cb.parentElement;
  for (let i = 0; i < 7; i++) {
    if (!node || node === document.body) break;
    if (node.tagName === 'FIELDSET') { const legend = node.querySelector(':scope > legend'); if (legend) return legend.textContent||''; }
    if (node.getAttribute?.('role') === 'group') {
      const lid = node.getAttribute('aria-labelledby'); if (lid) { const el = document.getElementById(lid); if (el) return el.textContent||''; }
      const al = node.getAttribute('aria-label'); if (al) return al;
    }
    let sib = node.previousElementSibling;
    while (sib) {
      const tag = sib.tagName?.toLowerCase(); const cls = (sib.className||'').toLowerCase();
      const isLabel = tag==='label'||tag==='legend'||/^h[1-6]$/.test(tag)||/\blabel\b|\bheading\b|\btitle\b|\bquestion\b|\bprompt\b/.test(cls);
      if (isLabel && !sib.querySelector('input,select,textarea')) { const text = (sib.textContent||'').trim(); if (text && text.length > 1 && text.length < 120) return text; }
      sib = sib.previousElementSibling;
    }
    const parent = node.parentElement;
    if (parent) { const candidate = parent.querySelector('label:not(:has(input)):not(:has(select)),legend,h2,h3,h4'); if (candidate && !candidate.contains(cb)) { const text = (candidate.textContent||'').trim(); if (text && text.length > 1 && text.length < 120) return text; } }
    node = node.parentElement;
  }
  return '';
}

function getCbLabel(cb) {
  const wrap = cb.closest('label'); if (wrap) return (wrap.textContent||'').replace(/\s+/g,' ').trim();
  if (cb.id) { const lbl = document.querySelector(`label[for="${CSS.escape(cb.id)}"]`); if (lbl) return (lbl.textContent||'').trim(); }
  if (cb.getAttribute('aria-label')) return cb.getAttribute('aria-label');
  if (cb.getAttribute('aria-labelledby')) { const ids = cb.getAttribute('aria-labelledby').split(' '); return ids.map(id => document.getElementById(id)?.textContent?.trim()).filter(Boolean).join(' '); }
  const next = cb.nextElementSibling; if (next && next.tagName !== 'INPUT') return (next.textContent||'').trim();
  return (cb.parentElement?.textContent||'').replace(/\s+/g,' ').trim().slice(0,80);
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function waitForSelector(selector, timeout = 6000) {
  return new Promise(resolve => {
    if (document.querySelector(selector)) { resolve(); return; }
    const obs = new MutationObserver(() => { if (document.querySelector(selector)) { obs.disconnect(); resolve(); } });
    obs.observe(document.body, { childList:true, subtree:true });
    setTimeout(() => { obs.disconnect(); resolve(); }, timeout);
  });
}

async function fillForm(profile, platform) {
  profile = normalizeProfile(profile);
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
    if (!isApplicationPage()) { console.log('ℹ️ Not an application page — skipping sidebar'); return; }
    await this._checkAuth();
    this._injectStyles();
    this._render();
    watchForApplicationSuccess(this.platform);
    console.log(`✅ Preciprocal sidebar on ${this.platform}`);
  }

  async _checkAuth() {
    try {
      const resp      = await chrome.runtime.sendMessage({ type:'CHECK_AUTH' });
      this.isAuth     = resp.authenticated;
      this.authUserId = resp.user?.uid || resp.user?.userId || null;
      this.authEmail  = resp.user?.email || null;
      const tk        = await chrome.runtime.sendMessage({ type:'GET_TOKEN' });
      this.authToken  = tk.token || tk.idToken || null;
      if (!this.authToken && this.authUserId) this.authToken = this.authUserId;
    } catch (err) { console.warn('⚠️ Auth check failed:', err.message); }
  }

  _platformLabel() {
    return { greenhouse:'Greenhouse', lever:'Lever', workday:'Workday', indeed:'Indeed', ashby:'Ashby', icims:'iCIMS', jobvite:'Jobvite', smartrecruiters:'SmartRecruiters', taleo:'Taleo', bamboohr:'BambooHR', recruitee:'Recruitee', wellfound:'Wellfound', generic:'Application' }[this.platform] || 'Application';
  }

  _countPageFields() {
    const inputs  = document.querySelectorAll('input:not([type="hidden"]):not([type="file"]):not([type="submit"]):not([type="button"]):not([type="checkbox"]):not([type="radio"]):not([disabled])');
    const selects = document.querySelectorAll('select:not([disabled])');
    return inputs.length + selects.length;
  }

  _getFieldStatuses() {
    const check = (selectors) => { for (const s of selectors) { try { const el = document.querySelector(s); if (el && el.value && el.value.trim()) return true; } catch {} } return false; };
    return [
      { label:'Name',       filled:check(['input[name="first_name"]','#first_name','input[name="firstName"]','input[name="name"]']) },
      { label:'Phone',      filled:check(['input[type="tel"]','input[name="phone"]','#phone']) },
      { label:'Email',      filled:check(['input[type="email"]','input[name="email"]','#email']) },
      { label:'Experience', filled:check(['input[name="org"]','input[name*="company"]','[data-automation-id="addressSection_addressLine1"] input']) },
    ];
  }

  _render() {
    document.getElementById('prc-sidebar')?.remove();
    const sidebar = document.createElement('div');
    sidebar.id = 'prc-sidebar';
    const platformName = this._platformLabel();
    const fields = this._getFieldStatuses();
    const filledCount = fields.filter(f => f.filled).length;
    const _iconUrl = (typeof chrome !== 'undefined' && chrome.runtime?.getURL) ? chrome.runtime.getURL('icons/icon48.png') : '';
    const jobInfo = extractJobInfoFromPage();
    const displayTitle   = jobInfo.jobTitle !== 'Unknown Position' ? jobInfo.jobTitle : platformName + ' Application';
    const displayCompany = jobInfo.company  !== 'Unknown Company'  ? jobInfo.company  : window.location.hostname.split('.')[0];
    const pills = [
      jobInfo.workArrangement && `<span class="prc-pill">${jobInfo.workArrangement}</span>`,
      jobInfo.jobType         && `<span class="prc-pill">${jobInfo.jobType}</span>`,
      jobInfo.seniority       && `<span class="prc-pill prc-pill-subtle">${jobInfo.seniority}</span>`,
      jobInfo.location        && `<span class="prc-pill prc-pill-subtle">📍 ${jobInfo.location.slice(0,24)}</span>`,
      jobInfo.salary          && `<span class="prc-pill prc-pill-green">💰 ${jobInfo.salary.slice(0,28)}</span>`,
    ].filter(Boolean).join('');

    sidebar.innerHTML = `
      <div id="prc-sidebar-inner">
        <div class="prc-header" id="prc-drag-handle">
          <div class="prc-brand">
            <div class="prc-logo">${_iconUrl ? `<img src="${_iconUrl}" width="22" height="22" alt="Preciprocal" style="display:block;border-radius:5px;">` : `<svg width="16" height="16" viewBox="0 0 64 64" fill="none"><path d="M32 10L54 32L32 54L10 32L32 10Z" fill="#7c3aed" opacity="0.9"/><path d="M32 22L42 32L32 42L22 32L32 22Z" fill="#7c3aed"/></svg>`}</div>
            <span class="prc-brand-name">Preciprocal</span>
          </div>
          <button class="prc-close-btn" id="prc-collapse-btn" title="Minimize"><svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg></button>
        </div>
        <div class="prc-job-card">
          <div class="prc-company-row">
            <div class="prc-company-avatar">${displayCompany.charAt(0).toUpperCase()}</div>
            <div class="prc-company-info">
              <div class="prc-company-name">${displayCompany}</div>
              <div class="prc-platform-badge">${platformName}</div>
            </div>
            <div class="prc-match-ring" id="prc-match-ring">
              <svg width="44" height="44" viewBox="0 0 44 44"><circle cx="22" cy="22" r="17" fill="none" stroke="#e5e7eb" stroke-width="3.5"/><circle cx="22" cy="22" r="17" fill="none" stroke="#7c3aed" stroke-width="3.5" stroke-dasharray="106.8" stroke-dashoffset="106.8" stroke-linecap="round" transform="rotate(-90 22 22)" id="prc-ring-progress"/></svg>
              <span class="prc-match-pct" id="prc-match-pct">–</span>
            </div>
          </div>
          <div class="prc-job-title">${displayTitle}</div>
          ${pills ? `<div class="prc-pills-row">${pills}</div>` : ''}
        </div>
        ${!this.isAuth ? `
          <div class="prc-body">
            <p class="prc-section-title">Sign in to auto-fill</p>
            <p class="prc-section-sub">Fill this ${platformName} form instantly with your saved profile.</p>
            <button class="prc-cta" id="prc-signin-btn">Sign In to Preciprocal</button>
            <p class="prc-footer-note">Free to get started · No credit card required</p>
          </div>
        ` : `
          <div class="prc-body">
            <div class="prc-completion-section">
              <div class="prc-completion-header"><span class="prc-completion-label">Completion</span><span class="prc-completion-pct" id="prc-completion-pct">0%</span></div>
              <div class="prc-progress-track"><div class="prc-progress-fill" id="prc-progress-fill" style="width:0%"></div></div>
            </div>
            <div class="prc-fields-section">
              <div class="prc-fields-label">Required (${filledCount}/${fields.length} filled)</div>
              <div class="prc-fields-list" id="prc-fields-list">
                ${fields.map(f => `<div class="prc-field-row" data-field="${f.label.toLowerCase()}"><div class="prc-field-dot ${f.filled?'filled':'empty'}">${f.filled?`<svg width="9" height="9" fill="none" viewBox="0 0 24 24" stroke="white" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>`:`<div class="prc-dash"></div>`}</div><span class="prc-field-label">${f.label}</span></div>`).join('')}
              </div>
            </div>
            <div id="prc-fill-status" class="prc-status-msg" style="display:none;"></div>
            <div id="prc-file-status" class="prc-file-section" style="display:none;">
              <div id="prc-resume-status" class="prc-file-row"></div>
              <div id="prc-transcript-status" class="prc-file-row"></div>
            </div>
            <button class="prc-cta" id="prc-autofill-btn">
              <span id="prc-fill-icon"><svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg></span>
              <span id="prc-fill-label">Autofill</span>
            </button>
            <div class="prc-credits-row"><button class="prc-rerun-link" id="prc-rerun-btn">Re-run fill</button></div>
          </div>
        `}
      </div>
      <button id="prc-expand-btn" class="prc-tab" title="Open Preciprocal">
        ${_iconUrl ? `<img src="${_iconUrl}" width="28" height="28" alt="" style="display:block;border-radius:7px;">` : `<svg width="18" height="18" viewBox="0 0 64 64" fill="none"><path d="M32 10L54 32L32 54L10 32L32 10Z" fill="#7c3aed" opacity="0.85"/><path d="M32 22L42 32L32 42L22 32L32 22Z" fill="#7c3aed"/></svg>`}
      </button>
    `;
    document.body.appendChild(sidebar);
    this._listen();
    this._animateRing(0);
  }

  _animateRing(pct) {
    const circle = document.getElementById('prc-ring-progress');
    const label  = document.getElementById('prc-match-pct');
    if (!circle || !label) return;
    const offset = 106.8 - (pct / 100) * 106.8;
    circle.style.transition = 'stroke-dashoffset 0.7s cubic-bezier(0.4,0,0.2,1)';
    circle.style.strokeDashoffset = offset;
    label.textContent = pct > 0 ? pct + '%' : '–';
  }

  _updateCompletion(pct) {
    const fill  = document.getElementById('prc-progress-fill');
    const label = document.getElementById('prc-completion-pct');
    if (fill)  fill.style.width = pct + '%';
    if (label) label.textContent = pct + '%';
    this._animateRing(pct);
  }

  _updateFieldChecks() {
    const fields = this._getFieldStatuses();
    const filledCount = fields.filter(f => f.filled).length;
    const list = document.getElementById('prc-fields-list');
    if (!list) return;
    list.innerHTML = fields.map(f => `<div class="prc-field-row" data-field="${f.label.toLowerCase()}"><div class="prc-field-dot ${f.filled?'filled':'empty'}">${f.filled?`<svg width="9" height="9" fill="none" viewBox="0 0 24 24" stroke="white" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>`:`<div class="prc-dash"></div>`}</div><span class="prc-field-label">${f.label}</span></div>`).join('');
    const label = document.querySelector('.prc-fields-label');
    if (label) label.textContent = `Required (${filledCount}/${fields.length} filled)`;
  }

  _listen() {
    document.getElementById('prc-collapse-btn')?.addEventListener('click', () => {
      document.getElementById('prc-sidebar-inner').style.display = 'none';
      document.getElementById('prc-expand-btn').style.display    = 'flex';
    });
    document.getElementById('prc-expand-btn')?.addEventListener('click', () => {
      if (this._wasDragging) { this._wasDragging = false; return; }
      document.getElementById('prc-sidebar-inner').style.display = 'flex';
      document.getElementById('prc-expand-btn').style.display    = 'none';
    });
    document.getElementById('prc-signin-btn')?.addEventListener('click', () => window.open(`${PRECIPROCAL_URL}/sign-in`, '_blank'));
    document.getElementById('prc-autofill-btn')?.addEventListener('click', () => this._run());
    document.getElementById('prc-rerun-btn')?.addEventListener('click',   () => this._rerun());

    const sidebar = document.getElementById('prc-sidebar');
    const header  = document.getElementById('prc-drag-handle');
    const tab     = document.getElementById('prc-expand-btn');
    if (!sidebar) return;

    this._wasDragging = false;
    let dragging = false, startY = 0, startTop = 0, moved = false;
    const getTop = () => sidebar.getBoundingClientRect().top;
    const startDrag = (e) => {
      if (e.target.closest('button') && e.currentTarget === header) return;
      e.preventDefault(); dragging = true; moved = false;
      if (!sidebar.style.top || sidebar.style.top === '') { sidebar.style.top = getTop() + 'px'; sidebar.style.transform = 'none'; }
      startY = e.clientY; startTop = parseInt(sidebar.style.top, 10) || getTop();
      document.body.style.cursor = 'grabbing';
    };
    const onMove = (e) => {
      if (!dragging) return;
      const delta = e.clientY - startY;
      if (Math.abs(delta) > 3) moved = true;
      sidebar.style.top = Math.max(0, Math.min(window.innerHeight - sidebar.offsetHeight, startTop + delta)) + 'px';
    };
    const endDrag = () => { if (!dragging) return; dragging = false; document.body.style.cursor = ''; if (moved) this._wasDragging = true; };

    if (header) header.addEventListener('mousedown', startDrag);
    if (tab)    tab.addEventListener('mousedown',    startDrag);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup',   endDrag);
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
    if (icon)  icon.innerHTML    = '<span class="prc-spinner"></span>';

    try {
      if (!this.profile) {
        try {
          const s   = await chrome.storage.local.get(['preciprocal_auto_apply_profile','preciprocal_auto_apply_timestamp','preciprocal_auto_apply_files']);
          const age = Date.now() - (s.preciprocal_auto_apply_timestamp || 0);
          if (s.preciprocal_auto_apply_profile && age < 5 * 60 * 1000) { this.profile = s.preciprocal_auto_apply_profile; this.files = s.preciprocal_auto_apply_files || null; }
        } catch {}
      }

      if (!this.profile) {
        if (!this.authToken) throw new Error('Not signed in — open the extension and sign in first');
        if (label) label.textContent = 'Fetching profile…';
        const res = await fetch(`${PRECIPROCAL_URL}/api/extension/auto-apply`, {
          headers: { 'x-extension-token':this.authToken, 'x-user-email':this.authEmail||'', 'x-user-id':this.authUserId||'' },
        });
        if (!res.ok) { const e = await res.json().catch(()=>({})); throw new Error(e.error || `HTTP ${res.status}`); }
        const data   = await res.json();
        this.profile = data.applyProfile;
        this.files   = data.files || null;
      }

      if (!this.profile) throw new Error('Profile unavailable');

      try {
        await chrome.storage.local.set({ preciprocal_auto_apply_profile:this.profile, preciprocal_auto_apply_files:this.files||null, preciprocal_auto_apply_timestamp:Date.now() });
      } catch {}

      if (label) label.textContent = 'Filling form…';
      const onDetailPage = isJobDetailPage();
      if (onDetailPage) {
        const clicked = await clickApplyAndWaitForForm(statusEl);
        if (!clicked) { if (label) label.textContent = 'Opened in new tab'; btn?.classList.remove('loading'); this.state = 'filled'; return; }
        await delay(800);
      }

      const { filled } = await fillForm(this.profile, this.platform);

      if (label) label.textContent = 'Uploading files…';
      await this._injectFiles(fileEl);

      this.state = 'filled';
      btn?.classList.remove('loading'); btn?.classList.add('done');
      if (icon)  icon.innerHTML = '<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>';
      if (label) label.textContent = `${filled} fields filled`;

      const totalOnPage = this._countPageFields();
      const pct = totalOnPage > 0 ? Math.min(100, Math.round((filled / totalOnPage) * 100)) : 100;
      this._updateCompletion(pct);
      this._updateFieldChecks();

      if (statusEl) { statusEl.style.display='flex'; statusEl.innerHTML=`<svg width="12" height="12" fill="none" viewBox="0 0 24 24" stroke="#7c3aed" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg><span>Review all fields before submitting</span>`; }
    } catch (err) {
      console.error('❌ Autofill error:', err);
      this.state = 'error';
      btn?.classList.remove('loading');
      if (icon)  icon.innerHTML = '<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>';
      if (label) label.textContent = 'Try again';
      if (statusEl) { statusEl.style.display='flex'; statusEl.classList.add('error'); statusEl.innerHTML=`<span>${err.message||'Auto-fill failed'}</span>`; }
      setTimeout(() => {
        if (icon) icon.innerHTML = '<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>';
        if (label) label.textContent = 'Autofill';
        if (statusEl) { statusEl.style.display='none'; statusEl.classList.remove('error'); }
        this.state = 'idle'; btn?.classList.remove('error');
      }, 4000);
    }
  }

  async _rerun() {
    if (this.state === 'loading') return;
    this.state = 'idle';
    const btn    = document.getElementById('prc-autofill-btn');
    const status = document.getElementById('prc-fill-status');
    const fileEl = document.getElementById('prc-file-status');
    btn?.classList.remove('done','error');
    if (status) { status.style.display='none'; status.innerHTML=''; }
    if (fileEl)   fileEl.style.display = 'none';
    await delay(150);
    this._run();
  }

  async _injectFiles(fileEl) {
    const result = { resume:false, transcript:false };
    if (!this.files) return result;
    if (fileEl) fileEl.style.display = 'block';
    const { resume, transcript } = FileInjector.classify();
    if (this.files.resume?.available && this.files.resume.url) {
      this._setFileRow('prc-resume-status','Resume','uploading');
      const n = await FileInjector.injectFromUrl(this.files.resume.url, this.files.resume.fileName, resume);
      result.resume = n > 0;
      this._setFileRow('prc-resume-status','Resume', result.resume ? 'done' : 'manual');
    } else if (this.files.resume && !this.files.resume.available) { this._setFileRow('prc-resume-status','Resume','missing'); }
    if (this.files.transcript?.available && this.files.transcript.url) {
      this._setFileRow('prc-transcript-status','Transcript','uploading');
      const n = await FileInjector.injectFromUrl(this.files.transcript.url, this.files.transcript.fileName, transcript);
      result.transcript = n > 0;
      this._setFileRow('prc-transcript-status','Transcript', result.transcript ? 'done' : 'manual');
    } else if (this.files.transcript && !this.files.transcript.available) { this._setFileRow('prc-transcript-status','Transcript','missing'); }
    return result;
  }

  _setFileRow(id, label, state) {
    const el = document.getElementById(id); if (!el) return;
    const configs = { uploading:{icon:'⏳',text:'Uploading…',cls:'uploading'}, done:{icon:'✓',text:'Uploaded',cls:'done'}, manual:{icon:'⚠',text:'Attach manually',cls:'manual'}, missing:{icon:'–',text:'Not in profile',cls:'missing'} };
    const c = configs[state] || configs.missing;
    el.innerHTML = `<span class="prc-file-icon prc-file-${c.cls}">${c.icon}</span><span>${label}</span><span class="prc-file-state prc-file-${c.cls}">${c.text}</span>`;
  }

  _injectStyles() {
    if (document.getElementById('prc-sidebar-styles')) return;
    const s = document.createElement('style');
    s.id = 'prc-sidebar-styles';
    s.textContent = `
      @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
      #prc-sidebar { position:fixed;top:50%;right:0;transform:translateY(-50%);z-index:2147483647;display:flex;align-items:center;font-family:'DM Sans',-apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;-webkit-font-smoothing:antialiased;user-select:none;-webkit-user-select:none; }
      #prc-sidebar-inner { display:flex;flex-direction:column;width:280px;background:#ffffff;border:1.5px solid #e8e8ed;border-right:none;border-radius:20px 0 0 20px;box-shadow:-6px 0 32px rgba(0,0,0,0.09),-1px 0 6px rgba(0,0,0,0.04);overflow:hidden; }
      .prc-header { display:flex;align-items:center;justify-content:space-between;padding:14px 16px 12px;cursor:grab;background:#ffffff;border-bottom:1.5px solid #f0f0f5; }
      .prc-header:active { cursor:grabbing; }
      .prc-brand { display:flex;align-items:center;gap:8px; }
      .prc-logo { width:30px;height:30px;border-radius:8px;background:#f3f0ff;border:1.5px solid #e0d9ff;display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0; }
      .prc-brand-name { font-size:14px;font-weight:800;color:#0f0f13;letter-spacing:-0.04em; }
      .prc-close-btn { width:26px;height:26px;background:#f5f5f8;border:none;border-radius:50%;color:#9999aa;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background 0.15s,color 0.15s;flex-shrink:0; }
      .prc-close-btn:hover { background:#ebebf0;color:#333; }
      .prc-job-card { padding:14px 16px 12px;background:#fafafa;border-bottom:1.5px solid #f0f0f5; }
      .prc-company-row { display:flex;align-items:center;gap:10px;margin-bottom:10px; }
      .prc-company-avatar { width:36px;height:36px;background:#1a1a2e;color:#fff;border-radius:10px;font-size:15px;font-weight:800;display:flex;align-items:center;justify-content:center;flex-shrink:0;letter-spacing:-0.02em; }
      .prc-company-info { flex:1;min-width:0; }
      .prc-company-name { font-size:13px;font-weight:700;color:#0f0f13;letter-spacing:-0.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
      .prc-platform-badge { font-size:11px;color:#888;font-weight:500;margin-top:1px; }
      .prc-match-ring { position:relative;width:44px;height:44px;flex-shrink:0;display:flex;align-items:center;justify-content:center; }
      .prc-match-ring svg { position:absolute;top:0;left:0; }
      .prc-match-pct { font-size:10px;font-weight:800;color:#7c3aed;position:relative;z-index:1;letter-spacing:-0.03em; }
      .prc-job-title { font-size:13.5px;font-weight:700;color:#0f0f13;letter-spacing:-0.03em;line-height:1.35;text-decoration:underline;text-decoration-color:#0f0f13;text-underline-offset:2px;margin-bottom:8px; }
      .prc-pills-row { display:flex;flex-wrap:wrap;gap:4px;margin-top:2px; }
      .prc-pill { display:inline-block;padding:2px 7px;font-size:10.5px;font-weight:700;border-radius:999px;background:#ede9fe;color:#6d28d9;letter-spacing:-0.01em;white-space:nowrap; }
      .prc-pill-subtle { background:#f1f5f9;color:#475569; }
      .prc-pill-green { background:#dcfce7;color:#15803d; }
      .prc-body { padding:14px 16px 16px;display:flex;flex-direction:column;gap:12px; }
      .prc-section-title { font-size:14px;font-weight:800;color:#0f0f13;margin:0;letter-spacing:-0.03em; }
      .prc-section-sub { font-size:12px;color:#888;margin:0;line-height:1.5; }
      .prc-footer-note { text-align:center;font-size:11px;color:#bbb;margin:0;font-weight:500; }
      .prc-completion-section { display:flex;flex-direction:column;gap:6px; }
      .prc-completion-header { display:flex;align-items:center;justify-content:space-between; }
      .prc-completion-label { font-size:12.5px;font-weight:700;color:#0f0f13;letter-spacing:-0.02em; }
      .prc-completion-pct { font-size:12.5px;font-weight:700;color:#0f0f13; }
      .prc-progress-track { height:6px;background:#ebebf0;border-radius:999px;overflow:hidden; }
      .prc-progress-fill { height:100%;background:#7c3aed;border-radius:999px;transition:width 0.6s cubic-bezier(0.4,0,0.2,1); }
      .prc-fields-section { display:flex;flex-direction:column;gap:7px; }
      .prc-fields-label { font-size:12px;font-weight:700;color:#0f0f13;letter-spacing:-0.01em; }
      .prc-fields-list { display:flex;flex-direction:column;gap:5px; }
      .prc-field-row { display:flex;align-items:center;gap:8px; }
      .prc-field-dot { width:20px;height:20px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;transition:background 0.2s,border-color 0.2s; }
      .prc-field-dot.filled { background:#7c3aed;border:none; }
      .prc-field-dot.empty { background:#ffffff;border:2px solid #e0e0ea; }
      .prc-dash { width:6px;height:2px;background:#d0d0dc;border-radius:1px; }
      .prc-field-label { font-size:12.5px;font-weight:600;color:#444;letter-spacing:-0.01em; }
      .prc-status-msg { display:flex;align-items:center;gap:6px;font-size:11.5px;color:#7c3aed;font-weight:600;padding:0 2px; }
      .prc-status-msg.error { color:#dc2626; }
      .prc-file-section { display:flex;flex-direction:column;gap:5px;padding:9px 11px;background:#f9f9fc;border:1.5px solid #ebebf0;border-radius:10px; }
      .prc-file-row { display:flex;align-items:center;gap:7px;font-size:11px;color:#666;font-weight:600; }
      .prc-file-icon { font-size:11px;flex-shrink:0; }
      .prc-file-state { margin-left:auto;font-size:10.5px;font-weight:700; }
      .prc-file-done { color:#16a34a; } .prc-file-uploading { color:#2563eb; } .prc-file-manual { color:#d97706; } .prc-file-missing { color:#ccc; }
      .prc-cta { display:flex;align-items:center;justify-content:center;gap:7px;width:100%;padding:13px 16px;background:#7c3aed;color:#fff;font-size:15px;font-weight:800;letter-spacing:-0.02em;border:none;border-radius:12px;cursor:pointer;font-family:inherit;transition:background 0.15s,transform 0.1s,box-shadow 0.15s;box-shadow:0 2px 12px rgba(124,58,237,0.3); }
      .prc-cta:hover { background:#6d28d9;box-shadow:0 4px 20px rgba(124,58,237,0.4);transform:translateY(-1px); }
      .prc-cta:active { transform:translateY(0); }
      .prc-cta.loading { opacity:0.65;cursor:wait;pointer-events:none; }
      .prc-cta.done { background:#16a34a;box-shadow:0 2px 10px rgba(22,163,74,0.25);pointer-events:none; }
      .prc-cta.error { background:#dc2626;box-shadow:none; }
      .prc-credits-row { display:flex;align-items:center;justify-content:center; }
      .prc-rerun-link { background:none;border:none;cursor:pointer;font-family:inherit;font-size:12px;color:#aaa;padding:0;font-weight:600;letter-spacing:-0.01em;text-decoration:underline;text-underline-offset:2px;transition:color 0.15s; }
      .prc-rerun-link:hover { color:#7c3aed; }
      .prc-spinner { display:inline-block;width:13px;height:13px;border:2.5px solid rgba(255,255,255,0.35);border-top-color:#fff;border-radius:50%;animation:prc-spin 0.65s linear infinite;vertical-align:middle; }
      @keyframes prc-spin { to { transform:rotate(360deg); } }
      .prc-tab { display:none;width:48px;height:48px;background:#ffffff;border:1.5px solid #e8e8ed;border-right:none;border-radius:14px 0 0 14px;cursor:grab;align-items:center;justify-content:center;box-shadow:-2px 0 12px rgba(0,0,0,0.07);transition:background 0.15s,box-shadow 0.15s;padding:0; }
      .prc-tab:hover { background:#f5f0ff;box-shadow:-3px 0 16px rgba(124,58,237,0.14);border-color:#ddd6fe; }
      .prc-tab:active { cursor:grabbing; }
      @media (max-width:900px) { #prc-sidebar-inner { width:260px; } }
      @media print { #prc-sidebar { display:none !important; } }
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
  _applicationTracked = false;
  await delay(500);
  if (!isApplicationPage()) return;
  _instance = new PreciprocalSidebar();
  await _instance.init();

  if (!_autoFilling) {
    try {
      const stored = await chrome.storage.local.get(['preciprocal_auto_apply_profile','preciprocal_auto_apply_timestamp','preciprocal_auto_apply_files']);
      const age    = Date.now() - (stored.preciprocal_auto_apply_timestamp || 0);
      if (stored.preciprocal_auto_apply_profile && age < 10 * 60 * 1000) {
        console.log('⚡ Preciprocal: auto-triggering fill on new page');
        _autoFilling = true;
        await delay(3000);
        const platform = detectPlatform();
        const profile  = stored.preciprocal_auto_apply_profile;
        const label    = document.getElementById('prc-fill-label');
        const icon     = document.getElementById('prc-fill-icon');
        if (label) label.textContent = 'Auto-filling…';
        if (icon)  icon.innerHTML    = '<span class="prc-spinner"></span>';
        document.getElementById('prc-autofill-btn')?.classList.add('loading');
        const statusEl = document.getElementById('prc-fill-status');
        const onDetail = isJobDetailPage();
        if (onDetail) { await clickApplyAndWaitForForm(statusEl); await delay(800); }
        const { filled } = await fillForm(profile, platform);
        const btn = document.getElementById('prc-autofill-btn');
        btn?.classList.remove('loading'); btn?.classList.add('done');
        if (icon)  icon.innerHTML = '<svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="3"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>';
        if (label) label.textContent = `${filled} fields filled`;
        if (_instance) {
          const totalOnPage = _instance._countPageFields();
          const pct = totalOnPage > 0 ? Math.min(100, Math.round((filled / totalOnPage) * 100)) : 100;
          _instance._updateCompletion(pct);
          _instance._updateFieldChecks();
        }
        _autoFilling = false;
      }
    } catch (err) { console.warn('⚠️ Auto-fill on navigation failed:', err.message); _autoFilling = false; }
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
    const emptyRequired = document.querySelectorAll('[data-automation-id*="firstName"] input:placeholder-shown,[data-automation-id*="lastName"] input:placeholder-shown,[data-automation-id*="email"] input:placeholder-shown');
    if (emptyRequired.length > 0) { console.log('🔵 Preciprocal: detected new empty fields, re-triggering fill'); await onNavigation(); }
  }, 1500);
});
_domObserver.observe(document.body, { childList:true, subtree:false });

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 800)); }
else { setTimeout(boot, 800); }
setTimeout(boot, 2500);

console.log('✅ Preciprocal external-apply.js ready (auto-fill + job tracker + SPA navigation watcher)');
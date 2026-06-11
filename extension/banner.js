// banner.js - LinkedIn-integrated banner with Preciprocal job tracker + Universal Auto Apply

console.log('🎯 Preciprocal banner.js loaded on:', window.location.href);

const IS_DEV = false;
const PRECIPROCAL_URL = IS_DEV ? 'http://localhost:3000' : 'https://app.preciprocal.com';

// ─────────────────────────────────────────────────────────────────
// Job Card Label Injector - chip sits inline with the job title
// ─────────────────────────────────────────────────────────────────

class LabelInjector {
  static STORAGE_KEY = 'preciprocal_card_labels';

  static _injectGlobalStyles() {
    if (document.getElementById('prc-chip-global-styles')) return;
    const s = document.createElement('style');
    s.id = 'prc-chip-global-styles';
    s.textContent = `
      .prc-card-chip {
        display: inline-flex !important;
        align-items: center !important;
        flex-shrink: 0 !important;
        padding: 2px 7px !important;
        border-radius: 4px !important;
        font-size: 10px !important;
        font-weight: 700 !important;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
        white-space: nowrap !important;
        line-height: 1.5 !important;
        letter-spacing: 0.05em !important;
        text-transform: uppercase !important;
        pointer-events: none !important;
        user-select: none !important;
        vertical-align: middle !important;
      }
      .prc-card-chip.prc-chip-saved {
        background: rgba(16,185,129,0.15) !important;
        color: #34d399 !important;
        border: 1px solid rgba(16,185,129,0.4) !important;
      }
      .prc-card-chip.prc-chip-applied {
        background: rgba(99,102,241,0.18) !important;
        color: #a5b4fc !important;
        border: 1px solid rgba(99,102,241,0.45) !important;
      }
    `;
    document.head.appendChild(s);
  }

  static _chipEl(type) {
    const span = document.createElement('span');
    span.className = `prc-card-chip ${type === 'applied' ? 'prc-chip-applied' : 'prc-chip-saved'}`;
    span.setAttribute('data-prc-chip', type);
    // Full inline style fallback - survives LinkedIn style resets
    const base = 'display:inline-flex!important;align-items:center!important;flex-shrink:0!important;gap:3px!important;padding:1px 6px!important;border-radius:4px!important;font-size:9px!important;font-weight:700!important;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;white-space:nowrap!important;line-height:1.6!important;letter-spacing:0.06em!important;text-transform:uppercase!important;pointer-events:none!important;user-select:none!important;vertical-align:middle!important;';
    if (type === 'applied') {
      span.style.cssText = base + 'background:rgba(99,102,241,0.15)!important;color:#a5b4fc!important;border:1px solid rgba(99,102,241,0.4)!important;';
      span.textContent = 'Applied';
    } else {
      span.style.cssText = base + 'background:rgba(16,185,129,0.15)!important;color:#34d399!important;border:1px solid rgba(16,185,129,0.4)!important;';
      span.textContent = 'Saved';
    }
    return span;
  }

  static _findCard(jobId) {
    if (!jobId) return null;
    const el1 = document.querySelector(`[data-occludable-job-id="${jobId}"]`);
    if (el1) return el1.closest('li') || el1;
    const el2 = document.querySelector(`[data-job-id="${jobId}"]`);
    if (el2) return el2.closest('li') || el2;
    const el3 = document.querySelector(`a[href*="/jobs/view/${jobId}"]`);
    if (el3) return el3.closest('li') || el3.closest('[class*="job-card"]') || el3.parentElement;
    const el4 = document.querySelector(`[data-entity-urn*="${jobId}"]`);
    if (el4) return el4.closest('li') || el4;
    return null;
  }

  // Find the job title element inside the card
  static _findTitleEl(card) {
    const selectors = [
      // Linked title anchors (most common in search results)
      'a[class*="job-card-list__title"]',
      'a[class*="job-card-container__link"]',
      'a[class*="disabled"]', // LinkedIn uses "disabled" class on the title link
      // Strong/span title text
      'strong[class*="job-card"]',
      'span[class*="job-card-list__title"]',
      // Generic heading fallback
      '[class*="job-card"] h3',
      '[class*="job-card"] h4',
    ];
    for (const sel of selectors) {
      const el = card.querySelector(sel);
      if (el && el.textContent?.trim()) return el;
    }
    // Fallback: first link with text content
    const links = card.querySelectorAll('a');
    for (const link of links) {
      if (link.textContent?.trim().length > 5) return link;
    }
    return null;
  }

  static inject(jobId, type) {
    if (!jobId) return;
    LabelInjector._injectGlobalStyles();

    const card = LabelInjector._findCard(jobId);
    if (!card) {
      LabelInjector._persistLabel(jobId, type);
      LabelInjector._scheduleRetry(jobId, type, 0);
      return;
    }

    // Remove any existing chip for this card
    card.querySelectorAll('[data-prc-chip]').forEach(el => el.remove());

    const chip = LabelInjector._chipEl(type);

    // Target: the dismiss (✕) button - place chip immediately before it in the same row
    const dismissBtn = card.querySelector(
      'button[aria-label*="ismiss"], button[aria-label*="iscard"], button[data-control-name*="dismiss"]'
    );

    if (dismissBtn) {
      const parent = dismissBtn.parentElement;
      // Make sure the parent is a flex row so chip and button align
      parent.style.cssText += ';display:flex!important;align-items:center!important;gap:6px!important;';
      parent.insertBefore(chip, dismissBtn);
      console.log(`[PRC] ✅ Chip "${type}" injected beside dismiss btn for jobId: ${jobId}`);
    } else {
      // Fallback: absolute position top-right of card, before where ✕ would be
      card.style.setProperty('position', 'relative', 'important');
      chip.style.cssText += ';position:absolute!important;top:10px!important;right:36px!important;z-index:9999!important;';
      card.appendChild(chip);
      console.log(`[PRC] ✅ Chip "${type}" injected absolute top-right for jobId: ${jobId}`);
    }

    LabelInjector._persistLabel(jobId, type);
  }

  static async _persistLabel(jobId, type) {
    try {
      const result = await chrome.storage.local.get([LabelInjector.STORAGE_KEY]);
      const labels = result[LabelInjector.STORAGE_KEY] || {};
      labels[jobId] = type;
      await chrome.storage.local.set({ [LabelInjector.STORAGE_KEY]: labels });
    } catch {}
  }

  static _scheduleRetry(jobId, type, attempts) {
    if (attempts > 10) return;
    const delays = [400, 800, 1500, 2500, 4000, 6000, 9000, 13000, 18000, 24000];
    setTimeout(() => {
      const card = LabelInjector._findCard(jobId);
      if (card) LabelInjector.inject(jobId, type);
      else LabelInjector._scheduleRetry(jobId, type, attempts + 1);
    }, delays[attempts] || 5000);
  }

  static async seedFromMap(jobIds) {
    if (!jobIds || !Object.keys(jobIds).length) return;
    try {
      const result = await chrome.storage.local.get([LabelInjector.STORAGE_KEY]);
      const existing = result[LabelInjector.STORAGE_KEY] || {};
      await chrome.storage.local.set({ [LabelInjector.STORAGE_KEY]: { ...existing, ...jobIds } });
    } catch {}
    for (const [jobId, type] of Object.entries(jobIds)) {
      LabelInjector._scheduleRetry(jobId, type, 0);
    }
  }

  static async getLabelForJob(jobId) {
    if (!jobId) return null;
    try {
      const result = await chrome.storage.local.get([LabelInjector.STORAGE_KEY]);
      return (result[LabelInjector.STORAGE_KEY] || {})[jobId] || null;
    } catch { return null; }
  }

  static debugCards() {
    const url = window.location.href;
    console.log('[PRC DEBUG] URL:', url);
    try { console.log('[PRC DEBUG] currentJobId:', new URL(url).searchParams.get('currentJobId')); } catch {}
    const occ = document.querySelectorAll('[data-occludable-job-id]');
    console.log(`[PRC DEBUG] data-occludable-job-id: ${occ.length}`);
    occ.forEach(el => {
      const id = el.getAttribute('data-occludable-job-id');
      const card = el.closest('li');
      const titleEl = card ? LabelInjector._findTitleEl(card) : null;
      console.log(`  jobId=${id} hasCard=${!!card} titleEl=${titleEl?.tagName} titleText="${titleEl?.textContent?.trim().substring(0,40)}"`);
    });
    chrome.storage.local.get(['preciprocal_card_labels'], r => console.log('[PRC DEBUG] labels:', r.preciprocal_card_labels));
  }
}

// ─────────────────────────────────────────────────────────────────
// Job data extractor
// ─────────────────────────────────────────────────────────────────

class JobExtractor {
  extractJobData() {
    try {
      const titleEl = document.querySelector(
        'h1.job-details-jobs-unified-top-card__job-title, h1.t-24, h1.jobs-unified-top-card__job-title'
      );
      const jobTitle = titleEl?.textContent?.trim() || 'Unknown Position';
      let companyName = 'Unknown Company';
      for (const sel of ['a.job-details-jobs-unified-top-card__company-name','.jobs-unified-top-card__company-name a','.jobs-unified-top-card__company-name','.job-details-jobs-unified-top-card__company-name','a[data-tracking-control-name="public_jobs_topcard-org-name"]','.topcard__org-name-link','.jobs-company__name']) {
        const el = document.querySelector(sel); if (el?.textContent?.trim()) { companyName = el.textContent.trim(); break; }
      }
      let location = '';
      for (const sel of ['.job-details-jobs-unified-top-card__bullet','.jobs-unified-top-card__bullet','.job-details-jobs-unified-top-card__primary-description','span.jobs-unified-top-card__subtitle-primary-grouping span:last-child','.topcard__flavor--bullet']) {
        const el = document.querySelector(sel); if (el?.textContent?.trim()) { location = el.textContent.trim(); break; }
      }
      const descEl = document.querySelector('.jobs-description__content, .jobs-box__html-content, article.jobs-description');
      return { title: jobTitle, company: companyName, location, description: descEl?.textContent?.trim() || '', url: window.location.href, jobId: this.extractJobId() };
    } catch (err) { console.error('[PRC] extractJobData error:', err); return null; }
  }

  extractJobId() {
    try {
      const href = window.location.href;
      const pathMatch = href.match(/\/jobs\/view\/(\d+)/);
      if (pathMatch) return pathMatch[1];
      const params = new URL(href).searchParams;
      const cj = params.get('currentJobId'); if (cj) return cj;
      const ji = params.get('jobId'); if (ji) return ji;
      const activeEl = document.querySelector('.jobs-search-results-list__list-item--active [data-occludable-job-id], [data-occludable-job-id][class*="active"], [data-occludable-job-id][aria-selected="true"]');
      if (activeEl) return activeEl.getAttribute('data-occludable-job-id') || activeEl.closest('[data-occludable-job-id]')?.getAttribute('data-occludable-job-id') || null;
      const rp = document.querySelector('[data-job-id]'); if (rp) return rp.getAttribute('data-job-id');
    } catch {}
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────
// Easy Apply Automation Engine
// ─────────────────────────────────────────────────────────────────

class EasyApplyEngine {
  constructor(profile, onStatus) { this.profile = profile; this.onStatus = onStatus; this.maxSteps = 20; this.stepCount = 0; this.modalEl = null; }

  async start() {
    this.onStatus('Opening Easy Apply…', 'filling');
    const applyBtn = this._findApplyButton();
    if (!applyBtn) { this.onStatus('Easy Apply button not found', 'error'); return false; }
    applyBtn.click();
    try { this.modalEl = await this._waitForModal(); } catch { this.onStatus('Easy Apply modal did not open', 'error'); return false; }
    this.onStatus('Filling in your details…', 'filling');
    this._injectModalBanner();
    await this._processAllSteps();
    return true;
  }

  _findApplyButton() {
    for (const sel of ['button.jobs-apply-button[aria-label*="Easy Apply"]','button[data-control-name="jobdetails_topcard_inapply"]','.jobs-apply-button--top-card','button.jobs-apply-button']) {
      const btn = document.querySelector(sel); if (btn && btn.textContent?.toLowerCase().includes('easy apply')) return btn;
    }
    return Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim().toLowerCase() === 'easy apply') || null;
  }

  _waitForModal(timeout = 8000) {
    return new Promise((resolve, reject) => {
      const sels = ['[data-test-modal-id="easy-apply-modal"]','.jobs-easy-apply-modal','[aria-labelledby*="easy-apply"]','.artdeco-modal[role="dialog"]'];
      const check = () => { for (const s of sels) { const el = document.querySelector(s); if (el) return el; } return null; };
      const ex = check(); if (ex) { resolve(ex); return; }
      const obs = new MutationObserver(() => { const el = check(); if (el) { obs.disconnect(); resolve(el); } });
      obs.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { obs.disconnect(); reject(new Error('Modal timeout')); }, timeout);
    });
  }

  _injectModalBanner() {
    if (!this.modalEl || this.modalEl.querySelector('#prc-apply-status-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'prc-apply-status-banner'; banner.className = 'preciprocal-banner'; banner.dataset.state = 'filling';
    banner.innerHTML = `<span class="pr-icon">🤖</span><span id="prc-apply-msg">Filling in your details…</span><div class="pr-spinner"></div><button class="pr-dismiss" id="prc-apply-dismiss" title="Stop auto-fill">✕</button>`;
    const fc = this.modalEl.querySelector('.jobs-easy-apply-content, .artdeco-modal__content, form');
    if (fc) fc.insertBefore(banner, fc.firstChild); else this.modalEl.insertBefore(banner, this.modalEl.firstChild);
    document.getElementById('prc-apply-dismiss')?.addEventListener('click', () => this._updateBanner('Auto-fill stopped', 'ready'));
  }

  _updateBanner(msg, state = 'filling') {
    const m = document.getElementById('prc-apply-msg'); const b = document.getElementById('prc-apply-status-banner');
    if (m) m.textContent = msg; if (b) b.dataset.state = state;
    if (state === 'ready') b?.querySelector('.pr-spinner')?.remove();
  }

  _detectNextAction(modal) {
    const texts = Array.from(modal.querySelectorAll('button')).map(b => b.textContent?.trim().toLowerCase() || '');
    if (texts.some(t => t.includes('submit application') || t === 'submit')) return 'submit';
    if (texts.some(t => t.includes('review'))) return 'review';
    if (texts.some(t => t.includes('next') || t.includes('continue'))) return 'next';
    return 'none';
  }

  async _processAllSteps() {
    while (this.stepCount < this.maxSteps) {
      this.stepCount++; await this._delay(600);
      const modal = this._getModal(); if (!modal) break;
      await this._fillCurrentStep(modal); await this._delay(400);
      const action = this._detectNextAction(modal);
      if (action === 'none') break;
      if (action === 'submit') { this._updateBanner('✅ All done - click Submit when ready', 'ready'); this.onStatus('All fields filled! Review and click Submit.', 'success'); break; }
      if (action === 'review') { this._updateBanner('📋 Auto-clicking Review…', 'filling'); const rb = this._findButton(modal, ['review']); if (rb) { rb.click(); await this._delay(1200); continue; } this._updateBanner('📋 Review your application then submit', 'ready'); this.onStatus('Please review and submit your application.', 'success'); break; }
      const nb = this._findButton(modal, ['next', 'continue']); if (nb) { this._updateBanner(`Step ${this.stepCount} - moving to next…`, 'filling'); nb.click(); await this._delay(900); } else break;
    }
  }

  _getModal() { return document.querySelector('[data-test-modal-id="easy-apply-modal"]') || document.querySelector('.jobs-easy-apply-modal') || document.querySelector('.artdeco-modal[role="dialog"]'); }
  _findButton(modal, kw) { return Array.from(modal.querySelectorAll('button')).find(b => kw.some(k => b.textContent?.trim().toLowerCase().includes(k))) || null; }

  async _fillCurrentStep(modal) {
    const p = this.profile;
    for (const el of modal.querySelectorAll('input:not([type="file"]):not([type="hidden"])')) await this._fillInput(el, p);
    for (const el of modal.querySelectorAll('select')) await this._fillSelect(el, p);
    for (const el of modal.querySelectorAll('textarea')) await this._fillTextarea(el, p);
    await this._fillRadioGroups(modal, p);
  }

  _rangeToSingleNumber(v) { if (!v) return ''; const s = String(v).trim(); const r = s.match(/^(\d+)\s*[-–]\s*\d+/); if (r) return r[1]; const p2 = s.match(/^(\d+)\s*\+/); if (p2) return p2[1]; const n = s.match(/^(\d+)/); return n ? n[1] : s; }

  async _fillInput(input, p) {
    if (input.disabled || input.readOnly || (input.value && input.value.trim())) return;
    const hint = `${this._getLabel(input)} ${input.id || ''} ${input.name || ''}`.toLowerCase();
    let val = this._matchProfileField(hint, p); if (!val && val !== 0) return; val = String(val);
    if (input.type === 'number' || input.getAttribute('inputmode') === 'numeric') val = this._rangeToSingleNumber(val);
    if (/year/i.test(hint) && val.includes('-')) val = this._rangeToSingleNumber(val);
    this._setNativeValue(input, val); await this._delay(50);
  }

  async _fillSelect(select, p) {
    if (select.disabled || (select.value && select.value !== '' && select.value !== '0')) return;
    const hint = `${this._getLabel(select)} ${select.id || ''} ${select.name || ''}`.toLowerCase();
    if (/authoriz|visa|work permit|eligible|legally/i.test(hint)) { this._selectByText(select, p.workAuthorization || 'Yes'); return; }
    if (/sponsor/i.test(hint)) { this._selectByText(select, p.requireSponsorship ? 'Yes' : 'No'); return; }
    if (/relocat/i.test(hint)) { this._selectByText(select, p.willingToRelocate ? 'Yes' : 'No'); return; }
    if (/country/i.test(hint)) { this._selectByText(select, p.country || 'United States'); return; }
    if (/year.*exp|exp.*year/i.test(hint)) { this._selectClosestNumber(select, p.yearsOfExperience || ''); return; }
    if (/notice|start/i.test(hint)) { this._selectByText(select, p.noticePeriod || '2 weeks'); return; }
  }

  async _fillTextarea(textarea, p) {
    if (textarea.disabled || textarea.readOnly || textarea.value?.trim().length > 10) return;
    const hint = `${this._getLabel(textarea)} ${textarea.id || ''}`.toLowerCase();
    if (/cover.?letter|covering/i.test(hint)) return;
    if (/summary|about|additional|message|note/i.test(hint)) this._setNativeValue(textarea, p.summary || '');
    if (/linkedin/i.test(hint)) this._setNativeValue(textarea, p.linkedInUrl || '');
    if (/github/i.test(hint)) this._setNativeValue(textarea, p.githubUrl || '');
    if (/website|portfolio/i.test(hint)) this._setNativeValue(textarea, p.portfolioUrl || '');
    if (/skill/i.test(hint) && p.skills?.length) this._setNativeValue(textarea, p.skills.join(', '));
  }

  async _fillRadioGroups(modal, p) {
    for (const group of modal.querySelectorAll('[role="radiogroup"], fieldset')) {
      const legend = (group.querySelector('legend, [role="group"] label')?.textContent || '').toLowerCase();
      let answer = null;
      if (/sponsor/i.test(legend)) answer = p.requireSponsorship ? 'yes' : 'no';
      if (/relocat/i.test(legend)) answer = p.willingToRelocate ? 'yes' : 'no';
      if (/legally.*work|authorized/i.test(legend)) answer = 'yes';
      if (/currently employ/i.test(legend)) answer = 'yes';
      if (answer) { for (const r of group.querySelectorAll('input[type="radio"]')) { if ((this._getLabel(r) + r.value).toLowerCase().includes(answer)) { if (!r.checked) r.click(); break; } } }
    }
  }

  _matchProfileField(hint, p) {
    if (/phone|mobile|cell|tel/i.test(hint)) return p.phone; if (/email|e-mail/i.test(hint)) return p.email;
    if (/first.?name|fname|given/i.test(hint)) return p.firstName; if (/last.?name|lname|surname|family/i.test(hint)) return p.lastName;
    if (/full.?name|^name$/i.test(hint)) return p.fullName; if (/^city$|city\b/i.test(hint)) return p.city;
    if (/^state$|\bstate\b/i.test(hint)) return p.state; if (/zip|postal/i.test(hint)) return p.zipCode;
    if (/country/i.test(hint)) return p.country; if (/location|address/i.test(hint)) return p.location;
    if (/linkedin/i.test(hint)) return p.linkedInUrl; if (/github/i.test(hint)) return p.githubUrl;
    if (/website|portfolio/i.test(hint)) return p.portfolioUrl;
    if (/year.*exp|exp.*year|years.*work|years.*experience|how many year/i.test(hint)) return this._rangeToSingleNumber(p.yearsOfExperience || '');
    if (/salary|compensation/i.test(hint)) return p.desiredSalary; if (/title|headline/i.test(hint)) return p.headline;
    if (/notice|start date/i.test(hint)) return p.noticePeriod;
    return null;
  }

  _getLabel(el) {
    if (el.id) { const l = document.querySelector(`label[for="${el.id}"]`); if (l) return l.textContent || ''; }
    if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
    if (el.placeholder) return el.placeholder;
    const p = el.closest('label, [class*="form-item"], [class*="field"]');
    if (p) { const l = p.querySelector('label, span[class*="label"], div[class*="label"]'); if (l) return l.textContent || ''; return p.textContent || ''; }
    return '';
  }

  _setNativeValue(el, value) {
    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, value); else el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); el.dispatchEvent(new Event('blur', { bubbles: true }));
  }

  _selectByText(select, text) {
    const lower = text.toLowerCase(); const opts = Array.from(select.options);
    const match = opts.find(o => o.text.toLowerCase() === lower) || opts.find(o => o.text.toLowerCase().includes(lower)) || opts.find(o => lower.includes(o.text.toLowerCase().split(' ')[0]));
    if (match && select.value !== match.value) this._setNativeValue(select, match.value);
  }

  _selectClosestNumber(select, target) {
    if (!target) return; const num = parseInt(this._rangeToSingleNumber(String(target)), 10); if (isNaN(num)) return;
    let best = null, bestDiff = Infinity;
    for (const opt of select.options) {
      if (!opt.value || opt.value === '' || opt.value === '0') continue;
      const rm = opt.text.match(/^(\d+)\s*[-–]\s*(\d+)/);
      if (rm) { const lo = +rm[1], hi = +rm[2]; const d = Math.min(Math.abs(lo-num), Math.abs(hi-num), Math.abs((lo+hi)/2-num)); if (d < bestDiff) { bestDiff = d; best = opt; } }
      else { const m = opt.text.match(/(\d+)/); if (m) { const d = Math.abs(+m[1]-num); if (d < bestDiff) { bestDiff = d; best = opt; } } }
    }
    if (best) this._setNativeValue(select, best.value);
  }

  _delay(ms) { return new Promise(r => setTimeout(r, ms)); }
}

function getApplyButtonInfo() {
  for (const sel of ['button.jobs-apply-button[aria-label*="Easy Apply"]','button.jobs-apply-button']) { const btn = document.querySelector(sel); if (btn && btn.textContent?.toLowerCase().includes('easy apply')) return { type: 'easy', button: btn }; }
  const ext = document.querySelector('button.jobs-apply-button, a.jobs-apply-button, [data-control-name="jobdetails_topcard_inapply"]');
  if (ext) { const link = document.querySelector('a[href*="apply"], a[data-tracking-control-name*="apply"], .jobs-apply-button a'); return { type: 'external', button: ext, url: link?.href || null }; }
  return { type: 'none', button: null, url: null };
}

// ─────────────────────────────────────────────────────────────────
// Main banner class - minimal, professional UI
// ─────────────────────────────────────────────────────────────────

class PreciprocalBanner {
  constructor() {
    this.jobData = null; this.banner = null; this.currentJobId = null;
    this.observer = null; this.authToken = null; this.authUserId = null;
    this.authEmail = null; this.isAuthenticated = false;
    this.trackState = 'idle'; this.applyState = 'idle';
    this.applyProfile = null; this.applyFiles = null;
  }

  _delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  async init() {
    try {
      await this.checkAuth();
      await this.waitForJobPanel();
      const extractor = new JobExtractor();
      this.jobData = extractor.extractJobData();
      if (!this.jobData?.title) return;
      this.currentJobId = this.jobData.jobId;
      console.log(`[PRC] Init: "${this.jobData.title}" | jobId: ${this.currentJobId}`);
      await this._delay(400);
      if (this.isAuthenticated) await this._syncTrackedJobsFromDB();
      this.injectBanner();
      if (this.isAuthenticated) await Promise.all([this.fetchMatchScore(), this.prefetchApplyProfile()]);
      this.observeJobChanges();
    } catch (err) { console.error('[PRC] Banner init error:', err); }
  }

  waitForJobPanel(timeout = 10000) {
    const sels = ['.job-details-jobs-unified-top-card__container--two-pane','.jobs-unified-top-card','.jobs-details__main-content','.jobs-search__job-details--container','.job-details-jobs-unified-top-card__job-title'];
    return new Promise((resolve, reject) => {
      for (const s of sels) { const el = document.querySelector(s); if (el) return resolve(el); }
      const obs = new MutationObserver(() => { for (const s of sels) { const el = document.querySelector(s); if (el) { obs.disconnect(); resolve(el); return; } } });
      obs.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { obs.disconnect(); reject(new Error('Job panel not found')); }, timeout);
    });
  }

  async _syncTrackedJobsFromDB() {
    if (!this.authToken) return;
    try {
      const resp = await chrome.runtime.sendMessage({ type: 'API_FETCH_TRACKED_JOBS', token: this.authToken, userId: this.authUserId || '', email: this.authEmail || '', baseUrl: PRECIPROCAL_URL });
      console.log('[PRC] Raw DB resp:', JSON.stringify(resp).substring(0, 300));
      const jobIds = resp?.data?.jobIds ?? resp?.jobIds ?? null;
      if (jobIds && typeof jobIds === 'object') {
        const count = Object.keys(jobIds).length;
        console.log(`[PRC] ✅ ${count} tracked jobs from DB`);
        if (count > 0) {
          await LabelInjector.seedFromMap(jobIds);
          if (this.currentJobId && jobIds[this.currentJobId]) { this.trackState = 'done'; }
        }
      } else { console.warn('[PRC] Unexpected DB response:', resp); }
    } catch (e) {
      console.warn('[PRC] DB sync failed, using local cache:', e?.message);
      try {
        const r = await chrome.storage.local.get([LabelInjector.STORAGE_KEY]);
        const labels = r[LabelInjector.STORAGE_KEY] || {};
        for (const [id, type] of Object.entries(labels)) LabelInjector._scheduleRetry(id, type, 0);
        if (this.currentJobId && labels[this.currentJobId]) this.trackState = 'done';
      } catch {}
    }
  }

  async prefetchApplyProfile() {
    if (!this.authToken) return;
    try {
      const resp = await chrome.runtime.sendMessage({ type: 'API_FETCH_AUTO_APPLY', token: this.authToken, userId: this.authUserId || '', email: this.authEmail || '', baseUrl: PRECIPROCAL_URL });
      if (resp?.success && resp.data) {
        this.applyProfile = resp.data.applyProfile || null;
        this.applyFiles = { resume: { available: false, url: null, fileName: null }, transcript: { available: false, url: null, fileName: null } };
        const rf = resp.data.files;
        if (rf?.resume?.available && rf.resume.url) this.applyFiles.resume = rf.resume;
        if (rf?.transcript?.available && rf.transcript.url) this.applyFiles.transcript = rf.transcript;
      }
    } catch (e) { console.warn('[PRC] Prefetch failed:', e?.message); }
  }

  async checkAuth() {
    try { const r = await chrome.storage.local.get(['preciprocal_auth']); if (r?.preciprocal_auth?.uid && r.preciprocal_auth.token) { this._setAuth(r.preciprocal_auth); return; } } catch {}
    try {
      const sr = await Promise.race([chrome.runtime.sendMessage({ type: 'SYNC_AUTH' }), new Promise(r => setTimeout(() => r(null), 2000))]);
      if (sr?.success) { const r = await chrome.storage.local.get(['preciprocal_auth']); if (r?.preciprocal_auth?.uid) { this._setAuth(r.preciprocal_auth); return; } }
    } catch {}
    this.isAuthenticated = false;
  }

  _setAuth(auth) { this.isAuthenticated = true; this.authUserId = auth.uid; this.authEmail = auth.email || null; this.authToken = auth.token; }

  findBestInsertionPoint() {
    const strats = [
      () => { const el = document.querySelector('.job-details-jobs-unified-top-card__primary-description-container'); if (el) return { element: el, position: 'afterend' }; },
      () => { const el = document.querySelector('.job-details-jobs-unified-top-card__container--two-pane'); if (el?.firstElementChild) return { element: el.firstElementChild, position: 'afterend' }; },
      () => { const el = document.querySelector('.jobs-apply-button, .jobs-apply-button--top-card'); if (el) return { element: el.closest('div[class*="container"]') || el.parentElement, position: 'afterend' }; },
      () => { const el = document.querySelector('.job-details-jobs-unified-top-card__job-insight'); if (el) return { element: el, position: 'beforebegin' }; },
      () => { const el = document.querySelector('.jobs-unified-top-card, .job-details-jobs-unified-top-card'); if (el) return { element: el, position: 'afterend' }; },
    ];
    for (const s of strats) { try { const r = s(); if (r) return r; } catch {} }
    return null;
  }

  injectBanner() {
    document.getElementById('preciprocal-inline-banner')?.remove();
    const ins = this.findBestInsertionPoint();
    if (!ins) return;
    this.banner = this.createBannerElement();
    ins.element.insertAdjacentElement(ins.position, this.banner);
    this._applyTheme();
    if (this.trackState === 'done') {
      const btn = this.banner.querySelector('[data-action="track-job"]');
      if (btn) { btn.classList.add('done'); this._replaceButtonIcon(btn, 'check'); btn.setAttribute('title', 'Already saved to your tracker'); }
    }
    this.attachEventListeners();
    this.injectStyles();
  }

  _applyTheme() {
    if (!this.banner) return;
    const bg = getComputedStyle(document.body).backgroundColor;
    const m = bg.match(/\d+/g);
    this.banner.classList.toggle('prc-light', !!(m && +m[0] > 200 && +m[1] > 200 && +m[2] > 200));
  }

  _getApplyButtonLabel() {
    const info = getApplyButtonInfo();
    if (info.type === 'easy') return { label: 'Easy Apply', tip: 'Auto-fill LinkedIn Easy Apply with your profile' };
    if (info.type === 'external') return { label: 'Auto Apply', tip: 'Open company site and auto-fill the application' };
    return { label: 'Auto Apply', tip: 'Auto-fill the job application with your Preciprocal profile' };
  }

  createBannerElement() {
    const c = document.createElement('div');
    c.id = 'preciprocal-inline-banner';
    c.className = 'preciprocal-inline-container';
    const am = this._getApplyButtonLabel();
    const logoUrl = typeof chrome !== 'undefined' ? chrome.runtime.getURL('icons/icon48.png') : '';
    c.innerHTML = `
      <div class="preciprocal-banner-compact">
        <div class="prc-top-section">
          <div class="prc-title-row">
            ${logoUrl ? `<img src="${logoUrl}" class="prc-logo-img" alt="Preciprocal">` : ''}
            <h3 class="prc-title">Tired of tailoring for Jobs? Let us do it for you!</h3>
          </div>
          <div class="prc-top-right">
            ${this.isAuthenticated ? `
            <div class="prc-score-badge" data-tip="Resume match score for this job">
              <svg class="score-ring" width="40" height="40">
                <circle class="ring-bg" cx="20" cy="20" r="16" stroke-width="3" fill="none"/>
                <circle class="ring-fg" cx="20" cy="20" r="16" stroke-width="3" fill="none" stroke-dasharray="0 100.53" transform="rotate(-90 20 20)" stroke-linecap="round"/>
              </svg>
              <div class="score-val"><span class="num">--</span></div>
            </div>` : ''}
          </div>
        </div>
        <div class="prc-actions">
          <button class="prc-btn prc-primary" data-action="cover-letter" data-tip="✨ AI writes your cover letter tailored to this role in 30 seconds">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
            Cover Letter
          </button>
          <button class="prc-btn prc-apply" data-action="auto-apply" data-tip="${am.tip}">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            <span class="apply-label">${am.label}</span>
          </button>
          <button class="prc-btn prc-track prc-icon-only" data-action="track-job" data-tip="Save this job to your tracker">
            <svg class="track-icon" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>
          </button>
        </div>
      </div>
    `;
    return c;
  }

  async handleAutoApply() {
    if (this.applyState === 'done' || this.applyState === 'loading') return;
    const btn = this.banner?.querySelector('[data-action="auto-apply"]');
    const labelEl = btn?.querySelector('.apply-label');
    if (!this.isAuthenticated) { this.showNotification('Please log in to Preciprocal first', 'error'); setTimeout(() => window.open(`${PRECIPROCAL_URL}/sign-in`, '_blank'), 1500); return; }
    this.applyState = 'loading'; if (btn) btn.classList.add('loading'); if (labelEl) labelEl.textContent = 'Loading…';
    try {
      if (!this.applyProfile) {
        const resp = await chrome.runtime.sendMessage({ type: 'API_FETCH_AUTO_APPLY', token: this.authToken, userId: this.authUserId || '', email: this.authEmail || '', baseUrl: PRECIPROCAL_URL });
        if (!resp?.success) throw new Error(resp?.error || 'Failed to fetch profile');
        this.applyProfile = resp.data.applyProfile; this.applyFiles = resp.data.files || null;
      }
      if (!this.applyProfile) throw new Error('Profile data unavailable');
      const ai = getApplyButtonInfo();
      if (ai.type === 'easy') {
        if (labelEl) labelEl.textContent = 'Filling…';
        const engine = new EasyApplyEngine(this.applyProfile, (msg, t) => { if (t === 'success') this.showNotification(msg, 'success'); if (t === 'error') this.showNotification(msg, 'error'); });
        await engine.start(); try { await this._injectFilesIntoModal(); } catch {}
        this.applyState = 'done'; if (btn) { btn.classList.remove('loading'); btn.classList.add('done'); } if (labelEl) labelEl.textContent = 'Review & Submit';
        this.showNotificationWithLink(`Easy Apply filled for ${this.jobData?.company}`, 'View Tracker →', `${PRECIPROCAL_URL}/job-tracker`, 'success');
        if (this.currentJobId) LabelInjector.inject(this.currentJobId, 'applied');
      } else if (ai.type === 'external') {
        await chrome.storage.local.set({ preciprocal_auto_apply_profile: this.applyProfile, preciprocal_auto_apply_files: this.applyFiles || null, preciprocal_auto_apply_timestamp: Date.now(), preciprocal_auto_apply_job: this.jobData });
        if (ai.button) {
          if (labelEl) labelEl.textContent = 'Opening…'; ai.button.click();
          this.applyState = 'done'; if (btn) { btn.classList.remove('loading'); btn.classList.add('done'); } if (labelEl) labelEl.textContent = 'Filling…';
          this.showNotification('Opening company site - Preciprocal will auto-fill', 'success');
          if (this.currentJobId) LabelInjector.inject(this.currentJobId, 'applied');
        } else throw new Error('Could not find the Apply button');
      } else throw new Error('No Apply button found');
    } catch (err) {
      this.applyState = 'idle'; if (btn) { btn.classList.remove('loading'); btn.classList.add('error'); } if (labelEl) labelEl.textContent = 'Retry';
      this.showNotification(err.message || 'Auto-apply failed', 'error');
      setTimeout(() => { if (btn) btn.classList.remove('error'); if (labelEl) labelEl.textContent = this._getApplyButtonLabel().label; this.applyState = 'idle'; }, 3000);
    }
  }

  async handleAction(action) {
    if (!this.isAuthenticated) { this.showNotification('Please log in to Preciprocal first', 'error'); setTimeout(() => window.open(`${PRECIPROCAL_URL}/sign-in`, '_blank'), 1500); return; }
    if (action === 'auto-apply') { await this.handleAutoApply(); return; }
    if (action === 'track-job') { await this.handleTrackJob(); return; }
    if (action === 'cover-letter') {
      await chrome.storage.local.set({ preciprocal_linkedin_job: this.jobData, preciprocal_timestamp: Date.now() });
      const p = new URLSearchParams();
      if (this.jobData?.title) p.set('role', this.jobData.title);
      if (this.jobData?.company) p.set('company', this.jobData.company);
      if (this.jobData?.description) p.set('jobDescription', this.jobData.description.substring(0, 2000));
      p.set('source', 'linkedin');
      window.open(`${PRECIPROCAL_URL}/cover-letter/create?${p.toString()}`, '_blank');
    }
  }

  async handleTrackJob() {
    if (this.trackState === 'done' || this.trackState === 'loading') return;
    const btn = this.banner?.querySelector('[data-action="track-job"]');
    this.trackState = 'loading'; if (btn) btn.classList.add('loading');
    this._replaceButtonIcon(btn, 'spinner');
    try {
      if (!this.authToken) throw new Error('Not logged in');
      const resp = await chrome.runtime.sendMessage({ type: 'API_FETCH_TRACK_JOB', token: this.authToken, userId: this.authUserId || '', email: this.authEmail || '', baseUrl: PRECIPROCAL_URL, jobData: this.jobData });
      if (!resp?.success) throw new Error(resp?.error || 'Failed to track job');
      this.trackState = 'done';
      if (btn) { btn.classList.remove('loading'); btn.classList.add('done'); }
      this._replaceButtonIcon(btn, 'check');
      btn?.setAttribute('title', 'Saved to your tracker');
      resp.data?.duplicate ? this.showNotificationWithLink('Already in your tracker', 'View →', `${PRECIPROCAL_URL}/job-tracker`, 'info') : this.showNotificationWithLink(`Saved - ${this.jobData?.company}`, 'View Tracker →', `${PRECIPROCAL_URL}/job-tracker`, 'success');
      if (this.currentJobId) LabelInjector.inject(this.currentJobId, 'saved');
    } catch (err) {
      this.trackState = 'idle'; if (btn) btn.classList.remove('loading');
      this._replaceButtonIcon(btn, 'bookmark');
      this.showNotification(err.message || 'Failed to track job', 'error');
    }
  }

  _classifyModalFileInputs(modal) {
    const all = Array.from(modal.querySelectorAll('input[type="file"]:not([disabled])'));
    const resume = [], transcript = [], other = [];
    for (const inp of all) {
      let lbl = inp.getAttribute('aria-label') || inp.placeholder || '';
      if (!lbl && inp.id) { const fl = document.querySelector(`label[for="${inp.id}"]`); if (fl) lbl = fl.textContent || ''; }
      if (!lbl) { const c2 = inp.closest('[class*="field"],[class*="form-item"],fieldset,label,div'); if (c2) lbl = c2.textContent || ''; }
      lbl = lbl.toLowerCase();
      if (/resume|cv\b|curriculum vitae/i.test(lbl)) resume.push(inp);
      else if (/transcript|academic record|grade|certificate/i.test(lbl)) transcript.push(inp);
      else if (/cover.?letter/i.test(lbl)) {}
      else other.push(inp);
    }
    if (!resume.length && other.length) resume.push(other.shift());
    if (!transcript.length && other.length) transcript.push(other.shift());
    return { resume, transcript };
  }

  async _buildFileObject(url, fileName) {
    const ext = (fileName.split('.').pop() || '').toLowerCase();
    const mime = { pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }[ext] || 'application/octet-stream';
    if (url.startsWith('data:')) { const b64 = url.split(',')[1]; const bin = atob(b64); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); return new File([bytes], fileName, { type: mime }); }
    const res = await fetch(url, { mode: 'cors' }); if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    return new File([await res.blob()], fileName, { type: mime });
  }

  async _setFileOnInput(input, file) { const dt = new DataTransfer(); dt.items.add(file); input.files = dt.files; input.dispatchEvent(new Event('change', { bubbles: true })); input.dispatchEvent(new Event('input', { bubbles: true })); }

  async _injectFilesIntoModal() {
    const modal = document.querySelector('[data-test-modal-id="easy-apply-modal"], .jobs-easy-apply-modal, .artdeco-modal[role="dialog"]');
    if (!modal) return;
    const { resume: ri, transcript: ti } = this._classifyModalFileInputs(modal);
    if (this.applyFiles?.resume?.available && this.applyFiles.resume.url && ri.length) { try { const f = await this._buildFileObject(this.applyFiles.resume.url, this.applyFiles.resume.fileName); for (const inp of ri) await this._setFileOnInput(inp, f); } catch (e) { console.warn('Resume inject failed:', e.message); } }
    if (this.applyFiles?.transcript?.available && this.applyFiles.transcript.url && ti.length) { try { const f = await this._buildFileObject(this.applyFiles.transcript.url, this.applyFiles.transcript.fileName); for (const inp of ti) await this._setFileOnInput(inp, f); } catch (e) { console.warn('Transcript inject failed:', e.message); } }
  }

  async fetchMatchScore() {
    if (!this.isAuthenticated || !this.authToken) { this.updateMatchScore(null); return; }
    try {
      const resp = await chrome.runtime.sendMessage({ type: 'API_FETCH_ANALYZE_JOB', token: this.authToken, userId: this.authUserId || '', email: this.authEmail || '', baseUrl: PRECIPROCAL_URL, jobData: this.jobData });
      if (!resp?.success) throw new Error(); this.updateMatchScore(resp.data.compatibilityScore);
      const wrap = this.banner?.querySelector('.prc-score-wrap'); if (wrap && resp.data.oneLineSummary) wrap.setAttribute('title', resp.data.oneLineSummary);
    } catch { this.updateMatchScore(null); }
  }

  updateMatchScore(score) {
    if (!this.banner) return;
    const numEl = this.banner.querySelector('.num'); const circle = this.banner.querySelector('.ring-fg');
    if (!numEl || !circle) return;
    if (score !== null && score !== undefined) {
      numEl.textContent = Math.round(score); const c = 2 * Math.PI * 16;
      circle.setAttribute('stroke-dasharray', `${c}`); circle.setAttribute('stroke-dashoffset', `${c - (score / 100) * c}`);
      const col = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
      circle.setAttribute('stroke', col); numEl.style.color = col;
    } else { numEl.textContent = '--'; circle.setAttribute('stroke', '#475569'); numEl.style.color = '#64748b'; }
  }

  _replaceButtonIcon(btn, iconName) {
    if (!btn) return; const ex = btn.querySelector('svg, .prc-spinner, .prc-mini-spinner'); if (!ex) return;
    if (iconName === 'spinner') { const s = document.createElement('div'); s.className = 'prc-spinner'; ex.replaceWith(s); return; }
    const ns = 'http://www.w3.org/2000/svg'; const svg = document.createElementNS(ns, 'svg'); const path = document.createElementNS(ns, 'path');
    svg.setAttribute('width', '16'); svg.setAttribute('height', '16'); svg.setAttribute('fill', 'none'); svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-linecap', 'round'); path.setAttribute('stroke-linejoin', 'round'); path.setAttribute('stroke-width', '2');
    path.setAttribute('d', { check: 'M5 13l4 4L19 7', lightning: 'M13 10V3L4 14h7v7l9-11h-7z', bookmark: 'M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z' }[iconName] || 'M13 10V3L4 14h7v7l9-11h-7z');
    svg.appendChild(path); ex.replaceWith(svg);
  }

  attachEventListeners() {
    if (!this.banner) return;
    this.banner.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); this.handleAction(btn.getAttribute('data-action')); });
    });
    // JS tooltip - appends to body so it is never clipped by the banner container
    this.banner.querySelectorAll('[data-tip]').forEach(btn => {
      let tipEl = null;
      btn.addEventListener('mouseenter', () => {
        const text = btn.getAttribute('data-tip'); if (!text) return;
        tipEl = document.createElement('div'); tipEl.className = 'prc-tooltip'; tipEl.textContent = text;
        document.body.appendChild(tipEl);
        const rect = btn.getBoundingClientRect();
        const tw = tipEl.offsetWidth; const th = tipEl.offsetHeight;
        let left = rect.left + rect.width / 2 - tw / 2;
        let top  = rect.top - th - 10 + window.scrollY;
        if (left < 8) left = 8;
        if (left + tw > window.innerWidth - 8) left = window.innerWidth - tw - 8;
        tipEl.style.left = left + 'px'; tipEl.style.top = top + 'px';
        requestAnimationFrame(() => tipEl && tipEl.classList.add('prc-tooltip-show'));
      });
      btn.addEventListener('mouseleave', () => { tipEl?.remove(); tipEl = null; });
    });
  }

  _toastIcons() {
    return {
      success: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>`,
      error: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>`,
      info: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>`,
    };
  }

  showNotification(message, type = 'success') {
    const n = document.createElement('div'); n.className = `preciprocal-notification ${type}`;
    n.innerHTML = `<div class="prc-toast-inner"><div class="prc-toast-icon">${this._toastIcons()[type]||this._toastIcons().info}</div><div class="prc-toast-body"><div class="prc-toast-msg">${message}</div></div></div>`;
    document.body.appendChild(n); setTimeout(() => n.classList.add('show'), 10); setTimeout(() => { n.classList.remove('show'); setTimeout(() => n.remove(), 300); }, 2800);
  }

  showNotificationWithLink(message, linkText, linkUrl, type = 'success') {
    const n = document.createElement('div'); n.className = `preciprocal-notification ${type}`;
    n.innerHTML = `<div class="prc-toast-inner"><div class="prc-toast-icon">${this._toastIcons()[type]||this._toastIcons().info}</div><div class="prc-toast-body"><div class="prc-toast-msg">${message}</div><span class="prc-toast-link">${linkText}</span></div></div>`;
    n.querySelector('.prc-toast-link').addEventListener('click', () => window.open(linkUrl, '_blank'));
    document.body.appendChild(n); setTimeout(() => n.classList.add('show'), 10); setTimeout(() => { n.classList.remove('show'); setTimeout(() => n.remove(), 300); }, 4500);
  }

  observeJobChanges() {
    if (this.observer) this.observer.disconnect();
    let lastJobId = this.currentJobId;
    this.observer = new MutationObserver(() => {
      const newId = new JobExtractor().extractJobId();
      if (newId && newId !== lastJobId) { lastJobId = newId; this.destroy(); setTimeout(() => this.init(), 800); }
    });
    this.observer.observe(document.body, { childList: true, subtree: true });
  }

  destroy() { this.banner?.remove(); this.banner = null; this.observer?.disconnect(); this.observer = null; this.trackState = 'idle'; this.applyState = 'idle'; this.applyProfile = null; this.currentJobId = null; }

  injectStyles() {
    if (document.getElementById('preciprocal-banner-styles')) return;
    const s = document.createElement('style'); s.id = 'preciprocal-banner-styles';
    s.textContent = `
      /* ── Banner container ── */
      .preciprocal-inline-container { margin:16px 0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif; }

      /* ── Card ── */
      .preciprocal-banner-compact { background:linear-gradient(135deg,#1e1b4b 0%,#1e293b 100%); border:1px solid rgba(148,163,184,0.2); border-radius:8px; padding:16px; box-shadow:0 1px 3px rgba(0,0,0,0.2); transition:all 0.2s ease; position:relative; }
      .preciprocal-banner-compact:hover { box-shadow:0 2px 8px rgba(0,0,0,0.25); border-color:rgba(99,102,241,0.3); }
      .prc-title { font-size:16px; font-weight:600; color:#f5f5f5; margin:0; line-height:1.4; flex:1; }
      .prc-top-section { display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom:12px; }
      .prc-top-right { display:flex; align-items:center; gap:8px; flex-shrink:0; }
      .prc-actions { display:flex; gap:8px; margin-bottom:4px; }

      /* ── Score ring ── */
      .prc-score-badge { position:relative; width:40px; height:40px; flex-shrink:0; }
      .score-ring { width:40px; height:40px; }
      .ring-bg { stroke:#38434f; }
      .ring-fg { stroke:#6366f1; transition:stroke-dasharray 0.6s ease; }
      .score-val { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); text-align:center; }
      .score-val .num { font-size:14px; font-weight:700; color:#818cf8; line-height:1; }

      /* ── Buttons ── */
      .prc-btn { display:inline-flex; align-items:center; justify-content:center; gap:6px; padding:8px 12px; background:transparent; border:1px solid rgba(255,255,255,0.15); border-radius:16px; color:#e2e8f0; font-size:14px; font-weight:600; cursor:pointer; transition:all 0.2s ease; white-space:nowrap; font-family:inherit; flex:1; position:relative; }
      .prc-btn:hover { background:rgba(255,255,255,0.08); border-color:rgba(255,255,255,0.25); }
      .prc-btn:active { transform:scale(0.98); }
      .prc-btn.prc-primary { background:rgba(255,255,255,0.12); border-color:rgba(255,255,255,0.2); color:rgba(255,255,255,0.9); backdrop-filter:blur(4px); }
      .prc-btn.prc-primary:hover { background:rgba(255,255,255,0.2); border-color:rgba(255,255,255,0.3); color:#fff; }
      .prc-btn.prc-apply { background:rgba(255,255,255,0.18); border-color:rgba(255,255,255,0.25); color:#fff; backdrop-filter:blur(4px); }
      .prc-btn.prc-apply:hover { background:rgba(255,255,255,0.26); }
      .prc-btn.prc-apply.loading { opacity:0.7; cursor:not-allowed; pointer-events:none; }
      .prc-btn.prc-apply.done { background:linear-gradient(135deg,#10b981 0%,#059669 100%); border-color:#10b981; pointer-events:none; }
      .prc-btn.prc-apply.error { background:linear-gradient(135deg,#ef4444 0%,#b91c1c 100%); border-color:#ef4444; }
      .prc-btn.prc-track { background:transparent; border-color:#6e7681; color:#b0b8c1; }
      .prc-btn.prc-track:hover { background:rgba(110,118,129,0.08); border-color:#b0b8c1; color:#f5f5f5; }
      .prc-btn.prc-icon-only { flex:0 0 auto; width:38px; min-width:unset; padding:0; border-radius:50%; }
      .prc-btn.prc-track.loading { opacity:0.7; cursor:not-allowed; pointer-events:none; }
      .prc-btn.prc-track.done { border-color:#10b981; color:#10b981; background:rgba(16,185,129,0.08); cursor:default; pointer-events:none; }
      .prc-btn svg { width:16px; height:16px; flex-shrink:0; stroke-width:2; }

      /* ── Logo ── */
      .prc-title-row { display:flex; align-items:center; gap:8px; flex:1; }
      .prc-logo-img { width:20px; height:20px; border-radius:5px; flex-shrink:0; object-fit:contain; }

      /* ── Tooltip (JS-rendered, appended to body) ── */
      .prc-tooltip { position:absolute; z-index:2147483647; background:rgba(10,14,30,0.97); color:#f1f5f9; padding:7px 11px; border-radius:7px; font-size:12px; font-weight:500; line-height:1.45; white-space:normal; max-width:240px; text-align:center; pointer-events:none; box-shadow:0 4px 16px rgba(0,0,0,0.5); border:1px solid rgba(99,102,241,0.25); opacity:0; transform:translateY(3px); transition:opacity 0.15s ease, transform 0.15s ease; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
      .prc-tooltip.prc-tooltip-show { opacity:1; transform:translateY(0); }

      /* ── Spinner ── */
      .prc-spinner { width:14px; height:14px; border:2px solid rgba(176,184,193,0.3); border-top-color:#b0b8c1; border-radius:50%; animation:prc-spin 0.7s linear infinite; flex-shrink:0; }
      @keyframes prc-spin { to { transform:rotate(360deg); } }

      /* ── Light mode ── */
      .preciprocal-inline-container.prc-light .preciprocal-banner-compact { background:linear-gradient(135deg,#e0f2fe 0%,#ede9fe 100%); border:1px solid rgba(99,102,241,0.2); box-shadow:0 1px 4px rgba(0,0,0,0.07); }
      .preciprocal-inline-container.prc-light .preciprocal-banner-compact:hover { border-color:rgba(99,102,241,0.45); }
      .preciprocal-inline-container.prc-light .prc-title { color:#111827; font-weight:700; }
      .preciprocal-inline-container.prc-light .prc-btn { border-color:rgba(0,0,0,0.1); color:#374151; }
      .preciprocal-inline-container.prc-light .prc-btn:hover { background:rgba(99,102,241,0.04); border-color:rgba(99,102,241,0.3); color:#111827; }
      .preciprocal-inline-container.prc-light .prc-btn.prc-primary { background:rgba(125,155,210,0.25); border-color:rgba(99,132,199,0.35); color:#1e3a5f; }
      .preciprocal-inline-container.prc-light .prc-btn.prc-apply { background:rgba(167,139,250,0.22); border-color:rgba(139,112,220,0.32); color:#3b1f7a; }
      .preciprocal-inline-container.prc-light .ring-bg { stroke:#e0e7ff; }
      .preciprocal-inline-container.prc-light .score-val .num { color:#4f46e5; }
      .preciprocal-inline-container.prc-light .prc-btn.prc-track { border-color:rgba(0,0,0,0.1); color:#9ca3af; }
      .preciprocal-inline-container.prc-light .prc-btn.prc-track.done { border-color:#059669; color:#059669; background:rgba(5,150,105,0.06); }

      /* ── Modal banner ── */
      .preciprocal-banner { display:flex; align-items:center; gap:8px; padding:10px 16px; margin:0 0 4px 0; border-bottom:1px solid rgba(139,92,246,0.25); background:linear-gradient(135deg,rgba(15,10,35,0.97) 0%,rgba(30,18,60,0.97) 100%); font-size:13px; color:#c4b5fd; position:sticky; top:0; z-index:9999; border-radius:8px 8px 0 0; backdrop-filter:blur(12px); font-family:-apple-system,sans-serif; }
      .preciprocal-banner[data-state="filling"] { color:#93c5fd; }
      .preciprocal-banner[data-state="ready"] { color:#86efac; border-bottom-color:rgba(134,239,172,0.2); }
      .pr-icon { font-size:14px; flex-shrink:0; }
      .preciprocal-banner span:not(.pr-icon):not(.pr-spinner) { flex:1; font-weight:500; }
      .pr-dismiss { background:none; border:none; color:rgba(134,239,172,0.6); cursor:pointer; font-size:12px; padding:2px 4px; border-radius:4px; line-height:1; flex-shrink:0; }
      .pr-dismiss:hover { color:#86efac; background:rgba(134,239,172,0.1); }
      .pr-spinner { width:13px; height:13px; border:2px solid rgba(147,197,253,0.3); border-top-color:#93c5fd; border-radius:50%; animation:prc-spin 0.7s linear infinite; flex-shrink:0; }

      /* ── Toast notifications ── */
      .preciprocal-notification { position:fixed; bottom:24px; right:24px; z-index:999999; opacity:0; transform:translateY(8px) scale(0.96); transition:opacity 0.22s cubic-bezier(0.16,1,0.3,1),transform 0.22s cubic-bezier(0.16,1,0.3,1); font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; pointer-events:none; }
      .preciprocal-notification.show { opacity:1; transform:translateY(0) scale(1); pointer-events:auto; }
      .prc-toast-inner { display:flex; align-items:center; gap:10px; padding:12px 14px; border-radius:12px; background:#0f172a; border:1px solid rgba(148,163,184,0.12); box-shadow:0 4px 24px rgba(0,0,0,0.5); backdrop-filter:blur(16px); min-width:240px; max-width:340px; }
      .prc-toast-icon { width:18px; height:18px; flex-shrink:0; display:flex; align-items:center; justify-content:center; }
      .prc-toast-icon svg { width:15px; height:15px; }
      .prc-toast-body { flex:1; min-width:0; }
      .prc-toast-msg { font-size:13px; font-weight:500; color:#f1f5f9; line-height:1.4; }
      .prc-toast-link { display:inline-flex; align-items:center; margin-top:4px; font-size:11px; font-weight:600; color:#a78bfa; cursor:pointer; }
      .prc-toast-link:hover { color:#c4b5fd; }
      .preciprocal-notification.success .prc-toast-icon { color:#10b981; }
      .preciprocal-notification.success .prc-toast-inner { border-color:rgba(16,185,129,0.2); }
      .preciprocal-notification.error .prc-toast-icon { color:#f87171; }
      .preciprocal-notification.error .prc-toast-inner { border-color:rgba(248,113,113,0.2); }
      .preciprocal-notification.info .prc-toast-icon { color:#a78bfa; }
      .preciprocal-notification.info .prc-toast-inner { border-color:rgba(167,139,250,0.2); }

      @media (max-width:768px) { .preciprocal-banner-compact{padding:12px} .prc-top-section{flex-direction:column;align-items:flex-start;gap:12px} .prc-actions{flex-direction:column;width:100%} .prc-btn{width:100%;font-size:13px} .prc-title{font-size:14px} }
      @media (max-width:1024px) { .prc-actions{flex-wrap:wrap} .prc-btn{flex:1 1 calc(50% - 4px);min-width:140px} }
      @media print { .preciprocal-inline-container,.preciprocal-notification{display:none!important} }
    `;
    document.head.appendChild(s);
  }
}

// ─────────────────────────────────────────────────────────────────
// Bootstrap
// ─────────────────────────────────────────────────────────────────

let bannerInstance = null;

function initBanner() {
  if (!window.location.href.includes('linkedin.com/jobs/')) return;
  bannerInstance?.destroy();
  bannerInstance = new PreciprocalBanner();
  bannerInstance.init();
}

if (document.readyState === 'loading') { document.addEventListener('DOMContentLoaded', initBanner); } else { initBanner(); }
setTimeout(initBanner, 2000);
setTimeout(initBanner, 4000);

console.log('✅ Preciprocal banner.js ready');
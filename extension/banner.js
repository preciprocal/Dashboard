// banner.js - LinkedIn-integrated banner with Preciprocal job tracker + Universal Auto Apply

console.log('🎯 Preciprocal banner.js loaded on:', window.location.href);

const IS_DEV = true; // Set to true for local development
const PRECIPROCAL_URL = IS_DEV ? 'http://localhost:3000' : 'https://preciprocal.com';

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
      const companySelectors = [
        'a.job-details-jobs-unified-top-card__company-name',
        '.jobs-unified-top-card__company-name a',
        '.jobs-unified-top-card__company-name',
        '.job-details-jobs-unified-top-card__company-name',
        'a[data-tracking-control-name="public_jobs_topcard-org-name"]',
        '.topcard__org-name-link',
        '.jobs-company__name',
      ];
      for (const sel of companySelectors) {
        const el = document.querySelector(sel);
        if (el?.textContent?.trim()) { companyName = el.textContent.trim(); break; }
      }

      let location = '';
      const locationSelectors = [
        '.job-details-jobs-unified-top-card__bullet',
        '.jobs-unified-top-card__bullet',
        '.job-details-jobs-unified-top-card__primary-description',
        'span.jobs-unified-top-card__subtitle-primary-grouping span:last-child',
        '.topcard__flavor--bullet',
      ];
      for (const sel of locationSelectors) {
        const el = document.querySelector(sel);
        if (el?.textContent?.trim()) { location = el.textContent.trim(); break; }
      }

      const descEl = document.querySelector(
        '.jobs-description__content, .jobs-box__html-content, article.jobs-description'
      );
      const description = descEl?.textContent?.trim() || '';

      return {
        title: jobTitle,
        company: companyName,
        location,
        description,
        url: window.location.href,
        jobId: this.extractJobId(),
      };
    } catch (error) {
      console.error('Error extracting job data:', error);
      return null;
    }
  }

  extractJobId() {
    const match = window.location.href.match(/jobs\/view\/(\d+)/);
    return match ? match[1] : null;
  }
}

// ─────────────────────────────────────────────────────────────────
// Easy Apply Automation Engine
// ─────────────────────────────────────────────────────────────────

class EasyApplyEngine {
  constructor(profile, onStatus) {
    this.profile   = profile;
    this.onStatus  = onStatus;
    this.maxSteps  = 20;
    this.stepCount = 0;
    this.modalEl   = null;
  }

  async start() {
    this.onStatus('Opening Easy Apply…', 'filling');
    const applyBtn = this._findApplyButton();
    if (!applyBtn) { this.onStatus('Easy Apply button not found', 'error'); return false; }
    applyBtn.click();
    try { this.modalEl = await this._waitForModal(); }
    catch { this.onStatus('Easy Apply modal did not open', 'error'); return false; }
    this.onStatus('Filling in your details…', 'filling');
    this._injectModalBanner();
    await this._processAllSteps();
    return true;
  }

  _findApplyButton() {
    const selectors = [
      'button.jobs-apply-button[aria-label*="Easy Apply"]',
      'button[data-control-name="jobdetails_topcard_inapply"]',
      '.jobs-apply-button--top-card',
      'button.jobs-apply-button',
    ];
    for (const sel of selectors) {
      const btn = document.querySelector(sel);
      if (btn && btn.textContent?.toLowerCase().includes('easy apply')) return btn;
    }
    return Array.from(document.querySelectorAll('button'))
      .find(b => b.textContent?.trim().toLowerCase() === 'easy apply') || null;
  }

  _waitForModal(timeout = 8000) {
    return new Promise((resolve, reject) => {
      const modalSelectors = [
        '[data-test-modal-id="easy-apply-modal"]',
        '.jobs-easy-apply-modal',
        '[aria-labelledby*="easy-apply"]',
        '.artdeco-modal[role="dialog"]',
      ];
      const check = () => { for (const sel of modalSelectors) { const el = document.querySelector(sel); if (el) return el; } return null; };
      const existing = check();
      if (existing) { resolve(existing); return; }
      const obs = new MutationObserver(() => { const el = check(); if (el) { obs.disconnect(); resolve(el); } });
      obs.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { obs.disconnect(); reject(new Error('Modal timeout')); }, timeout);
    });
  }

  _injectModalBanner() {
    if (!this.modalEl) return;
    if (this.modalEl.querySelector('#prc-apply-status-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'prc-apply-status-banner'; banner.className = 'preciprocal-banner'; banner.dataset.state = 'filling';
    banner.innerHTML = `<span class="pr-icon">🤖</span><span id="prc-apply-msg">Filling in your details…</span><div class="pr-spinner"></div><button class="pr-dismiss" id="prc-apply-dismiss" title="Stop auto-fill">✕</button>`;
    const firstChild = this.modalEl.querySelector('.jobs-easy-apply-content, .artdeco-modal__content, form');
    if (firstChild) firstChild.insertBefore(banner, firstChild.firstChild);
    else this.modalEl.insertBefore(banner, this.modalEl.firstChild);
    document.getElementById('prc-apply-dismiss')?.addEventListener('click', () => this._updateBanner('Auto-fill stopped', 'ready'));
  }

  _updateBanner(msg, state = 'filling') {
    const msgEl = document.getElementById('prc-apply-msg');
    const banner = document.getElementById('prc-apply-status-banner');
    if (msgEl) msgEl.textContent = msg;
    if (banner) banner.dataset.state = state;
    if (state === 'ready') banner?.querySelector('.pr-spinner')?.remove();
  }

  _detectNextAction(modal) {
    const buttons = Array.from(modal.querySelectorAll('button'));
    const texts = buttons.map(b => b.textContent?.trim().toLowerCase() || '');
    if (texts.some(t => t.includes('submit application') || t === 'submit')) return 'submit';
    if (texts.some(t => t.includes('review'))) return 'review';
    if (texts.some(t => t.includes('next') || t.includes('continue'))) return 'next';
    return 'none';
  }

  async _processAllSteps() {
    while (this.stepCount < this.maxSteps) {
      this.stepCount++;
      await this._delay(600);
      const modal = this._getModal();
      if (!modal) break;
      await this._fillCurrentStep(modal);
      await this._delay(400);
      const action = this._detectNextAction(modal);
      if (action === 'none') break;
      if (action === 'submit') { this._updateBanner('✅ All done — click Submit when ready', 'ready'); this.onStatus('All fields filled! Review and click Submit.', 'success'); break; }
      if (action === 'review') {
        this._updateBanner('📋 Auto-clicking Review…', 'filling');
        const reviewBtn = this._findButton(modal, ['review']);
        if (reviewBtn) { reviewBtn.click(); await this._delay(1200); continue; }
        this._updateBanner('📋 Review your application then submit', 'ready');
        this.onStatus('Please review and submit your application.', 'success');
        break;
      }
      const nextBtn = this._findButton(modal, ['next', 'continue']);
      if (nextBtn) { this._updateBanner(`Step ${this.stepCount} — moving to next…`, 'filling'); nextBtn.click(); await this._delay(900); }
      else break;
    }
  }

  _getModal() {
    return document.querySelector('[data-test-modal-id="easy-apply-modal"]') ||
           document.querySelector('.jobs-easy-apply-modal') ||
           document.querySelector('.artdeco-modal[role="dialog"]');
  }

  _findButton(modal, keywords) {
    return Array.from(modal.querySelectorAll('button'))
      .find(b => keywords.some(k => b.textContent?.trim().toLowerCase().includes(k))) || null;
  }

  async _fillCurrentStep(modal) {
    const p = this.profile;
    const inputs    = Array.from(modal.querySelectorAll('input:not([type="file"]):not([type="hidden"])'));
    const selects   = Array.from(modal.querySelectorAll('select'));
    const textareas = Array.from(modal.querySelectorAll('textarea'));
    for (const input    of inputs)    await this._fillInput(input, p);
    for (const select   of selects)   await this._fillSelect(select, p);
    for (const textarea of textareas) await this._fillTextarea(textarea, p);
    await this._fillRadioGroups(modal, p);
  }

  _rangeToSingleNumber(value) {
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

  async _fillInput(input, p) {
    if (input.disabled || input.readOnly) return;
    if (input.value && input.value.trim() !== '') return;
    const hint = `${this._getLabel(input)} ${input.id || ''} ${input.name || ''}`.toLowerCase();
    let value = this._matchProfileField(hint, p);
    if (value === null || value === undefined || value === '') return;
    value = String(value);
    if (input.type === 'number' || input.getAttribute('inputmode') === 'numeric') value = this._rangeToSingleNumber(value);
    if (/year/i.test(hint) && value.includes('-')) value = this._rangeToSingleNumber(value);
    this._setNativeValue(input, value);
    await this._delay(50);
  }

  async _fillSelect(select, p) {
    if (select.disabled) return;
    if (select.value && select.value !== '' && select.value !== '0') return;
    const hint = `${this._getLabel(select)} ${select.id || ''} ${select.name || ''}`.toLowerCase();
    if (/authoriz|visa|work permit|eligible|legally/i.test(hint)) { this._selectByText(select, p.workAuthorization || 'Yes'); return; }
    if (/sponsor/i.test(hint))             { this._selectByText(select, p.requireSponsorship ? 'Yes' : 'No'); return; }
    if (/relocat/i.test(hint))             { this._selectByText(select, p.willingToRelocate  ? 'Yes' : 'No'); return; }
    if (/country/i.test(hint))             { this._selectByText(select, p.country || 'United States'); return; }
    if (/year.*exp|exp.*year/i.test(hint)) { this._selectClosestNumber(select, p.yearsOfExperience || ''); return; }
    if (/notice|start/i.test(hint))        { this._selectByText(select, p.noticePeriod || '2 weeks'); return; }
  }

  async _fillTextarea(textarea, p) {
    if (textarea.disabled || textarea.readOnly) return;
    if (textarea.value && textarea.value.trim().length > 10) return;
    const hint = `${this._getLabel(textarea)} ${textarea.id || ''}`.toLowerCase();
    if (/cover.?letter|covering/i.test(hint)) return;
    if (/summary|about|additional|message|note/i.test(hint)) this._setNativeValue(textarea, p.summary || '');
    if (/linkedin/i.test(hint)) this._setNativeValue(textarea, p.linkedInUrl || '');
    if (/github/i.test(hint))   this._setNativeValue(textarea, p.githubUrl   || '');
    if (/website|portfolio/i.test(hint)) this._setNativeValue(textarea, p.portfolioUrl || '');
    if (/skill/i.test(hint) && p.skills?.length) this._setNativeValue(textarea, p.skills.join(', '));
  }

  async _fillRadioGroups(modal, p) {
    const groups = modal.querySelectorAll('[role="radiogroup"], fieldset');
    for (const group of groups) {
      const legend = (group.querySelector('legend, [role="group"] label')?.textContent || '').toLowerCase();
      let answer = null;
      if (/sponsor/i.test(legend))                  answer = p.requireSponsorship ? 'yes' : 'no';
      if (/relocat/i.test(legend))                  answer = p.willingToRelocate  ? 'yes' : 'no';
      if (/legally.*work|authorized/i.test(legend)) answer = 'yes';
      if (/currently employ/i.test(legend))         answer = 'yes';
      if (answer) {
        const radios = group.querySelectorAll('input[type="radio"]');
        for (const radio of radios) {
          if ((this._getLabel(radio) + radio.value).toLowerCase().includes(answer)) {
            if (!radio.checked) radio.click();
            break;
          }
        }
      }
    }
  }

  _matchProfileField(hint, p) {
    if (/phone|mobile|cell|tel/i.test(hint))            return p.phone;
    if (/email|e-mail/i.test(hint))                     return p.email;
    if (/first.?name|fname|given/i.test(hint))          return p.firstName;
    if (/last.?name|lname|surname|family/i.test(hint))  return p.lastName;
    if (/full.?name|^name$/i.test(hint))                return p.fullName;
    if (/^city$|city\b/i.test(hint))                    return p.city;
    if (/^state$|\bstate\b/i.test(hint))                return p.state;
    if (/zip|postal/i.test(hint))                       return p.zipCode;
    if (/country/i.test(hint))                          return p.country;
    if (/location|address/i.test(hint))                 return p.location;
    if (/linkedin/i.test(hint))                         return p.linkedInUrl;
    if (/github/i.test(hint))                           return p.githubUrl;
    if (/website|portfolio/i.test(hint))                return p.portfolioUrl;
    if (/year.*exp|exp.*year|years.*work|years.*experience|how many year/i.test(hint)) return this._rangeToSingleNumber(p.yearsOfExperience || '');
    if (/salary|compensation/i.test(hint))              return p.desiredSalary;
    if (/title|headline/i.test(hint))                   return p.headline;
    if (/notice|start date/i.test(hint))                return p.noticePeriod;
    return null;
  }

  _getLabel(el) {
    if (el.id) { const lbl = document.querySelector(`label[for="${el.id}"]`); if (lbl) return lbl.textContent || ''; }
    if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');
    if (el.placeholder) return el.placeholder;
    const parent = el.closest('label, [class*="form-item"], [class*="field"]');
    if (parent) { const lbl = parent.querySelector('label, span[class*="label"], div[class*="label"]'); if (lbl) return lbl.textContent || ''; return parent.textContent || ''; }
    return '';
  }

  _setNativeValue(el, value) {
    const proto  = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, value); else el.value = value;
    el.dispatchEvent(new Event('input',  { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur',   { bubbles: true }));
  }

  _selectByText(select, text) {
    const lower   = text.toLowerCase();
    const options = Array.from(select.options);
    const match   = options.find(o => o.text.toLowerCase() === lower) ||
                    options.find(o => o.text.toLowerCase().includes(lower)) ||
                    options.find(o => lower.includes(o.text.toLowerCase().split(' ')[0]));
    if (match && select.value !== match.value) this._setNativeValue(select, match.value);
  }

  _selectClosestNumber(select, target) {
    if (!target) return;
    const num = parseInt(this._rangeToSingleNumber(String(target)), 10);
    if (isNaN(num)) return;
    let best = null, bestDiff = Infinity;
    for (const opt of select.options) {
      if (!opt.value || opt.value === '' || opt.value === '0') continue;
      const optRangeMatch = opt.text.match(/^(\d+)\s*[-–]\s*(\d+)/);
      if (optRangeMatch) {
        const lo = parseInt(optRangeMatch[1], 10), hi = parseInt(optRangeMatch[2], 10);
        const diff = Math.min(Math.abs(lo - num), Math.abs(hi - num), Math.abs((lo+hi)/2 - num));
        if (diff < bestDiff) { bestDiff = diff; best = opt; }
      } else {
        const m = opt.text.match(/(\d+)/);
        if (m) { const diff = Math.abs(parseInt(m[1], 10) - num); if (diff < bestDiff) { bestDiff = diff; best = opt; } }
      }
    }
    if (best) this._setNativeValue(select, best.value);
  }

  _delay(ms) { return new Promise(r => setTimeout(r, ms)); }
}

// ─────────────────────────────────────────────────────────────────
// Detect apply button type on LinkedIn
// ─────────────────────────────────────────────────────────────────
function getApplyButtonInfo() {
  const easyApplySelectors = ['button.jobs-apply-button[aria-label*="Easy Apply"]', 'button.jobs-apply-button'];
  for (const sel of easyApplySelectors) {
    const btn = document.querySelector(sel);
    if (btn && btn.textContent?.toLowerCase().includes('easy apply')) return { type: 'easy', button: btn };
  }
  const externalBtn = document.querySelector('button.jobs-apply-button, a.jobs-apply-button, [data-control-name="jobdetails_topcard_inapply"]');
  if (externalBtn) {
    const link = document.querySelector('a[href*="apply"], a[data-tracking-control-name*="apply"], .jobs-apply-button a');
    return { type: 'external', button: externalBtn, url: link?.href || null };
  }
  return { type: 'none', button: null, url: null };
}

// ─────────────────────────────────────────────────────────────────
// Main banner class
// ─────────────────────────────────────────────────────────────────

class PreciprocalBanner {
  constructor() {
    this.jobData         = null;
    this.banner          = null;
    this.currentUrl      = window.location.href;
    this.observer        = null;
    this.authToken       = null;
    this.authUserId      = null;
    this.authEmail       = null;
    this.isAuthenticated = false;
    this.trackState      = 'idle';
    this.applyState      = 'idle';
    this.applyProfile    = null;
    this.applyFiles      = null;
  }

  _delay(ms) { return new Promise(r => setTimeout(r, ms)); }

  async init() {
    try {
      await this.checkAuth();
      await this.waitForElement(
        '.job-details-jobs-unified-top-card__container--two-pane, .jobs-unified-top-card, .jobs-details__main-content'
      );
      const extractor = new JobExtractor();
      this.jobData = extractor.extractJobData();
      if (!this.jobData?.title) return;
      await this._delay(500);
      this.injectBanner();
      if (this.isAuthenticated) {
        await Promise.all([this.fetchMatchScore(), this.prefetchApplyProfile()]);
      }
      this.observeJobChanges();
    } catch (error) {
      console.error('❌ Banner init error:', error);
    }
  }

  async prefetchApplyProfile() {
    if (!this.authToken) return;
    try {
      const res = await fetch(`${PRECIPROCAL_URL}/api/extension/auto-apply`, {
        headers: {
          'x-extension-token': this.authToken,
          'x-user-email':      this.authEmail  || '',
          'x-user-id':         this.authUserId || '',
        },
      });
      if (res.ok) {
        const data        = await res.json();
        this.applyProfile = data.applyProfile || null;
        this.applyFiles   = data.files        || null;
        console.log('✅ Apply profile prefetched:', this.applyProfile?.firstName);
      }
    } catch (e) {
      console.warn('⚠️ Prefetch failed:', e.message);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // AUTH CHECK — never throws, never blocks banner from showing.
  // Always resolves: authenticated or not, banner renders either way.
  // ─────────────────────────────────────────────────────────────
  async checkAuth() {
    // Step 1: read storage directly — fast, always works
    try {
      const result = await chrome.storage.local.get(['preciprocal_auth']);
      const auth   = result?.preciprocal_auth;
      if (auth?.uid && auth?.token) {
        this._setAuth(auth);
        console.log('✅ Banner auth from storage:', this.authEmail);
        return;
      }
    } catch (e) {
      console.warn('⚠️ Storage read failed:', e?.message);
    }

    // Step 2: try background sync with a hard timeout so it never hangs
    try {
      const syncResult = await Promise.race([
        chrome.runtime.sendMessage({ type: 'SYNC_AUTH' }),
        new Promise((resolve) => setTimeout(() => resolve(null), 2000)), // 2s max
      ]);
      if (syncResult?.success) {
        const result = await chrome.storage.local.get(['preciprocal_auth']);
        const auth   = result?.preciprocal_auth;
        if (auth?.uid && auth?.token) {
          this._setAuth(auth);
          console.log('✅ Banner auth after sync:', this.authEmail);
          return;
        }
      }
    } catch (e) {
      // Service worker dormant or unavailable — not a problem, just show banner unauthenticated
      console.warn('⚠️ Background sync skipped:', e?.message);
    }

    // Not authenticated — banner still shows, buttons redirect to sign-in
    console.warn('❌ Banner: not authenticated');
    this.isAuthenticated = false;
  }

  _setAuth(auth) {
    this.isAuthenticated = true;
    this.authUserId      = auth.uid;
    this.authEmail       = auth.email       || null;
    this.authToken       = auth.token;
  }

  waitForElement(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const selectors = selector.split(',').map(s => s.trim());
      for (const sel of selectors) { const el = document.querySelector(sel); if (el) return resolve(el); }
      const observer = new MutationObserver(() => {
        for (const sel of selectors) { const el = document.querySelector(sel); if (el) { observer.disconnect(); resolve(el); return; } }
      });
      observer.observe(document.body, { childList: true, subtree: true });
      setTimeout(() => { observer.disconnect(); reject(new Error('Element not found')); }, timeout);
    });
  }

  findBestInsertionPoint() {
    const strategies = [
      () => { const el = document.querySelector('.job-details-jobs-unified-top-card__primary-description-container'); if (el) return { element: el, position: 'afterend' }; },
      () => { const el = document.querySelector('.job-details-jobs-unified-top-card__container--two-pane'); if (el?.firstElementChild) return { element: el.firstElementChild, position: 'afterend' }; },
      () => { const el = document.querySelector('.jobs-apply-button, .jobs-apply-button--top-card'); if (el) return { element: el.closest('div[class*="container"]') || el.parentElement, position: 'afterend' }; },
      () => { const el = document.querySelector('.job-details-jobs-unified-top-card__job-insight'); if (el) return { element: el, position: 'beforebegin' }; },
      () => { const el = document.querySelector('.jobs-unified-top-card, .job-details-jobs-unified-top-card'); if (el) return { element: el, position: 'afterend' }; },
    ];
    for (const strategy of strategies) { try { const r = strategy(); if (r) return r; } catch {} }
    return null;
  }

  injectBanner() {
    document.getElementById('preciprocal-inline-banner')?.remove();
    const insertion = this.findBestInsertionPoint();
    if (!insertion) return;
    this.banner = this.createBannerElement();
    insertion.element.insertAdjacentElement(insertion.position, this.banner);
    this.attachEventListeners();
    this.injectStyles();
  }

  _getApplyButtonLabel() {
    const info = getApplyButtonInfo();
    if (info.type === 'easy')     return { label: 'Easy Apply', tip: '🚀 Auto-fill LinkedIn Easy Apply with your profile data' };
    if (info.type === 'external') return { label: 'Auto Apply', tip: '🚀 Opens company site and auto-fills the form with your profile' };
    return { label: 'Auto Apply', tip: '🚀 Auto-fill the job application with your Preciprocal profile' };
  }

  createBannerElement() {
    const container = document.createElement('div');
    container.id        = 'preciprocal-inline-banner';
    container.className = 'preciprocal-inline-container';
    let logoUrl = '';
    try { logoUrl = chrome.runtime.getURL('icons/icon48.png'); } catch {}
    const applyMeta = this._getApplyButtonLabel();
    container.innerHTML = `
      <div class="preciprocal-banner-compact">
        <div class="prc-top-section">
          <h3 class="prc-title">Tired of tailoring for Jobs? Let us do it for you!</h3>
          ${this.isAuthenticated ? `
          <div class="prc-score-badge" title="Resume match score for this job">
            <svg class="score-ring" width="40" height="40">
              <circle class="ring-bg" cx="20" cy="20" r="16" stroke-width="3" fill="none"/>
              <circle class="ring-fg" cx="20" cy="20" r="16" stroke-width="3" fill="none" stroke-dasharray="0 100.53" transform="rotate(-90 20 20)" stroke-linecap="round"/>
            </svg>
            <div class="score-val"><span class="num">--</span></div>
          </div>` : ''}
        </div>
        <div class="prc-actions">
          <button class="prc-btn prc-primary" data-action="cover-letter" title="✨ Done in 30 seconds! AI writes your winning cover letter tailored to THIS exact role">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
            Cover Letter
          </button>
          <button class="prc-btn prc-apply" data-action="auto-apply" title="${applyMeta.tip}">
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            <span class="apply-label">${applyMeta.label}</span>
          </button>
          <button class="prc-btn prc-track prc-icon-only" data-action="track-job" title="📋 Save this job to your Preciprocal tracker">
            <svg class="track-icon" width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>
          </button>
        </div>
        <div class="prc-footer">
          <div class="prc-branding">
            ${logoUrl ? `<img src="${logoUrl}" alt="Preciprocal" class="prc-logo-icon" />` : ''}
            <div class="prc-brand-name">Preciprocal</div>
          </div>
        </div>
      </div>
    `;
    return container;
  }

  async handleAutoApply() {
    if (this.applyState === 'done' || this.applyState === 'loading') return;
    const btn     = this.banner?.querySelector('[data-action="auto-apply"]');
    const labelEl = btn?.querySelector('.apply-label');
    if (!this.isAuthenticated) {
      this.showNotification('Please log in to Preciprocal first', 'error');
      setTimeout(() => window.open(`${PRECIPROCAL_URL}/sign-in`, '_blank'), 1500);
      return;
    }
    this.applyState = 'loading';
    if (btn) btn.classList.add('loading');
    if (labelEl) labelEl.textContent = 'Loading profile…';
    this._replaceButtonIcon(btn, 'spinner');
    try {
      if (!this.applyProfile) {
        if (!this.authToken) throw new Error('Not logged in');
        const res = await fetch(`${PRECIPROCAL_URL}/api/extension/auto-apply`, {
          headers: { 'x-extension-token': this.authToken, 'x-user-email': this.authEmail || '', 'x-user-id': this.authUserId || '' },
        });
        if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || `HTTP ${res.status}`); }
        const data = await res.json();
        this.applyProfile = data.applyProfile;
        this.applyFiles   = data.files || null;
      }
      if (!this.applyProfile) throw new Error('Profile data unavailable');
      const applyInfo = getApplyButtonInfo();
      if (applyInfo.type === 'easy') {
        if (labelEl) labelEl.textContent = 'Applying…';
        const engine = new EasyApplyEngine(this.applyProfile, (msg, type) => {
          if (type === 'success') this.showNotification(msg, 'success');
          if (type === 'error')   this.showNotification(msg, 'error');
        });
        await engine.start();
        // Inject resume into resume slot, transcript into transcript slot only
        try { await this._injectFilesIntoModal(); } catch {}
        this.applyState = 'done';
        if (btn) { btn.classList.remove('loading'); btn.classList.add('done'); }
        if (labelEl) labelEl.textContent = 'Review & Submit';
        this._replaceButtonIcon(btn, 'check');
        this.showNotificationWithLink(`Easy Apply form filled for ${this.jobData?.company}`, 'View Job Tracker →', `${PRECIPROCAL_URL}/job-tracker`, 'success');
      } else if (applyInfo.type === 'external') {
        await chrome.storage.local.set({ preciprocal_auto_apply_profile: this.applyProfile, preciprocal_auto_apply_files: this.applyFiles || null, preciprocal_auto_apply_timestamp: Date.now(), preciprocal_auto_apply_job: this.jobData });
        if (applyInfo.button) {
          if (labelEl) labelEl.textContent = 'Opening…';
          applyInfo.button.click();
          this.applyState = 'done';
          if (btn) { btn.classList.remove('loading'); btn.classList.add('done'); }
          if (labelEl) labelEl.textContent = 'Filling on site…';
          this._replaceButtonIcon(btn, 'check');
          this.showNotification('🔗 Opening company site — Preciprocal will auto-fill the form', 'success');
        } else { throw new Error('Could not find the Apply button on this listing'); }
      } else { throw new Error('No Apply button found on this job listing'); }
    } catch (error) {
      console.error('❌ Auto-apply failed:', error);
      this.applyState = 'idle';
      if (btn) { btn.classList.remove('loading'); btn.classList.add('error'); }
      if (labelEl) labelEl.textContent = 'Try Again';
      this._replaceButtonIcon(btn, 'lightning');
      this.showNotification(error.message || 'Auto-apply failed', 'error');
      setTimeout(() => { if (btn) btn.classList.remove('error'); if (labelEl) labelEl.textContent = this._getApplyButtonLabel().label; this.applyState = 'idle'; }, 3000);
    }
  }

  async handleAction(action) {
    if (!this.isAuthenticated) {
      this.showNotification('Please log in to Preciprocal first', 'error');
      setTimeout(() => window.open(`${PRECIPROCAL_URL}/sign-in`, '_blank'), 1500);
      return;
    }
    if (action === 'auto-apply') { await this.handleAutoApply(); return; }
    if (action === 'track-job')  { await this.handleTrackJob();  return; }
    const actionMap = { 'cover-letter': '/cover-letter/create', 'resume-boost': '/resume/ai-writer', 'recruiter-view': '/recruiter-analysis' };
    const path = actionMap[action];
    if (!path) return;
    await chrome.storage.local.set({ preciprocal_linkedin_job: this.jobData, preciprocal_timestamp: Date.now() });
    window.open(`${PRECIPROCAL_URL}${path}?linkedin_job=true`, '_blank');
  }

  // ── Classify all file inputs in the modal into resume / transcript buckets ──
  _classifyModalFileInputs(modal) {
    const all        = Array.from(modal.querySelectorAll('input[type="file"]:not([disabled])'));
    const resume     = [], transcript = [], other = [];
    for (const inp of all) {
      // Build a label string from aria-label, placeholder, nearby <label>, or parent text
      let lbl = inp.getAttribute('aria-label') || inp.placeholder || '';
      if (!lbl && inp.id) {
        const forLabel = document.querySelector(`label[for="${inp.id}"]`);
        if (forLabel) lbl = forLabel.textContent || '';
      }
      if (!lbl) {
        const container = inp.closest('[class*="field"], [class*="form-item"], fieldset, label, div');
        if (container) lbl = container.textContent || '';
      }
      lbl = lbl.toLowerCase();
      if (/resume|cv\b|curriculum vitae/i.test(lbl))                    resume.push(inp);
      else if (/transcript|academic record|grade|certificate/i.test(lbl)) transcript.push(inp);
      else if (/cover.?letter/i.test(lbl))                               { /* skip — never inject into cover letter */ }
      else                                                                 other.push(inp);
    }
    // If we couldn't label them, assume the first unknown is resume, second is transcript
    if (!resume.length     && other.length) resume.push(other.shift());
    if (!transcript.length && other.length) transcript.push(other.shift());
    return { resume, transcript };
  }

  async _buildFileObject(url, fileName) {
    const ext     = (fileName.split('.').pop() || '').toLowerCase();
    const mimeMap = { pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
    const mime    = mimeMap[ext] || 'application/octet-stream';
    if (url.startsWith('data:')) {
      const base64 = url.split(',')[1];
      if (!base64) throw new Error('Invalid base64 data URL');
      const binary = atob(base64);
      const bytes  = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      return new File([bytes], fileName, { type: mime });
    }
    const res = await fetch(url, { mode: 'cors' });
    if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
    return new File([await res.blob()], fileName, { type: mime });
  }

  async _setFileOnInput(input, file) {
    const dt = new DataTransfer();
    dt.items.add(file);
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    input.dispatchEvent(new Event('input',  { bubbles: true }));
  }

  // Injects resume → resume inputs only, transcript → transcript inputs only
  async _injectFilesIntoModal() {
    const modal = document.querySelector('[data-test-modal-id="easy-apply-modal"], .jobs-easy-apply-modal, .artdeco-modal[role="dialog"]');
    if (!modal) return { resume: false, transcript: false };
    const { resume: resumeInputs, transcript: transcriptInputs } = this._classifyModalFileInputs(modal);
    const result = { resume: false, transcript: false };

    // Inject resume
    if (this.applyFiles?.resume?.available && this.applyFiles.resume.url && resumeInputs.length) {
      try {
        const file = await this._buildFileObject(this.applyFiles.resume.url, this.applyFiles.resume.fileName);
        for (const inp of resumeInputs) await this._setFileOnInput(inp, file);
        result.resume = true;
        console.log('✅ Resume injected into modal');
      } catch (e) { console.warn('⚠️ Resume injection failed:', e.message); }
    }

    // Inject transcript — only into transcript-labelled inputs, NEVER into resume or cover letter slots
    if (this.applyFiles?.transcript?.available && this.applyFiles.transcript.url && transcriptInputs.length) {
      try {
        const file = await this._buildFileObject(this.applyFiles.transcript.url, this.applyFiles.transcript.fileName);
        for (const inp of transcriptInputs) await this._setFileOnInput(inp, file);
        result.transcript = true;
        console.log('✅ Transcript injected into modal (transcript section only)');
      } catch (e) { console.warn('⚠️ Transcript injection failed:', e.message); }
    }

    return result;
  }

  async handleTrackJob() {
    if (this.trackState === 'done' || this.trackState === 'duplicate') return;
    const btn = this.banner?.querySelector('[data-action="track-job"]');
    this.trackState = 'loading';
    if (btn) btn.classList.add('loading');
    this._replaceButtonIcon(btn, 'spinner');
    try {
      if (!this.authToken) throw new Error('Not logged in');
      const response = await fetch(`${PRECIPROCAL_URL}/api/extension/track-job`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-extension-token': this.authToken, 'x-user-email': this.authEmail || '', 'x-user-id': this.authUserId || '' },
        body: JSON.stringify(this.jobData),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
      if (data.duplicate) {
        this.trackState = 'duplicate';
        if (btn) { btn.classList.remove('loading'); btn.classList.add('duplicate'); }
        this._replaceButtonIcon(btn, 'bookmark');
        this.showNotificationWithLink('Already in your tracker', 'View tracker →', `${PRECIPROCAL_URL}/job-tracker`, 'info');
      } else {
        this.trackState = 'done';
        if (btn) { btn.classList.remove('loading'); btn.classList.add('done'); }
        this._replaceButtonIcon(btn, 'check');
        this.showNotificationWithLink(`${this.jobData?.company} added to tracker`, 'View tracker →', `${PRECIPROCAL_URL}/job-tracker`, 'success');
      }
    } catch (error) {
      this.trackState = 'idle';
      if (btn) btn.classList.remove('loading');
      this._replaceButtonIcon(btn, 'bookmark');
      this.showNotification(error.message || 'Failed to track job', 'error');
    }
  }

  async fetchMatchScore() {
    if (!this.isAuthenticated || !this.authToken) { this.updateMatchScore(null); return; }
    try {
      const response = await fetch(`${PRECIPROCAL_URL}/api/extension/analyze-job`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-extension-token': this.authToken, 'x-user-email': this.authEmail || '', 'x-user-id': this.authUserId || '' },
        body: JSON.stringify(this.jobData),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      this.updateMatchScore(data.compatibilityScore);
      const badge = this.banner?.querySelector('.prc-score-badge');
      if (badge && data.oneLineSummary) badge.setAttribute('title', data.oneLineSummary);
    } catch { this.updateMatchScore(null); }
  }

  updateMatchScore(score) {
    if (!this.banner) return;
    const scoreEl = this.banner.querySelector('.num');
    const circle  = this.banner.querySelector('.ring-fg');
    if (!scoreEl || !circle) return;
    if (score !== null && score !== undefined) {
      scoreEl.textContent = Math.round(score);
      const c = 2 * Math.PI * 16;
      circle.setAttribute('stroke-dasharray', `${c}`);
      circle.setAttribute('stroke-dashoffset', `${c - (score / 100) * c}`);
      const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
      circle.setAttribute('stroke', color);
      scoreEl.style.color = color;
    } else {
      scoreEl.textContent = '--';
      circle.setAttribute('stroke', '#a855f7');
      scoreEl.style.color = '#c084fc';
    }
  }

  attachEventListeners() {
    if (!this.banner) return;
    this.banner.querySelectorAll('[data-action]').forEach(button => {
      button.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); this.handleAction(button.getAttribute('data-action')); });
    });
    const brandName = this.banner.querySelector('.prc-brand-name');
    if (brandName) brandName.addEventListener('click', e => { e.preventDefault(); e.stopPropagation(); window.open(`${PRECIPROCAL_URL}`, '_blank'); });
  }

  _replaceButtonIcon(btn, iconName) {
    if (!btn) return;
    const existing = btn.querySelector('svg, .prc-spinner');
    if (!existing) return;
    if (iconName === 'spinner') { const spinner = document.createElement('div'); spinner.className = 'prc-spinner'; existing.replaceWith(spinner); return; }
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg'); const path = document.createElementNS(ns, 'path');
    svg.setAttribute('width', '16'); svg.setAttribute('height', '16'); svg.setAttribute('fill', 'none'); svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-linecap', 'round'); path.setAttribute('stroke-linejoin', 'round'); path.setAttribute('stroke-width', '2');
    const paths = { check: 'M5 13l4 4L19 7', lightning: 'M13 10V3L4 14h7v7l9-11h-7z', bookmark: 'M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z' };
    path.setAttribute('d', paths[iconName] || paths.lightning);
    svg.appendChild(path); existing.replaceWith(svg);
  }

  _toastIcons() {
    return {
      success: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>`,
      error:   `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>`,
      info:    `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>`,
    };
  }

  showNotification(message, type = 'success') {
    const icons = this._toastIcons();
    const n = document.createElement('div');
    n.className = `preciprocal-notification ${type}`;
    n.innerHTML = `<div class="prc-toast-inner"><div class="prc-toast-icon">${icons[type]||icons.info}</div><div class="prc-toast-body"><div class="prc-toast-msg">${message}</div></div></div>`;
    document.body.appendChild(n);
    setTimeout(() => n.classList.add('show'), 10);
    setTimeout(() => { n.classList.remove('show'); setTimeout(() => n.remove(), 300); }, 2800);
  }

  showNotificationWithLink(message, linkText, linkUrl, type = 'success') {
    const icons = this._toastIcons();
    const n = document.createElement('div');
    n.className = `preciprocal-notification ${type}`;
    n.innerHTML = `<div class="prc-toast-inner"><div class="prc-toast-icon">${icons[type]||icons.info}</div><div class="prc-toast-body"><div class="prc-toast-msg">${message}</div><span class="prc-toast-link">${linkText} →</span></div></div>`;
    n.querySelector('.prc-toast-link').addEventListener('click', () => window.open(linkUrl, '_blank'));
    document.body.appendChild(n);
    setTimeout(() => n.classList.add('show'), 10);
    setTimeout(() => { n.classList.remove('show'); setTimeout(() => n.remove(), 300); }, 4500);
  }

  observeJobChanges() {
    if (this.observer) this.observer.disconnect();
    this.observer = new MutationObserver(() => {
      const newUrl = window.location.href;
      if (newUrl !== this.currentUrl && newUrl.includes('/jobs/')) {
        this.currentUrl = newUrl;
        this.destroy();
        setTimeout(() => this.init(), 1000);
      }
    });
    this.observer.observe(document.body, { childList: true, subtree: true });
  }

  destroy() {
    this.banner?.remove(); this.banner = null;
    this.observer?.disconnect(); this.observer = null;
    this.trackState = 'idle'; this.applyState = 'idle';
    this.applyProfile = null;
  }

  injectStyles() {
    if (document.getElementById('preciprocal-banner-styles')) return;
    const styles = document.createElement('style');
    styles.id = 'preciprocal-banner-styles';
    styles.textContent = `
      .preciprocal-inline-container { margin:16px 0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif; }
      .preciprocal-banner-compact { background:linear-gradient(135deg,#1e1b4b 0%,#1e293b 100%); border:1px solid rgba(148,163,184,0.2); border-radius:8px; padding:16px; box-shadow:0 1px 3px rgba(0,0,0,0.2); transition:all 0.2s ease; position:relative; }
      .preciprocal-banner-compact:hover { box-shadow:0 2px 8px rgba(0,0,0,0.25); border-color:rgba(168,85,247,0.3); }
      .prc-top-section { display:flex; align-items:center; justify-content:space-between; gap:16px; margin-bottom:12px; }
      .prc-title { font-size:16px; font-weight:600; color:#f5f5f5; margin:0; line-height:1.4; flex:1; }
      .prc-actions { display:flex; gap:8px; margin-bottom:12px; }
      .prc-footer { display:flex; align-items:center; justify-content:center; }
      .prc-branding { display:flex; align-items:center; gap:8px; }
      .prc-logo-icon { width:24px; height:24px; border-radius:4px; object-fit:contain; }
      .prc-brand-name { font-size:12px; font-weight:600; color:#b0b8c1; line-height:1.2; cursor:pointer; }
      .prc-score-badge { position:relative; width:40px; height:40px; flex-shrink:0; }
      .score-ring { width:40px; height:40px; }
      .ring-bg { stroke:#38434f; }
      .ring-fg { stroke:#a855f7; transition:stroke-dasharray 0.6s ease; }
      .score-val { position:absolute; top:50%; left:50%; transform:translate(-50%,-50%); text-align:center; }
      .score-val .num { font-size:14px; font-weight:700; color:#c084fc; line-height:1; }
      .prc-btn { display:inline-flex; align-items:center; justify-content:center; gap:6px; padding:8px 12px; background:transparent; border:1px solid #a855f7; border-radius:16px; color:#c084fc; font-size:14px; font-weight:600; cursor:pointer; transition:all 0.2s ease; white-space:nowrap; font-family:inherit; flex:1; position:relative; }
      .prc-btn::after { content:attr(title); position:absolute; bottom:calc(100% + 8px); left:50%; transform:translateX(-50%) translateY(4px); background:rgba(15,23,42,0.95); color:#f5f5f5; padding:8px 12px; border-radius:6px; font-size:12px; font-weight:400; white-space:normal; max-width:220px; text-align:center; line-height:1.4; pointer-events:none; opacity:0; visibility:hidden; transition:all 0.2s ease; z-index:10000; box-shadow:0 4px 12px rgba(0,0,0,0.4); }
      .prc-btn::before { content:''; position:absolute; bottom:calc(100% + 2px); left:50%; transform:translateX(-50%) translateY(4px); border:5px solid transparent; border-top-color:rgba(15,23,42,0.95); pointer-events:none; opacity:0; visibility:hidden; transition:all 0.2s ease; z-index:10000; }
      .prc-btn:hover::after,.prc-btn:hover::before { opacity:1; visibility:visible; transform:translateX(-50%) translateY(0); }
      .prc-btn:hover { background:rgba(168,85,247,0.1); border-color:#c084fc; }
      .prc-btn:active { background:rgba(168,85,247,0.2); transform:scale(0.98); }
      .prc-btn.prc-primary { background:linear-gradient(135deg,#a855f7 0%,#7c3aed 100%); border-color:#a855f7; color:#ffffff; }
      .prc-btn.prc-primary:hover { background:linear-gradient(135deg,#9333ea 0%,#6d28d9 100%); }
      .prc-btn.prc-apply { background:linear-gradient(135deg,#0ea5e9 0%,#2563eb 100%); border-color:#0ea5e9; color:#ffffff; }
      .prc-btn.prc-apply:hover { background:linear-gradient(135deg,#0284c7 0%,#1d4ed8 100%); }
      .prc-btn.prc-apply.loading { opacity:0.7; cursor:not-allowed; pointer-events:none; }
      .prc-btn.prc-apply.done { background:linear-gradient(135deg,#10b981 0%,#059669 100%); border-color:#10b981; pointer-events:none; }
      .prc-btn.prc-apply.error { background:linear-gradient(135deg,#ef4444 0%,#b91c1c 100%); border-color:#ef4444; }
      .prc-btn.prc-track { background:transparent; border-color:#6e7681; color:#b0b8c1; }
      .prc-btn.prc-track:hover { background:rgba(110,118,129,0.08); border-color:#b0b8c1; color:#f5f5f5; }
      .prc-btn.prc-icon-only { flex:0 0 auto; width:38px; min-width:unset; padding:0; border-radius:50%; }
      .prc-btn.prc-track.loading { opacity:0.7; cursor:not-allowed; pointer-events:none; }
      .prc-btn.prc-track.done { border-color:#10b981; color:#10b981; background:rgba(16,185,129,0.08); cursor:default; pointer-events:none; }
      .prc-btn.prc-track.duplicate { border-color:#f59e0b; color:#f59e0b; background:rgba(245,158,11,0.08); cursor:default; pointer-events:none; }
      .prc-btn svg { width:16px; height:16px; flex-shrink:0; stroke-width:2; }
      .prc-spinner { width:14px; height:14px; border:2px solid rgba(176,184,193,0.3); border-top-color:#b0b8c1; border-radius:50%; animation:prc-spin 0.7s linear infinite; flex-shrink:0; }
      @keyframes prc-spin { to { transform:rotate(360deg); } }
      .preciprocal-notification { position:fixed; bottom:24px; right:24px; z-index:999999; opacity:0; transform:translateY(8px) scale(0.96); transition:opacity 0.22s cubic-bezier(0.16,1,0.3,1),transform 0.22s cubic-bezier(0.16,1,0.3,1); font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; pointer-events:none; }
      .preciprocal-notification.show { opacity:1; transform:translateY(0) scale(1); pointer-events:auto; }
      .prc-toast-inner { display:flex; align-items:center; gap:10px; padding:12px 14px; border-radius:12px; background:#0f172a; border:1px solid rgba(148,163,184,0.12); box-shadow:0 4px 24px rgba(0,0,0,0.5); backdrop-filter:blur(16px); min-width:240px; max-width:340px; }
      .prc-toast-icon { width:18px; height:18px; flex-shrink:0; display:flex; align-items:center; justify-content:center; }
      .prc-toast-icon svg { width:15px; height:15px; }
      .prc-toast-body { flex:1; min-width:0; }
      .prc-toast-msg { font-size:13px; font-weight:500; color:#f1f5f9; line-height:1.4; }
      .prc-toast-link { display:inline-flex; align-items:center; gap:3px; margin-top:4px; font-size:11px; font-weight:600; color:#a78bfa; cursor:pointer; text-decoration:none; letter-spacing:0.01em; }
      .prc-toast-link:hover { color:#c4b5fd; }
      .preciprocal-notification.success .prc-toast-icon { color:#10b981; }
      .preciprocal-notification.success .prc-toast-inner { border-color:rgba(16,185,129,0.2); }
      .preciprocal-notification.error .prc-toast-icon { color:#f87171; }
      .preciprocal-notification.error .prc-toast-inner { border-color:rgba(248,113,113,0.2); }
      .preciprocal-notification.info .prc-toast-icon { color:#a78bfa; }
      .preciprocal-notification.info .prc-toast-inner { border-color:rgba(167,139,250,0.2); }
      .preciprocal-banner { display:flex; align-items:center; gap:8px; padding:10px 16px; margin:0 0 4px 0; border-bottom:1px solid rgba(139,92,246,0.25); background:linear-gradient(135deg,rgba(15,10,35,0.97) 0%,rgba(30,18,60,0.97) 100%); font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; font-size:13px; color:#c4b5fd; position:sticky; top:0; z-index:9999; border-radius:8px 8px 0 0; backdrop-filter:blur(12px); }
      .preciprocal-banner[data-state="filling"] { color:#93c5fd; }
      .preciprocal-banner[data-state="ready"] { color:#86efac; border-bottom-color:rgba(134,239,172,0.2); }
      .pr-icon { font-size:14px; flex-shrink:0; }
      .preciprocal-banner span:not(.pr-icon):not(.pr-spinner) { flex:1; font-weight:500; }
      .pr-dismiss { background:none; border:none; color:rgba(134,239,172,0.6); cursor:pointer; font-size:12px; padding:2px 4px; border-radius:4px; line-height:1; flex-shrink:0; }
      .pr-dismiss:hover { color:#86efac; background:rgba(134,239,172,0.1); }
      @media (max-width:768px) { .preciprocal-banner-compact{padding:12px} .prc-top-section{flex-direction:column;align-items:flex-start;gap:12px} .prc-actions{flex-direction:column;width:100%} .prc-btn{width:100%;font-size:13px} .prc-title{font-size:14px} }
      @media (max-width:1024px) { .prc-actions{flex-wrap:wrap} .prc-btn{flex:1 1 calc(50% - 4px);min-width:140px} }
      @media print { .preciprocal-inline-container,.preciprocal-notification{display:none!important} }
    `;
    document.head.appendChild(styles);
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

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBanner);
} else {
  initBanner();
}
setTimeout(initBanner, 2000);
setTimeout(initBanner, 4000);

console.log('✅ Preciprocal banner.js ready (Universal Auto Apply)');
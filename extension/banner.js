// ═══════════════════════════════════════════════════════════════════
// banner.js — LINKEDIN ONLY
// Injected exclusively on: linkedin.com/*
// Handles: job card chips, match score, Easy Apply auto-fill, job tracker
//
// DO NOT add external ATS logic here.
// External ATS auto-fill lives in external-apply.js (different domains).
//
// Storage handoff (write here, read in external-apply.js):
//   preciprocal_auto_apply_profile  — user profile object
//   preciprocal_auto_apply_files    — resume / transcript file info
//   preciprocal_auto_apply_job      — job metadata
//   preciprocal_pending_confirm_job — confirmation prompt on return
// ═══════════════════════════════════════════════════════════════════

console.log('🎯 Preciprocal banner.js loaded on:', window.location.href);

// NEVER ship this as true - it points every API call this content script
// makes (job match scoring, profile data, apply tracking) at localhost
// instead of production, so it silently fails for every real user. Only
// flip it for local testing against `npm run dev`, and flip it back before
// packaging.
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
        font-family: PrcInter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important;
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
    const base = 'display:inline-flex!important;align-items:center!important;flex-shrink:0!important;gap:3px!important;padding:1px 6px!important;border-radius:4px!important;font-size:9px!important;font-weight:700!important;font-family:PrcInter, -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif!important;white-space:nowrap!important;line-height:1.6!important;letter-spacing:0.06em!important;text-transform:uppercase!important;pointer-events:none!important;user-select:none!important;vertical-align:middle!important;';
    if (type === 'applied') {
      // Mid tones that read on LinkedIn's light and dark themes alike.
      span.style.cssText = base + 'background:linear-gradient(135deg,#5b6ef5,#7c3aed)!important;color:#fff!important;border:0!important;box-shadow:0 2px 8px -2px rgba(91,110,245,0.6)!important;';
      span.textContent = '✓ Applied';
    } else {
      span.style.cssText = base + 'background:#16a34a!important;color:#fff!important;border:0!important;box-shadow:0 2px 8px -2px rgba(22,163,74,0.55)!important;';
      span.textContent = 'Saved';
    }
    span.style.cssText += 'font-size:10.5px!important;padding:3px 9px!important;border-radius:999px!important;letter-spacing:0.04em!important;';
    span.title = type === 'applied' ? 'You applied to this job (Preciprocal)' : 'In your Preciprocal tracker';
    return span;
  }

  static _findCard(jobId) {
    if (!jobId) return null;
    const el1 = document.querySelector(`[data-occludable-job-id="${jobId}"]`);
    if (el1) return el1.closest('li') || el1;
    const el2 = document.querySelector(`[data-job-id="${jobId}"]`);
    if (el2) return el2.closest('li') || el2;
    const el4 = document.querySelector(`[data-entity-urn*="${jobId}"]`);
    if (el4) return el4.closest('li') || el4;
    // Current layout: the same card the company chips use, never the open job's panel.
    for (const a of document.querySelectorAll(`a[href*="currentJobId=${jobId}"], a[href*="/jobs/view/${jobId}"]`)) {
      if (CardFacts.jobIdOf(a) !== String(jobId) || a.closest('#preciprocal-inline-banner')) continue;
      const apply = prcFindApplyControl(); const pane = apply ? prcJobPane(apply) : null;
      if (pane && pane.contains(a)) continue;
      const card = a.closest('li') || a.closest('[role="listitem"]') || CardFacts.cardRoot(a, String(jobId));
      if (card && !(pane && card.contains(pane))) return card;
    }
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

    // Bottom-right corner of the card: clear of the logo, the title and
    // LinkedIn's dismiss button at the top right.
    if (getComputedStyle(card).position === 'static') card.style.setProperty('position', 'relative', 'important');
    chip.style.cssText += 'position:absolute!important;right:12px!important;bottom:12px!important;z-index:5!important;';
    card.appendChild(chip);

    LabelInjector._persistLabel(jobId, type);
  }

  /** Every known label, kept in memory so new cards can be tagged at once. */
  static _labels = {};

  /**
   * LinkedIn adds list cards as the student scrolls and swaps them on each
   * search, so a one-off pass misses most of them. This tags any card that
   * appears without its chip, at most a few times a second.
   */
  static watch() {
    if (LabelInjector._watching) return;
    LabelInjector._watching = true;
    let timer = null;
    const pass = () => {
      timer = null;
      for (const [id, type] of Object.entries(LabelInjector._labels)) {
        const card = LabelInjector._findCard(id);
        if (card && !card.querySelector(`[data-prc-chip="${type}"]`)) LabelInjector.inject(id, type);
      }
    };
    new MutationObserver(() => { if (!timer) timer = setTimeout(pass, 400); }).observe(document.body, { childList: true, subtree: true });
    chrome.storage.local.get([LabelInjector.STORAGE_KEY]).then(r => { LabelInjector._labels = { ...(r[LabelInjector.STORAGE_KEY] || {}), ...LabelInjector._labels }; pass(); }).catch(() => {});
  }

  static async _persistLabel(jobId, type) {
    LabelInjector._labels[jobId] = type;
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
    Object.assign(LabelInjector._labels, jobIds);
    LabelInjector.watch();
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
// Company facts on each job card in LinkedIn's list
// ─────────────────────────────────────────────────────────────────

/**
 * E-Verify and H-1B chips under the company name on every job card, from our
 * USCIS copies (app/api/extension/companies). Names are batched as cards
 * appear and remembered for the page, so scrolling asks only for new ones.
 */
class CardFacts {
  static cache = new Map();   // company -> { ev, h1b } | 'pending'
  static started = false;

  static start(banner) {
    CardFacts.auth = banner;
    if (CardFacts.started) return;
    CardFacts.started = true;
    CardFacts._injectStyles();
    let timer = null;
    const run = () => { timer = null; CardFacts.pass(); };
    new MutationObserver(() => { if (!timer) timer = setTimeout(run, 500); }).observe(document.body, { childList: true, subtree: true });
    CardFacts.pass();
  }

  /** The job id a link points at: ?currentJobId=<id> or /jobs/view/<id>. */
  static jobIdOf(a) {
    try {
      const u = new URL(a.href, location.href);
      const v = u.pathname.match(/\/jobs\/view\/(\d+)/);
      return v ? v[1] : (u.searchParams.get('currentJobId') || null);
    } catch { return null; }
  }

  /**
   * Each list card: the element, its job id, and the company named on it.
   * A card is the largest box around one job's link holding no other job's
   * link, and is never the open job's panel (the one with Apply).
   */
  static cards() {
    const apply = prcFindApplyControl();
    const pane = apply ? prcJobPane(apply) : null;
    const seen = new Set(), out = [];
    for (const a of document.querySelectorAll('a[href*="currentJobId="], a[href*="/jobs/view/"]')) {
      if (a.closest('#preciprocal-inline-banner, #prc-sidebar, .prc-card-facts')) continue;
      if (pane && pane.contains(a)) continue;
      const id = CardFacts.jobIdOf(a);
      if (!id) continue;
      const card = a.closest('[data-occludable-job-id], [data-job-id]') || CardFacts.cardRoot(a, id);
      if (!card || seen.has(card)) continue;
      if (pane && card.contains(pane)) continue;
      const r = card.getBoundingClientRect();
      if (r.height > 420 || r.width > 760) continue;   // a whole column, not a card
      seen.add(card);
      const company = CardFacts.companyOf(card, a);
      if (company) out.push({ card, id, company });
    }
    return out;
  }

  static cardRoot(a, id) {
    let el = a, best = null;
    for (let i = 0; el && el !== document.body && i < 10; i++, el = el.parentElement) {
      const ids = new Set([...el.querySelectorAll('a[href*="currentJobId="], a[href*="/jobs/view/"]')].map(x => CardFacts.jobIdOf(x)).filter(Boolean));
      if (ids.size > 1 || (ids.size === 1 && !ids.has(id))) break;
      best = el;
    }
    return best && best !== a ? best : null;
  }

  /** The line after the title, which LinkedIn's cards use for the employer. */
  static companyOf(card, link) {
    const known = card.querySelector('.artdeco-entity-lockup__subtitle, .job-card-container__primary-description, [class*="company-name"]');
    if (known?.innerText?.trim()) return known.innerText.trim().split('\n')[0].trim();
    const title = (link.innerText || '').split('\n')[0].trim();
    if (!title) return '';
    const lines = (card.innerText || '').split('\n').map(l => l.trim()).filter(Boolean);
    const i = lines.findIndex(l => l === title || l.startsWith(title));
    if (i < 0) return '';
    for (let j = i + 1; j < Math.min(lines.length, i + 4); j++) {
      const l = lines[j];
      if (l === title || l.startsWith(title) || /verification|^promoted|^viewed|^applied|^saved|^be an early|alumni|connection|benefit|\$|·/i.test(l) || l.length > 70) continue;
      return l;
    }
    return '';
  }

  static async pass() {
    const list = CardFacts.cards();
    const ask = [...new Set(list.map(c => c.company))].filter(n => !CardFacts.cache.has(n)).slice(0, 30);
    if (ask.length) {
      ask.forEach(n => CardFacts.cache.set(n, 'pending'));
      const a = CardFacts.auth;
      try {
        const resp = await chrome.runtime.sendMessage({ type: 'API_FETCH_COMPANIES', token: a.authToken, userId: a.authUserId || '', email: a.authEmail || '', baseUrl: PRECIPROCAL_URL, payload: { companies: ask } });
        const d = resp?.success && resp.data?.success ? resp.data : null;
        for (const n of ask) CardFacts.cache.set(n, d ? { ev: d.everify ? (d.everify[n] ?? 'not-found') : undefined, h1b: d.h1b ? d.h1b[n] : undefined } : null);
      } catch { ask.forEach(n => CardFacts.cache.delete(n)); }
    }
    const live = CardFacts.cards();
    const keep = new Set(live.map(c => c.card));
    document.querySelectorAll('.prc-card-facts').forEach(r => { const c = r.closest('[data-prc-card]'); if (!c || !keep.has(c)) r.remove(); });
    for (const { card, id, company } of live) CardFacts.paint(card, id, company);
  }

  static paint(card, id, company) {
    const f = CardFacts.cache.get(company);
    if (!f || f === 'pending') return;
    const key = id + '|' + company + '|' + JSON.stringify(f);
    card.setAttribute('data-prc-card', id);
    const mine = card.querySelectorAll('.prc-card-facts');
    if (mine.length === 1 && mine[0].dataset.key === key) return;
    mine.forEach(r => r.remove());
    const chips = [];
    const ev = { enrolled: ['good', 'E-Verified', 'Enrolled in E-Verify (needed for a STEM OPT extension)'], ending: ['warn', 'E-Verify ending', 'Its E-Verify enrolment is set to end'], ended: ['bad', 'E-Verify ended', 'Its E-Verify enrolment has ended'], 'not-found': ['muted', 'No E-Verify', 'Not found in the E-Verify list. It may be listed under another name'] }[f.ev];
    if (ev) chips.push([ev[0], ev[1], ev[2] + '. From the USCIS E-Verify list, via Preciprocal.']);
    if (f.h1b && f.h1b.approvals > 0) chips.push(['good', `H-1B ${f.h1b.approvals}`, `${f.h1b.approvals} H-1B approvals in ${f.h1b.year}. From USCIS data, via Preciprocal.`]);
    else if (f.h1b === null) chips.push(['muted', 'No H-1B record', 'No match in the USCIS H-1B data. It may be listed under another name.']);
    if (!chips.length) return;
    const row = document.createElement('div');
    row.className = 'prc-card-facts';
    row.dataset.key = key;
    for (const [tone, text, tip] of chips) {
      const c = document.createElement('span');
      c.className = `prc-cf prc-cf-${tone}`;
      c.title = tip;
      c.textContent = text;
      row.appendChild(c);
    }
    // Right under the company line, always inside the card.
    const line = [...card.querySelectorAll('div, span, p')].find(el => el.childElementCount === 0 && (el.innerText || '').trim() === company);
    let at = line;
    while (at && at.parentElement && at.parentElement !== card && (at.parentElement.innerText || '').trim() === company) at = at.parentElement;
    if (at && at !== card && card.contains(at)) at.insertAdjacentElement('afterend', row); else card.appendChild(row);
  }

  static _injectStyles() {
    if (document.getElementById('prc-card-facts-styles')) return;
    const s = document.createElement('style');
    s.id = 'prc-card-facts-styles';
    // Mid tones that read on LinkedIn's light and dark themes alike.
    s.textContent = `
      .prc-card-facts { display:flex !important; flex-wrap:wrap !important; gap:4px !important; margin:4px 0 2px !important; font-family:PrcInter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important; }
      .prc-cf { display:inline-flex !important; align-items:center !important; gap:4px !important; height:18px !important; padding:0 6px !important; border-radius:999px !important; font-size:11px !important; font-weight:600 !important; line-height:1 !important; cursor:help !important; border:1px solid !important; }
      .prc-cf::before { content:'' !important; width:5px !important; height:5px !important; border-radius:999px !important; background:currentColor !important; }
      .prc-cf-good { color:#22a35a !important; border-color:rgba(34,163,90,0.4) !important; background:rgba(34,163,90,0.08) !important; }
      .prc-cf-warn { color:#d97706 !important; border-color:rgba(217,119,6,0.4) !important; background:rgba(217,119,6,0.08) !important; }
      .prc-cf-bad { color:#dc2626 !important; border-color:rgba(220,38,38,0.4) !important; background:rgba(220,38,38,0.08) !important; }
      .prc-cf-muted { color:#8a8f98 !important; border-color:rgba(138,143,152,0.35) !important; background:transparent !important; }
    `;
    document.head.appendChild(s);
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
      const pane = prcJobPane(prcFindApplyControl());
      const jobTitle = titleEl?.textContent?.trim() || (pane ? prcPaneTitle(pane) : '') || 'Unknown Position';
      let companyName = 'Unknown Company';
      for (const sel of ['a.job-details-jobs-unified-top-card__company-name','.jobs-unified-top-card__company-name a','.jobs-unified-top-card__company-name','.job-details-jobs-unified-top-card__company-name','a[data-tracking-control-name="public_jobs_topcard-org-name"]','.topcard__org-name-link','.jobs-company__name']) {
        const el = document.querySelector(sel); if (el?.textContent?.trim()) { companyName = el.textContent.trim(); break; }
      }
      if (companyName === 'Unknown Company' && pane) companyName = prcPaneCompany(pane) || companyName;
      let location = '';
      for (const sel of ['.job-details-jobs-unified-top-card__bullet','.jobs-unified-top-card__bullet','.job-details-jobs-unified-top-card__primary-description','span.jobs-unified-top-card__subtitle-primary-grouping span:last-child','.topcard__flavor--bullet']) {
        const el = document.querySelector(sel); if (el?.textContent?.trim()) { location = el.textContent.trim(); break; }
      }
      const descEl = document.querySelector('.jobs-description__content, .jobs-box__html-content, article.jobs-description');
      let description = descEl?.textContent?.trim() || '';
      // Current layout: the section under an "About the job" heading.
      if (!description) {
        const el = document.querySelector('#job-details, [class*="jobs-description"], [data-testid*="description"], [class*="description__text"]');
        if ((el?.innerText || '').trim().length > 200) description = el.innerText.trim();
      }
      if (!description) {
        const h = [...document.querySelectorAll('h2, h3')].find(x => /^about the (job|role)\b/i.test((x.innerText || '').trim()));
        let box = h?.parentElement;
        for (let i = 0; box && i < 4 && (box.innerText || '').length < 200; i++) box = box.parentElement;
        description = (box?.innerText || '').replace(/^\s*about the job\s*/i, '').trim();
      }
      const posting = this.extractPostingMeta();
      return { title: jobTitle, company: companyName, location, description, url: window.location.href, jobId: this.extractJobId(), ...posting };
    } catch (err) { console.error('[PRC] extractJobData error:', err); return null; }
  }

  // The posting's age, applicant count and whether it is still open, as the raw
  // text LinkedIn prints. The server parses it (lib/jobs/posting-signals.ts), so
  // a LinkedIn rewording is fixed there for everyone without a store release.
  extractPostingMeta() {
    const out = { postedText: '', applicantsText: '', closed: false };
    try {
      const line = document.querySelector(
        '.job-details-jobs-unified-top-card__tertiary-description-container, .job-details-jobs-unified-top-card__primary-description-container, .jobs-unified-top-card__subtitle-primary-grouping, .topcard__flavor-row'
      );
      const segments = (line?.innerText || line?.textContent || '').split(/[·•\n]/).map(s => s.trim()).filter(Boolean);
      out.postedText = segments.find(s => /\bago\b|re-?posted|\bposted\b|just now|today|yesterday/i.test(s)) || '';
      out.applicantsText = segments.find(s => /applicant|clicked apply|candidates?/i.test(s)) || '';
      if (!out.postedText) {
        const t = document.querySelector('[class*="posted-time-ago"], .posted-time-ago__text');
        if (t?.textContent) out.postedText = t.textContent.trim();
      }
      const card = document.querySelector('.jobs-details__main-content, .job-details-jobs-unified-top-card__container--two-pane, .jobs-unified-top-card') || document.body;
      out.closed = /no longer accepting applications/i.test(card.innerText || card.textContent || '');
    } catch {}
    return out;
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
  constructor(profile, onStatus, jobData) { this.profile = profile; this.onStatus = onStatus; this.jobData = jobData || null; this.maxSteps = 20; this.stepCount = 0; this.modalEl = null; }

  async start() {
    this.onStatus('Opening Easy Apply…', 'filling');
    this.modalEl = findEasyApplyDialog();
    if (!this.modalEl) {
      const applyBtn = this._findApplyButton();
      if (!applyBtn) return false;
      applyBtn.click();
      try { this.modalEl = await this._waitForModal(); } catch { return false; }
    }
    this.onStatus('Filling in your details…', 'filling');
    this._injectModalBanner();
    await this._processAllSteps();
    return true;
  }

  _findApplyButton() {
    const isEasy = (el) => /easy apply/i.test(`${el.innerText || el.textContent || ''} ${el.getAttribute('aria-label') || ''}`);
    for (const sel of ['button.jobs-apply-button[aria-label*="Easy Apply"]','button[data-control-name="jobdetails_topcard_inapply"]','.jobs-apply-button--top-card','button.jobs-apply-button']) {
      const btn = document.querySelector(sel); if (btn && isEasy(btn)) return btn;
    }
    // LinkedIn's current job panel: the control can be a link, and the class
    // names above are gone. prcFindApplyControl finds the visible one.
    const found = prcFindApplyControl(); if (found && isEasy(found)) return found;
    return Array.from(document.querySelectorAll('button, a')).find(el =>
      !el.closest('#preciprocal-inline-banner, #prc-sidebar') && el.getClientRects().length && isEasy(el)) || null;
  }

  _waitForModal(timeout = 8000) {
    return new Promise((resolve, reject) => {
      const check = () => findEasyApplyDialog();
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
    const _logoUrl = chrome.runtime.getURL('icons/icon16.png');
    banner.innerHTML = `<img src="${_logoUrl}" class="pr-modal-logo" alt=""><span id="prc-apply-msg">Filling in your details…</span><div class="pr-spinner"></div><button class="pr-dismiss" id="prc-apply-dismiss" title="Stop auto-fill">✕</button>`;
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

  _attachUserTypingGuard(modal) {
    if (modal._prTypingGuard) return;
    modal._prTypingGuard = true;
    this._lastUserInput = 0;
    const handler = () => { this._lastUserInput = Date.now(); };
    modal.addEventListener('input', handler, true);
    modal.addEventListener('keydown', handler, true);
  }

  async _waitForUserToFinishTyping() {
    if (!this._lastUserInput) return;
    while (Date.now() - this._lastUserInput < 3000) {
      await this._delay(300);
    }
  }

  async _processAllSteps() {
    const S = window.PreciprocalSensitive;
    S?.reset();
    while (this.stepCount < this.maxSteps) {
      this.stepCount++; await this._delay(600);
      const modal = this._getModal(); if (!modal) break;
      this._attachUserTypingGuard(modal);
      await this._waitForUserToFinishTyping();
      const flaggedBefore = S ? S.pendingList().length : 0;
      await this._fillCurrentStep(modal); await this._delay(400);
      // A question we will not answer for them is on this step. Stop here
      // rather than clicking Next past it, so they see it and answer it.
      if (S && S.pendingList().length > flaggedBefore) {
        this._updateBanner('Answer the outlined question, then click Next', 'ready');
        this.onStatus('Some questions need your own answer. They are outlined in amber.', 'success');
        S.showSummary();
        break;
      }
      const action = this._detectNextAction(modal);
      if (action === 'none') break;
      if (action === 'submit') { this._updateBanner('All done - review, then click Submit yourself', 'ready'); this.onStatus('Filled from your profile. Review everything, then click Submit.', 'success'); S?.showSummary(); break; }
      if (action === 'review') { this._updateBanner('📋 Auto-clicking Review…', 'filling'); const rb = this._findButton(modal, ['review']); if (rb) { rb.click(); await this._delay(1200); continue; } this._updateBanner('📋 Review your application then submit', 'ready'); this.onStatus('Please review and submit your application.', 'success'); break; }
      const nb = this._findButton(modal, ['next', 'continue']); if (nb) { this._updateBanner(`Step ${this.stepCount} - moving to next…`, 'filling'); nb.click(); await this._delay(900); } else break;
    }
  }

  _getModal() { return findEasyApplyDialog(); }
  _findButton(modal, kw) { return Array.from(modal.querySelectorAll('button')).find(b => kw.some(k => b.textContent?.trim().toLowerCase().includes(k))) || null; }

  async _fillCurrentStep(modal) {
    const p = this.profile;
    for (const el of modal.querySelectorAll('input:not([type="file"]):not([type="hidden"]):not([type="radio"]):not([type="checkbox"])')) await this._fillInput(el, p);
    for (const el of modal.querySelectorAll('select')) await this._fillSelect(el, p);
    for (const el of modal.querySelectorAll('textarea')) await this._fillTextarea(el, p);
    await this._fillRadioGroups(modal, p);
    await this._fillCheckboxGroups(modal, p);
    // Retry selects once after a short delay — React may need a tick to register the first pass
    await this._delay(300);
    for (const el of modal.querySelectorAll('select')) await this._fillSelect(el, p);
  }

  _rangeToSingleNumber(v) { if (!v) return ''; const s = String(v).trim(); const r = s.match(/^(\d+)\s*[-–]\s*\d+/); if (r) return r[1]; const p2 = s.match(/^(\d+)\s*\+/); if (p2) return p2[1]; const n = s.match(/^(\d+)/); return n ? n[1] : s; }

  async _fillInput(input, p) {
    if (input.disabled || input.readOnly || (input.value && input.value.trim())) return;
    if (document.activeElement === input) return;
    const hint = `${this._getLabel(input)} ${input.id || ''} ${input.name || ''}`.toLowerCase();
    let val = this._matchProfileField(hint, p); if (!val && val !== 0) return; val = String(val);
    if (input.type === 'number' || input.getAttribute('inputmode') === 'numeric') val = this._rangeToSingleNumber(val);
    if (/year/i.test(hint) && val.includes('-')) val = this._rangeToSingleNumber(val);
    this._setNativeValue(input, val); await this._delay(50);
  }

  _selectIsEmpty(select) {
    if (select.disabled) return false;
    // Always check visible text first — React can revert the DOM value while keeping select.value set
    const selText = (select.options[select.selectedIndex]?.text || '').toLowerCase().trim();
    if (/^select\b|^choose\b|^please select|^--|\bselect an option\b|\bselect one\b|^none$/.test(selText)) return true;
    if (!select.value || select.value === '' || select.value === '0' || select.value === '-1' || select.value === 'null' || select.value === 'undefined') return true;
    return false;
  }

  async _fillSelect(select, p) {
    if (!this._selectIsEmpty(select)) return;
    const hint = `${this._getLabel(select)} ${select.id || ''} ${select.name || ''}`.toLowerCase();
    // Demographic, authorization and legal questions: only the user's saved
    // answer, otherwise left blank and flagged (extension/sensitive-answers.js).
    const S = window.PreciprocalSensitive;
    const sk = S?.kindOf(hint);
    if (sk) { const a = S.answer(p, sk); if (a) this._selectByText(select, a); else S.flag(select, hint, sk); return; }
    if (/relocat/i.test(hint)) { this._selectByText(select, p.willingToRelocate ? 'Yes' : 'No'); return; }
    if (/country/i.test(hint)) {
      // Only fill when we actually know the candidate's country - guessing
      // "United States" silently mis-locates every non-US applicant.
      if (p.country) this._selectByText(select, p.country);
      return;
    }
    if (/\bstate\b|current.*state|state.*address/i.test(hint)) { if (p.state) this._selectByText(select, p.state); return; }
    if (/province/i.test(hint)) { if (p.state) this._selectByText(select, p.state); return; }
    if (/year.*exp|exp.*year/i.test(hint)) { this._selectClosestNumber(select, p.yearsOfExperience || ''); return; }
    if (/notice|start/i.test(hint)) { this._selectByText(select, p.noticePeriod || '2 weeks'); return; }
    if (/currently employ/i.test(hint)) { this._selectByText(select, p.currentlyEmployed ? 'Yes' : 'No'); return; }
    if (/have you ever worked|previously worked|worked (at|for|with)|previous.*employ|former.*employ/i.test(hint)) { this._selectByText(select, 'No'); return; }
    if (/do you currently work for|currently work (at|for)|work.*currently/i.test(hint)) { this._selectByText(select, p.currentlyEmployed ? 'Yes' : 'No'); return; }
    if (/family member|relative.*work|employee.*family/i.test(hint)) { this._selectByText(select, 'No'); return; }
    if (/consent.*text|consent.*call|consent.*email|contact.*consent/i.test(hint)) { this._selectByText(select, 'Yes'); return; }
    if (/schedule.*work|available.*schedule|this schedule/i.test(hint)) { this._selectByText(select, 'Yes'); return; }
    if (/employ.*type|job.*type|position.*type|full.?time|part.?time/i.test(hint)) { this._selectByText(select, p.employmentType || 'Full-time'); return; }
    if (/work.*arrang|remote|hybrid|on.?site/i.test(hint)) { this._selectByText(select, p.workType || 'Remote'); return; }
    if (/salary|compensation|pay/i.test(hint)) { if (p.desiredSalary) this._selectClosestNumber(select, p.desiredSalary); return; }
    if (/how.*hear|referr|source/i.test(hint)) { this._selectByText(select, p.howDidYouHear || 'LinkedIn'); return; }
  }

  async _fillTextarea(textarea, p) {
    if (textarea.disabled || textarea.readOnly || textarea.value?.trim().length > 10) return;
    if (document.activeElement === textarea) return;
    const hint = `${this._getLabel(textarea)} ${textarea.id || ''}`.toLowerCase();
    if (/cover.?letter|covering/i.test(hint)) return;
    if (/interest.*joining|interest.*working|interest.*role|interest.*position|why.*apply|why.*want.*work|what.*excit|what.*draw|what.*attract|motivat.*apply|passion.*role/i.test(hint)) {
      const val = this._matchProfileField(hint, p); if (val) this._setNativeValue(textarea, val); return;
    }
    if (/summary|about|additional|message|note/i.test(hint)) this._setNativeValue(textarea, p.summary || '');
    if (/linkedin/i.test(hint)) this._setNativeValue(textarea, p.linkedInUrl || '');
    if (/github/i.test(hint)) this._setNativeValue(textarea, p.githubUrl || '');
    if (/website|portfolio/i.test(hint)) this._setNativeValue(textarea, p.portfolioUrl || '');
    if (/skill/i.test(hint) && p.skills?.length) this._setNativeValue(textarea, p.skills.join(', '));
  }

  async _fillRadioGroups(modal, p) {
    for (const group of modal.querySelectorAll('[role="radiogroup"], fieldset')) {
      const legendEl = group.querySelector('legend, [id*="label"], [class*="legend"], [class*="question"]');
      const legend = (legendEl?.textContent || group.getAttribute('aria-labelledby') && document.getElementById(group.getAttribute('aria-labelledby'))?.textContent || '').toLowerCase();
      if (!legend) continue;
      let answer = null;
      if (/sponsor/i.test(legend)) answer = p.requireSponsorship ? 'yes' : 'no';
      if (/relocat/i.test(legend)) answer = p.willingToRelocate ? 'yes' : 'no';
      if (/legally.*work|authorized.*work|work.*authoriz|eligible.*work/i.test(legend)) answer = p.workAuthorization || 'yes';
      if (/currently employ/i.test(legend)) answer = p.currentlyEmployed ? 'yes' : 'no';
      if (/schedule.*work.*for you|this schedule work|available.*schedule|agree.*schedule/i.test(legend)) answer = 'yes';
      if (/driver.?s?\s*licen[sc]e/i.test(legend)) answer = p.driverLicense ? 'yes' : 'no';
      if (/background\s*check/i.test(legend)) answer = p.backgroundCheck ? 'yes' : 'no';
      if (/drug\s*test/i.test(legend)) answer = p.drugTest ? 'yes' : 'no';
      if (/criminal\s*record|felony|conviction/i.test(legend)) answer = p.criminalRecord ? 'yes' : 'no';
      if (/18\s*years?\s*(of age|or older|and over)|at least\s*18|must be\s*18/i.test(legend)) answer = p.over18 ? 'yes' : 'no';
      // Sensitive questions override every rule above: the saved answer or nothing.
      const S = window.PreciprocalSensitive;
      const sk = S?.kindOf(legend);
      if (sk) {
        const a = S.answer(p, sk);
        if (!a) { S.flag(group, legend, sk); continue; }
        answer = a;
      }
      if (!answer) continue;
      const radios = Array.from(group.querySelectorAll('input[type="radio"]'));
      const target = answer.toLowerCase();
      const isYesNo = target === 'yes' || target === 'no';
      const match = (isYesNo ? radios.find(r => {
        const lab = (this._getLabel(r) + ' ' + r.value).toLowerCase();
        return target === 'yes' ? /\byes\b/.test(lab) : /\bno\b/.test(lab);
      }) : null) || radios.find(r => (this._getLabel(r) + ' ' + r.value).toLowerCase().includes(target));
      if (match && !match.checked) { match.click(); await this._delay(100); }
    }
  }

  _extractJDSkills(description) {
    if (!description) return [];
    const SKILL_TERMS = [
      'python','javascript','typescript','react','node','java','go','rust','c++','c#','scala','kotlin','swift',
      'sql','nosql','postgresql','mysql','mongodb','redis','elasticsearch','kafka','spark','hadoop',
      'aws','gcp','azure','kubernetes','docker','terraform','ci/cd','devops','mlops',
      'machine learning','deep learning','llm','nlp','computer vision','data science','analytics',
      'product management','product strategy','roadmap','agile','scrum','okr','kpi',
      'growth','marketing','seo','a/b testing','user research','ux','design systems',
      'sales','crm','salesforce','b2b','saas','api','microservices','distributed systems',
      'security','compliance','fintech','healthtech','edtech','ecommerce',
      'leadership','cross-functional','stakeholder','communication','strategy',
    ];
    const desc = description.toLowerCase();
    const found = SKILL_TERMS.filter(skill => desc.includes(skill));
    // Deduplicate and return top 4
    return [...new Set(found)].slice(0, 4);
  }

  _buildInterestAnswer(p) {
    const jd = this.jobData;
    const roleTitle = jd?.title || p.headline || 'this role';
    const company = jd?.company || 'your team';
    const jdSkills = this._extractJDSkills(jd?.description || '');

    // Intersect JD skills with user's profile skills for the most relevant match
    const userSkillsRaw = Array.isArray(p.skills)
      ? p.skills.map(s => s.toLowerCase())
      : (p.skills || '').split(',').map(s => s.trim().toLowerCase());

    // Only skills the user actually listed. Naming a skill that appears only in
    // the job description would claim experience they may not have.
    const matchedSkills = jdSkills.filter(s => userSkillsRaw.some(us => us && (us.includes(s) || s.includes(us))));
    const highlightSkills = matchedSkills.length ? matchedSkills : userSkillsRaw.filter(Boolean).slice(0, 3);
    const skillsStr = highlightSkills.slice(0, 3).join(', ');

    const exp = p.experience?.[0];
    const backgroundStr = exp
      ? `my experience as a ${exp.title} at ${exp.company}`
      : `my background in ${p.headline || 'software engineering'}`;

    // Plain and true: what the user has done, in their own profile's terms.
    // A draft for them to edit, never a claim the profile does not support.
    const background = backgroundStr.charAt(0).toUpperCase() + backgroundStr.slice(1);
    return `I am interested in the ${roleTitle} role at ${company}. `
      + (skillsStr ? `${background} has given me hands-on experience with ${skillsStr}, which is close to the work this team does. ` : `${background} is a good fit for the work this team does. `)
      + `I would welcome the chance to talk about how I could help.`;
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
    if (/salary|compensation/i.test(hint)) return p.desiredSalary;
    if (/most.?recent.*employer|current.*employer|previous.*employer|last.*employer|\bemployer\b/i.test(hint)) { const exp = p.experience?.[0]; return exp?.company || ''; }
    if (/most.?recent.*title|current.*(?:job|position|role).*title|previous.*title|\bjob\s*title\b/i.test(hint)) { const exp = p.experience?.[0]; return exp?.title || p.headline || ''; }
    if (/title|headline/i.test(hint)) return p.headline;
    if (/notice|start date/i.test(hint)) return p.noticePeriod;
    if (/interest.*joining|interest.*working|interest.*role|interest.*position|why.*apply|why.*want.*work|what.*excit|what.*draw|what.*attract|motivat.*apply|passion.*role/i.test(hint)) {
      return this._buildInterestAnswer(p);
    }
    return null;
  }

  async _fillCheckboxGroups(modal, p) {
    for (const group of modal.querySelectorAll('[role="group"], fieldset')) {
      const legendEl = group.querySelector('legend, [id*="label"], [class*="legend"], [class*="question"]');
      const legend = (legendEl?.textContent || '').toLowerCase();
      if (!/office|location|work.*location|site|which.*office/i.test(legend)) continue;
      const boxes = Array.from(group.querySelectorAll('input[type="checkbox"]'));
      if (!boxes.length) continue;
      for (const cb of boxes) {
        if (!cb.checked) { cb.click(); await this._delay(80); }
      }
    }
  }

  _nearestLocation(userLocs, labels) {
    const regions = [
      ['san francisco','oakland','san jose','palo alto','menlo park','mountain view','sunnyvale','santa clara','redwood city','fremont'],
      ['new york','brooklyn','queens','bronx','manhattan','jersey city','newark','hoboken','yonkers'],
      ['los angeles','santa monica','culver city','burbank','glendale','long beach','pasadena','torrance','el segundo'],
      ['seattle','bellevue','redmond','kirkland','tacoma','renton','bothell'],
      ['boston','cambridge','somerville','waltham','newton','quincy','medford','malden','brookline'],
      ['chicago','evanston','oak park','naperville','aurora','joliet','schaumburg'],
      ['austin','round rock','cedar park','pflugerville','georgetown'],
      ['denver','boulder','aurora','lakewood','arvada','westminster','thornton','englewood'],
      ['washington','arlington','alexandria','bethesda','silver spring','reston','herndon','tysons'],
      ['atlanta','decatur','sandy springs','marietta','alpharetta','smyrna','dunwoody'],
      ['miami','fort lauderdale','boca raton','coral gables','hialeah','hollywood'],
      ['dallas','fort worth','plano','irving','garland','frisco','mckinney','arlington'],
      ['houston','sugar land','the woodlands','katy','pearland','pasadena'],
      ['phoenix','scottsdale','tempe','mesa','chandler','gilbert','glendale'],
      ['minneapolis','saint paul','bloomington','eden prairie','plymouth','maple grove'],
      ['philadelphia','camden','cherry hill','wilmington','king of prussia'],
      ['san diego','chula vista','el cajon','la mesa','santee','escondido'],
      ['portland','beaverton','hillsboro','gresham','lake oswego','vancouver'],
      ['raleigh','durham','chapel hill','cary','morrisville','apex'],
      ['salt lake city','provo','orem','west valley','sandy','ogden'],
      ['charlotte','concord','gastonia','huntersville','matthews'],
      ['nashville','murfreesboro','franklin','brentwood','hendersonville'],
      ['las vegas','henderson','north las vegas','paradise'],
    ];
    for (const ul of userLocs) {
      const region = regions.find(r => r.some(c => ul.includes(c) || c.includes(ul)));
      if (region) {
        for (let i = 0; i < labels.length; i++) {
          const lab = labels[i].toLowerCase();
          if (region.some(c => lab.includes(c))) return i;
        }
      }
    }
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
    let proto;
    if (el.tagName === 'TEXTAREA') proto = window.HTMLTextAreaElement.prototype;
    else if (el.tagName === 'SELECT') proto = window.HTMLSelectElement.prototype;
    else proto = window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
    if (setter) setter.call(el, value); else el.value = value;
    el.dispatchEvent(new Event('input',  { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    el.dispatchEvent(new Event('blur',   { bubbles: true }));
    // Trigger React fiber onChange directly for controlled components
    try {
      const fk = Object.keys(el).find(k => /^__reactFiber|^__reactInternalInstance/.test(k));
      if (fk) {
        let fib = el[fk];
        while (fib) {
          const props = fib.memoizedProps || fib.pendingProps;
          if (props?.onChange && typeof props.onChange === 'function') {
            props.onChange({ target: el, currentTarget: el, type: 'change', bubbles: true });
            break;
          }
          fib = fib.return;
        }
      }
    } catch {}
  }

  _selectByText(select, text) {
    if (!text) return;
    const lower = text.toLowerCase().trim();
    const STATE_MAP = { 'al':'alabama','ak':'alaska','az':'arizona','ar':'arkansas','ca':'california','co':'colorado','ct':'connecticut','de':'delaware','fl':'florida','ga':'georgia','hi':'hawaii','id':'idaho','il':'illinois','in':'indiana','ia':'iowa','ks':'kansas','ky':'kentucky','la':'louisiana','me':'maine','md':'maryland','ma':'massachusetts','mi':'michigan','mn':'minnesota','ms':'mississippi','mo':'missouri','mt':'montana','ne':'nebraska','nv':'nevada','nh':'new hampshire','nj':'new jersey','nm':'new mexico','ny':'new york','nc':'north carolina','nd':'north dakota','oh':'ohio','ok':'oklahoma','or':'oregon','pa':'pennsylvania','ri':'rhode island','sc':'south carolina','sd':'south dakota','tn':'tennessee','tx':'texas','ut':'utah','vt':'vermont','va':'virginia','wa':'washington','wv':'west virginia','wi':'wisconsin','wy':'wyoming','dc':'district of columbia' };
    const expanded = STATE_MAP[lower] || lower;
    const opts = Array.from(select.options).filter(o => o.value && o.value !== '' && o.value !== '0');
    const match =
      opts.find(o => o.text.toLowerCase() === expanded) ||
      opts.find(o => o.text.toLowerCase() === lower) ||
      opts.find(o => o.text.toLowerCase().includes(expanded)) ||
      opts.find(o => o.text.toLowerCase().includes(lower)) ||
      opts.find(o => lower.includes(o.text.toLowerCase()) && o.text.length > 2);
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

// LinkedIn's 2026 job page uses generated class names, so the selectors
// above find nothing there. These read the page by what it shows instead:
// the visible Apply / Easy Apply control, the section holding it and the
// title, and the company link in that section.
// The open Easy Apply dialog, on LinkedIn's old and current layouts. The old
// one had stable class names; the current one is a generic role="dialog", so
// fall back to any visible dialog that holds form fields and an
// apply-shaped heading or a Next / Review / Submit button.
function findEasyApplyDialog() {
  for (const s of ['[data-test-modal-id="easy-apply-modal"]', '.jobs-easy-apply-modal', '[aria-labelledby*="easy-apply"]', '.jobs-easy-apply-content']) {
    const el = document.querySelector(s); if (el) return el.closest('[role="dialog"]') || el;
  }
  for (const d of document.querySelectorAll('[role="dialog"], dialog[open], .artdeco-modal')) {
    if (d.closest('#preciprocal-inline-banner, #prc-sidebar, #prc-apply-confirm-modal')) continue;
    if (!d.getClientRects().length) continue;
    const text = (d.innerText || '').toLowerCase();
    const hasFields = !!d.querySelector('input:not([type="hidden"]), select, textarea');
    const applyish = /apply to|easy apply|contact info|submit application|review your application/.test(text) ||
      Array.from(d.querySelectorAll('button')).some(b => /^(next|review|submit application|continue to next step)$/i.test((b.innerText || '').trim()));
    if (hasFields && applyish) return d;
  }
  return null;
}

function prcFindApplyControl() {
  for (const el of document.querySelectorAll('button, a')) {
    if (el.closest('#preciprocal-inline-banner, #prc-sidebar')) continue;
    if (!el.getClientRects().length) continue;
    const t = (el.innerText || '').replace(/\s+/g, ' ').trim().toLowerCase();
    const a = (el.getAttribute('aria-label') || '').toLowerCase();
    if (/^(easy apply|apply|apply now)$/.test(t) || /^(easy apply to|apply to|apply on|apply for)\b/.test(a)) return el;
  }
  return null;
}
function prcJobPane(from) {
  let el = from;
  for (let i = 0; el && i < 14; i++, el = el.parentElement) {
    const h = el.querySelector('h1, h2');
    if (h && (h.innerText || '').trim().length > 4) return el;
  }
  return null;
}
function prcPaneTitle(pane) {
  const h = pane?.querySelector('h1') || pane?.querySelector('h2');
  return (h?.innerText || '').replace(/\s+/g, ' ').trim();
}
function prcPaneCompany(pane) {
  for (const a of pane?.querySelectorAll('a[href*="/company/"]') || []) {
    const t = (a.innerText || '').trim();
    if (t && t.length < 100) return t;
  }
  return '';
}
/** Where the banner goes: under the row holding Apply and Save. */
function prcInsertionAfterApply() {
  const apply = prcFindApplyControl();
  if (!apply) return null;
  const pane = prcJobPane(apply) || document.body;
  const save = [...pane.querySelectorAll('button')].find(b => /^(save|saved)$/i.test((b.innerText || '').trim()) && !b.closest('#preciprocal-inline-banner'));
  let row = apply.parentElement;
  if (save) { row = apply; while (row && !row.contains(save)) row = row.parentElement; }
  if (!row || row === pane) row = apply.parentElement;
  return row ? { element: row, position: 'afterend' } : null;
}

function getApplyButtonInfo() {
  for (const sel of ['button.jobs-apply-button[aria-label*="Easy Apply"]','button.jobs-apply-button']) { const btn = document.querySelector(sel); if (btn && btn.textContent?.toLowerCase().includes('easy apply')) return { type: 'easy', button: btn }; }
  const ext = document.querySelector('button.jobs-apply-button, a.jobs-apply-button, [data-control-name="jobdetails_topcard_inapply"]');
  if (ext) { const link = document.querySelector('a[href*="apply"], a[data-tracking-control-name*="apply"], .jobs-apply-button a'); return { type: 'external', button: ext, url: link?.href || null }; }
  const found = prcFindApplyControl();
  if (found) {
    const t = ((found.innerText || '') + ' ' + (found.getAttribute('aria-label') || '')).toLowerCase();
    if (t.includes('easy apply')) return { type: 'easy', button: found };
    return { type: 'external', button: found, url: found.tagName === 'A' ? found.href : null };
  }
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
      await this._checkPendingApplyConfirm();
      if (!PreciprocalBanner._confirmOnReturn) {
        PreciprocalBanner._confirmOnReturn = true;
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') this._checkPendingApplyConfirm();
        });
      }
      await this.waitForJobPanel();
      const extractor = new JobExtractor();
      this.jobData = extractor.extractJobData();
      if (!this.jobData?.title) return;
      this.currentJobId = this.jobData.jobId;
      console.log(`[PRC] Init: "${this.jobData.title}" | jobId: ${this.currentJobId}`);
      await this._delay(400);
      LabelInjector.watch();
      if (this.isAuthenticated) CardFacts.start(this);
      if (this.isAuthenticated) await this._syncTrackedJobsFromDB();
      this.appliedHere = (await LabelInjector.getLabelForJob(this.currentJobId)) === 'applied';
      this.injectBanner();
      if (this.isAuthenticated) await Promise.all([this.fetchFit(), this.prefetchApplyProfile(), this.fetchJobSignals()]);
      this.observeJobChanges();
    } catch (err) { console.error('[PRC] Banner init error:', err); }
  }

  async _checkPendingApplyConfirm() {
    try {
      const result = await chrome.storage.local.get(['preciprocal_pending_confirm_job']);
      const pending = result.preciprocal_pending_confirm_job;
      if (!pending?.jobId) return;
      await chrome.storage.local.remove(['preciprocal_pending_confirm_job']);
      await this._delay(800);
      this._showApplyConfirmModal(pending.jobId, pending.jobData);
    } catch {}
  }

  _showApplyConfirmModal(jobId, jobData) {
    const existing = document.getElementById('prc-apply-confirm-modal');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'prc-apply-confirm-modal';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.55);backdrop-filter:blur(4px);';

    const card = document.createElement('div');
    card.style.cssText = 'background:#0f172a;border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:28px 32px;max-width:400px;width:90%;box-shadow:0 24px 64px rgba(0,0,0,0.7);font-family:PrcInter, -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;';

    const title = jobData?.title ? `<strong style="color:#e2e8f0">${jobData.title}</strong>` : 'this role';
    const company = jobData?.company ? ` at <strong style="color:#e2e8f0">${jobData.company}</strong>` : '';

    card.innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:18px;">
        <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#6366f1,#8b5cf6);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="white"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        </div>
        <p style="margin:0;font-size:15px;font-weight:600;color:#f1f5f9;">Did you apply?</p>
      </div>
      <p style="margin:0 0 22px;font-size:13px;color:#94a3b8;line-height:1.5;">Did you complete your application for ${title}${company}?</p>
      <div style="display:flex;gap:10px;">
        <button id="prc-confirm-yes" style="flex:1;padding:10px;border-radius:10px;border:none;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;font-size:13px;font-weight:600;cursor:pointer;">Yes, I applied</button>
        <button id="prc-confirm-no" style="flex:1;padding:10px;border-radius:10px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:#94a3b8;font-size:13px;font-weight:600;cursor:pointer;">No, I did not</button>
      </div>
    `;

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    const close = () => overlay.remove();

    card.querySelector('#prc-confirm-yes').addEventListener('click', async () => {
      close();
      LabelInjector.inject(jobId, 'applied');
      // Also track in job tracker
      try {
        if (this.authToken && jobData) {
          await chrome.runtime.sendMessage({ type: 'API_FETCH_TRACK_JOB', token: this.authToken, userId: this.authUserId || '', email: this.authEmail || '', baseUrl: PRECIPROCAL_URL, jobData });
        }
      } catch {}
      this.showNotification('Marked as Applied and added to tracker', 'success');
    });

    card.querySelector('#prc-confirm-no').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  }

  waitForJobPanel(timeout = 10000) {
    const sels = ['.job-details-jobs-unified-top-card__container--two-pane','.jobs-unified-top-card','.jobs-details__main-content','.jobs-search__job-details--container','.job-details-jobs-unified-top-card__job-title'];
    return new Promise((resolve, reject) => {
      const find = () => { for (const s of sels) { const el = document.querySelector(s); if (el) return el; } return prcFindApplyControl(); };
      const now = find(); if (now) return resolve(now);
      const obs = new MutationObserver(() => { const el = find(); if (el) { obs.disconnect(); resolve(el); } });
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
      const resp = await chrome.runtime.sendMessage({ type: 'API_FETCH_AUTO_APPLY', token: this.authToken, userId: this.authUserId || '', email: this.authEmail || '', baseUrl: PRECIPROCAL_URL, prefetch: true });
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
      () => prcInsertionAfterApply(),
    ];
    for (const s of strats) { try { const r = s(); if (r) return r; } catch {} }
    return null;
  }

  injectBanner() {
    document.getElementById('preciprocal-inline-banner')?.remove();
    document.querySelectorAll('.prc-tooltip').forEach(el => el.remove());
    const ins = this.findBestInsertionPoint();
    if (!ins) return;
    this.banner = this.createBannerElement();
    ins.element.insertAdjacentElement(ins.position, this.banner);
    this._clearApplyRow();
    this._applyTheme();
    if (this.trackState === 'done') {
      const btn = this.banner.querySelector('[data-action="track-job"]');
      if (btn) { btn.classList.add('done'); this._replaceButtonIcon(btn, 'check'); btn.setAttribute('title', 'Already saved to your tracker'); }
    }
    this.attachEventListeners();
    this.injectStyles();
  }

  // LinkedIn's top card can be a fixed-height box, so a banner placed in it
  // spills over the Apply and Save buttons. When it lands on them, it moves
  // out one container at a time until it sits below. Checked again once the
  // fit section fills in and the banner grows.
  _clearApplyRow() {
    const fix = () => {
      if (!this.banner?.isConnected) return;
      const apply = prcFindApplyControl() || document.querySelector('.jobs-apply-button');
      if (!apply) return;
      for (let i = 0; i < 8; i++) {
        const host = this.banner.parentElement;
        if (!host || host === document.body) return;
        const a = apply.getBoundingClientRect(), b = this.banner.getBoundingClientRect(), h = host.getBoundingClientRect();
        // In a box that does not grow with it: move out of that box.
        const spills = b.bottom > h.bottom + 1 || b.top < h.top - 1;
        if (spills) { host.insertAdjacentElement('afterend', this.banner); continue; }
        // Under buttons that spill out of their own row: push down to clear them.
        const onApply = b.top < a.bottom + 4 && b.bottom > a.top && b.left < a.right && b.right > a.left;
        if (onApply) {
          const now = parseFloat(this.banner.style.marginTop) || 16;
          this.banner.style.setProperty('margin-top', `${Math.ceil(now + (a.bottom - b.top) + 12)}px`, 'important');
        }
        return;
      }
    };
    fix();
    requestAnimationFrame(fix);
    setTimeout(fix, 150);
    setTimeout(fix, 600);
    setTimeout(fix, 2000);
  }

  // Light or dark from the colour actually behind the banner (the first
  // opaque ancestor), so it matches LinkedIn's theme, whatever LinkedIn calls
  // it. Re-checked when LinkedIn switches theme.
  _applyTheme() {
    if (!this.banner) return;
    let el = this.banner.parentElement, rgb = null;
    for (; el; el = el.parentElement) {
      const m = getComputedStyle(el).backgroundColor.match(/[\d.]+/g);
      if (m && (m.length < 4 || +m[3] > 0.5)) { rgb = m.slice(0, 3).map(Number); break; }
    }
    const lum = rgb ? (0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]) : (matchMedia('(prefers-color-scheme: dark)').matches ? 0 : 255);
    this.banner.classList.toggle('prc-light', lum > 140);
    if (!this._themeWatch) {
      this._themeWatch = new MutationObserver(() => this._applyTheme());
      for (const t of [document.documentElement, document.body]) this._themeWatch.observe(t, { attributes: true, attributeFilter: ['class', 'style', 'data-theme'] });
      matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => this._applyTheme());
    }
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
            ${logoUrl ? `<img src="${logoUrl}" class="prc-logo-img" alt="">` : ''}
            <div class="prc-title-text">
              <p class="prc-brand"><span>Preciprocal</span>${this.appliedHere ? '<span class="prc-applied-pill"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>Applied</span>' : ''}</p>
              <h3 class="prc-title">${this.appliedHere ? 'You applied to this job. It is in your tracker, where you can follow it through each round.' : this.isAuthenticated ? 'Stop retyping your details. Fill this application in one click.' : 'Sign in to tailor your resume and fill in this application.'}</h3>
            </div>
          </div>
          <div class="prc-top-right">

          </div>
        </div>
        ${this.isAuthenticated ? '<div class="prc-fit-slot"><div class="prc-fit prc-fit-loading"><span class="prc-ring-skel"></span><span class="prc-skel-lines"><span></span><span></span></span></div></div>' : ''}
        <div class="prc-actions">
          <button class="prc-btn prc-apply" data-action="auto-apply" data-tip="${am.tip}">
            <span class="apply-label">${am.label}</span>
          </button>
          <button class="prc-btn prc-primary" data-action="cover-letter" data-tip="A cover letter written for this role from your resume">
            <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"/></svg>
            Cover letter
          </button>
          <button class="prc-btn prc-track prc-icon-only" data-action="track-job" data-tip="Save this job to your tracker">
            <svg class="track-icon" width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.75" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>
          </button>
        </div>
      </div>
    `;
    return c;
  }

  // After Easy Apply fills the form, wait for LinkedIn's dialog to close
  // (submitted or dismissed), then ask. Only "Yes, I applied" marks the card
  // and adds the job to the tracker, so the tracker never holds an
  // application the user did not send.
  _watchForSubmit(jobId) {
    if (this._applyWatch) this._applyWatch.disconnect();
    const jobData = this.jobData;
    let seen = !!findEasyApplyDialog();
    let timer = null;
    const obs = new MutationObserver(() => {
      if (findEasyApplyDialog()) { seen = true; clearTimeout(timer); timer = null; return; }
      if (!seen || timer) return;
      // Closed. Wait a moment: LinkedIn swaps steps by re-rendering.
      timer = setTimeout(() => {
        timer = null;
        if (findEasyApplyDialog()) return;
        obs.disconnect(); this._applyWatch = null;
        this._showApplyConfirmModal(jobId, jobData);
      }, 700);
    });
    obs.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'aria-hidden', 'open'] });
    this._applyWatch = obs;
    setTimeout(() => { obs.disconnect(); if (this._applyWatch === obs) this._applyWatch = null; }, 30 * 60 * 1000);
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
        const engine = new EasyApplyEngine(this.applyProfile, (msg, t) => { if (t === 'success') this.showNotification(msg, 'success'); if (t === 'error') this.showNotification(msg, 'error'); }, this.jobData);
        const ran = await engine.start();
        if (!ran) throw new Error('Could not open Easy Apply on this page. Click Easy Apply on LinkedIn, then press Auto Apply again.');
        try { await this._injectFilesIntoModal(); } catch {}
        this.applyState = 'done'; if (btn) { btn.classList.remove('loading'); btn.classList.add('done'); } if (labelEl) labelEl.textContent = 'Review & Submit';
        this.showNotification('Filled in. Review it on LinkedIn and submit when ready.', 'success');
        if (this.currentJobId) this._watchForSubmit(this.currentJobId);
      } else if (ai.type === 'external') {
        await chrome.storage.local.set({ preciprocal_auto_apply_profile: this.applyProfile, preciprocal_auto_apply_files: this.applyFiles || null, preciprocal_auto_apply_timestamp: Date.now(), preciprocal_auto_apply_job: this.jobData, preciprocal_pending_confirm_job: this.currentJobId ? { jobId: this.currentJobId, jobData: this.jobData } : null });
        if (ai.button) {
          if (labelEl) labelEl.textContent = 'Opening…'; ai.button.click();
          this.applyState = 'done'; if (btn) { btn.classList.remove('loading'); btn.classList.add('done'); } if (labelEl) labelEl.textContent = 'Filling…';
          this.showNotification('Opening company site - Preciprocal will auto-fill', 'success');
          // Do NOT mark applied yet — will confirm when user returns to LinkedIn
        } else throw new Error('Could not find the Apply button');
      } else throw new Error('No Apply button found');
      this._maybeShowUpsell();
    } catch (err) {
      this.applyState = 'idle'; if (btn) { btn.classList.remove('loading'); btn.classList.add('error'); } if (labelEl) labelEl.textContent = 'Retry';
      this.showNotification(err.message || 'Auto-apply failed', 'error');
      setTimeout(() => { if (btn) btn.classList.remove('error'); if (labelEl) labelEl.textContent = this._getApplyButtonLabel().label; this.applyState = 'idle'; }, 3000);
    }
  }

  // Counts this auto-apply and, once the user has been applying steadily,
  // offers Pro once. Never gates anything and never blocks the apply flow:
  // it is deliberately fire-and-forget, not awaited by handleAutoApply.
  //
  // Counting always happens; SHOWING is delayed so the prompt doesn't land on
  // top of the Easy Apply modal that just opened. For external applies the tab
  // often navigates to the company site inside that delay, so the prompt is
  // simply skipped that time - the count still stands, and it surfaces on a
  // later apply.
  _maybeShowUpsell() {
    if (!window.PreciprocalUpsell) return;
    window.PreciprocalUpsell.recordAutoApply()
      .then((result) => {
        if (!result?.shouldShow) return;
        setTimeout(() => {
          if (!document.body) return;
          window.PreciprocalUpsell.show({
            auth: {
              token:   this.authToken,
              userId:  this.authUserId || '',
              email:   this.authEmail || '',
              baseUrl: PRECIPROCAL_URL,
            },
            applyCount: result.applyCount,
            config:     result.config,
            onOpen: () => window.open(`${PRECIPROCAL_URL}/pricing?source=extension_upsell`, '_blank'),
          });
        }, 2500);
      })
      .catch(() => {});
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
      const resp = await chrome.runtime.sendMessage({ type: 'API_FETCH_TRACK_JOB', token: this.authToken, userId: this.authUserId || '', email: this.authEmail || '', baseUrl: PRECIPROCAL_URL, jobData: { ...this.jobData, status: 'saved' } });
      if (!resp?.success) throw new Error(resp?.error || 'Failed to track job');
      this.trackState = 'done';
      if (btn) { btn.classList.remove('loading'); btn.classList.add('done'); }
      this._replaceButtonIcon(btn, 'check');
      btn?.setAttribute('title', 'Saved to your tracker');
      const who = [this.jobData?.title, this.jobData?.company].filter(x => x && !/^Unknown /.test(x)).join(' at ');
      resp.data?.duplicate ? this.showNotificationWithLink('Already in your job tracker', 'Open tracker', `${PRECIPROCAL_URL}/job-tracker`, 'info', who) : this.showNotificationWithLink('Saved to your job tracker', 'Open tracker', `${PRECIPROCAL_URL}/job-tracker`, 'success', who);
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

  async _fetchViaBackground(url, fileName) {
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage({ type: 'FETCH_FILE', url, fileName }, (response) => {
          if (chrome.runtime.lastError || !response?.base64) resolve(null);
          else resolve(response);
        });
        setTimeout(() => resolve(null), 15000);
      } catch { resolve(null); }
    });
  }

  async _buildFileObject(url, fileName) {
    const ext = (fileName.split('.').pop() || '').toLowerCase();
    const mime = { pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }[ext] || 'application/octet-stream';
    if (url.startsWith('data:')) { const b64 = url.split(',')[1]; const bin = atob(b64); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i); return new File([bytes], fileName, { type: mime }); }
    // Route through the background service worker first - it has <all_urls> host
    // permissions so it isn't subject to linkedin.com's page-level CORS policy.
    const viaBg = await this._fetchViaBackground(url, fileName);
    if (viaBg?.base64) {
      const bin = atob(viaBg.base64); const bytes = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return new File([bytes], fileName, { type: viaBg.mimeType || mime });
    }
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

  // How this job fits the student's default resume, the same way the Jobs
  // page works it out (skills the posting names, found on the resume), plus
  // what the posting says and the employer's E-Verify and H-1B records.
  async fetchFit() {
    if (!this.isAuthenticated || !this.authToken || !this.jobData) return;
    // LinkedIn fills the description in after the top of the panel, so give
    // it a few seconds before asking with what is there.
    const startedFor = this.jobData.jobId;
    for (let i = 0; i < 12 && (this.jobData.description || '').length < 200; i++) {
      await this._delay(500);
      if (this.currentJobId !== startedFor) return;
      const again = new JobExtractor().extractJobData();
      if (again?.description) this.jobData.description = again.description;
      if (again?.company && this.jobData.company === 'Unknown Company') this.jobData.company = again.company;
    }
    const { jobId, company, title, location, description } = this.jobData;
    try {
      const resp = await chrome.runtime.sendMessage({
        type: 'API_FETCH_JOB_FIT', token: this.authToken, userId: this.authUserId || '', email: this.authEmail || '', baseUrl: PRECIPROCAL_URL,
        payload: { company, title, location, description: (description || '').slice(0, 20000) },
      });
      if (this.currentJobId !== jobId) return;
      if (resp?.success && resp.data?.success) { this.renderFit(resp.data); this._clearApplyRow(); }
      else this._fitUnavailable();
    } catch { this._fitUnavailable(); }
  }

  /** The fit could not be worked out: say so quietly, with a retry, rather than vanish. */
  _fitUnavailable() {
    const slot = this.banner?.querySelector('.prc-fit-slot');
    if (!slot) return;
    slot.innerHTML = '<div class="prc-fit prc-fit-off"><p class="prc-fit-sub">Could not read this job yet.</p><button type="button" class="prc-link prc-retry">Try again</button></div>';
    slot.querySelector('.prc-retry')?.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); slot.innerHTML = '<div class="prc-fit prc-fit-loading"><span class="prc-ring-skel"></span><span class="prc-skel-lines"><span></span><span></span></span></div>'; this.fetchFit(); });
  }

  renderFit(d) {
    const slot = this.banner?.querySelector('.prc-fit-slot');
    if (!slot) return;
    const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    const fit = d.fit || { skills: [], matched: [], missing: [], score: null, flags: [], years: null };
    const score = d.resume ? fit.score : null;
    const [a, b] = score === null ? ['#94a3b8', '#64748b'] : score >= 70 ? ['#34d399', '#10b981'] : score >= 40 ? ['#7c8cff', '#38bdf8'] : ['#94a3b8', '#64748b'];
    const size = 64, stroke = 6, r = size / 2 - stroke, c = 2 * Math.PI * r, gid = 'prcg' + Math.random().toString(36).slice(2, 8);
    const ring = `<span class="prc-ring" style="width:${size}px;height:${size}px">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg)">
        <defs><linearGradient id="${gid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${a}"/><stop offset="100%" stop-color="${b}"/></linearGradient></defs>
        <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--b-ring)" stroke-width="${stroke}"/>
        ${score === null ? '' : `<circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="url(#${gid})" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - score / 100)}"/>`}
      </svg>
      <span class="prc-ring-num${score !== null && score >= 100 ? ' prc-ring-num-3' : ''}">${score === null ? '--' : `${score}<small>%</small>`}</span>
    </span>`;

    let head, sub = '';
    if (!d.resume) {
      head = 'Add your resume to see how you match';
      sub = `<a class="prc-link" href="${PRECIPROCAL_URL}/settings?section=job-setup" target="_blank" rel="noopener">Add it in Preciprocal</a>`;
    } else if (!fit.skills.length) {
      head = (this.jobData?.description || '').length < 200 ? 'Open the full description to see your skill match' : 'This posting names no specific skills';
      sub = (this.jobData?.description || '').length < 200 ? 'Company records below are from USCIS.' : 'Read the description for what they want.';
    } else {
      head = `${fit.matched.length} of ${fit.skills.length} skills this job names are on your resume`;
      if (score === null) sub = 'Too few skills named to give a score.';
    }
    const chips = d.resume ? [
      ...fit.matched.slice(0, 8).map(s => `<span class="prc-skill prc-skill-on">${esc(s)}</span>`),
      ...fit.missing.slice(0, 6).map(s => `<span class="prc-skill" data-tip="Named in the posting, not found on your resume">${esc(s)}</span>`),
    ].join('') : '';

    // What the posting and the public records say.
    const facts = [];
    const ev = d.everify?.status;
    if (d.everify) {
      const when = d.everify.syncedAt ? ` Updated ${new Date(d.everify.syncedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}.` : '';
      const m = { enrolled: ['good', 'E-Verified', 'Enrolled in E-Verify, which a STEM OPT extension needs.'], ending: ['warn', 'E-Verify ending', 'Its E-Verify enrolment is set to end.'], ended: ['bad', 'E-Verify ended', 'Its E-Verify enrolment has ended.'], 'not-found': ['muted', 'Not found in E-Verify', 'No match in the E-Verify list. It may be listed under another name.'] }[ev?.state || 'not-found'];
      facts.push(`<span class="prc-fact prc-fact-${m[0]}" data-tip="${esc(m[2] + ' From the USCIS E-Verify list.' + when)}"><i></i>${m[1]}</span>`);
    }
    if (d.h1b) {
      const y = d.h1b.history?.years?.[0];
      if (y && y.approvals > 0) facts.push(`<span class="prc-fact prc-fact-good" data-tip="${esc(`USCIS H-1B data for ${d.h1b.history.employer}: ${y.approvals} approvals, ${y.newEmployment} for new employment, in ${y.year}.`)}"><i></i>H-1B: ${y.approvals} approved in ${esc(y.year)}</span>`);
      else if (d.h1b.history) facts.push(`<span class="prc-fact prc-fact-muted" data-tip="${esc(`USCIS H-1B data for ${d.h1b.history.employer}.`)}"><i></i>No H-1B approvals in ${esc(d.h1b.history.years?.[0]?.year || 'the latest year')}</span>`);
      else facts.push(`<span class="prc-fact prc-fact-muted" data-tip="No match in the USCIS H-1B data. It may be listed under another name."><i></i>No H-1B record found</span>`);
    }
    const flagText = { 'no-sponsorship': 'Says no visa sponsorship', 'citizen-only': 'US citizens only', clearance: 'Needs security clearance' };
    for (const f of fit.flags || []) facts.push(`<span class="prc-fact prc-fact-bad" data-tip="${esc('The posting says: ' + f.quote)}"><i></i>${flagText[f.kind] || 'Check eligibility'}</span>`);
    if (fit.years) facts.push(`<span class="prc-fact prc-fact-muted" data-tip="${esc('The posting says: ' + fit.years.quote)}"><i></i>${fit.years.min}+ years asked</span>`);
    const pay = d.facts?.pay;
    if (pay) {
      const k = (n) => '$' + (pay.unit === 'hour' ? String(n) : `${Math.round(n / 1000)}K`);
      facts.push(`<span class="prc-fact prc-fact-muted" data-tip="${esc('The posting says: ' + pay.quote)}"><i></i>${k(pay.min)}${pay.max ? ' to ' + k(pay.max) : ''}${pay.unit === 'hour' ? '/hr' : '/yr'}</span>`);
    }

    slot.innerHTML = `<div class="prc-fit">${ring}<div class="prc-fit-body"><p class="prc-fit-head">${esc(head)}</p>${sub ? `<p class="prc-fit-sub">${sub}</p>` : ''}${chips ? `<div class="prc-skills">${chips}</div>` : ''}</div></div>${facts.length ? `<div class="prc-facts">${facts.join('')}</div>` : ''}`;
    this._attachTooltips(slot);
  }

  // Ghost-job risk and response odds for this posting. Never blocks anything:
  // if it fails the strip simply does not appear.
  async fetchJobSignals() {
    if (!this.isAuthenticated || !this.authToken || !this.jobData?.company) return;
    try {
      const { company, jobId, postedText, applicantsText, closed, description } = this.jobData;
      const resp = await chrome.runtime.sendMessage({
        type: 'API_FETCH_JOB_SIGNALS', token: this.authToken, userId: this.authUserId || '', email: this.authEmail || '', baseUrl: PRECIPROCAL_URL,
        payload: { company, jobId, postedText, applicantsText, closed, description: (description || '').slice(0, 20000) },
      });
      // The same instance is re-initialised when the user clicks another job,
      // so a slow reply for the previous job must not render into the new one.
      if (this.currentJobId !== jobId) return;
      if (resp?.success && resp.data?.success) this.renderJobSignals(resp.data);
    } catch {}
  }

  // E-Verify enrolment for this company (STEM OPT needs it). Shared chip in
  // everify-badge.js; nothing renders when the daily copy isn't available.
  async fetchEverify() {
    if (!window.PreciprocalEverify || !this.isAuthenticated || !this.authToken || !this.jobData?.company) return;
    const jobId = this.jobData.jobId;
    const data = await window.PreciprocalEverify.fetchStatus({
      company: this.jobData.company, token: this.authToken, userId: this.authUserId, email: this.authEmail, baseUrl: PRECIPROCAL_URL,
    });
    // Same stale-reply guard as the signals strip.
    if (this.currentJobId !== jobId) return;
    const host = this.banner?.querySelector('.preciprocal-banner-compact');
    if (!host) return;
    host.querySelector('.prc-everify-row')?.remove();
    const el = window.PreciprocalEverify.chip(data, { tipMode: 'data-tip', theme: this.banner?.classList.contains('prc-light') ? 'light' : 'dark' });
    if (!el) return;
    const row = document.createElement('div');
    row.className = 'prc-everify-row';
    row.appendChild(el);
    host.appendChild(row);
    this._attachTooltips(row);
  }

  renderJobSignals(data) {
    const host = this.banner?.querySelector('.preciprocal-banner-compact');
    if (!host) return;
    host.querySelector('.prc-signals')?.remove();

    const wrap = document.createElement('div');
    wrap.className = `prc-signals prc-risk-${data.ghostRisk}`;

    const head = document.createElement('div');
    head.className = 'prc-signals-head';
    const label = { low: 'Looks active', medium: 'Some warning signs', high: 'Likely a ghost job' }[data.ghostRisk] || '';
    const pill = document.createElement('span');
    pill.className = 'prc-risk-pill';
    pill.textContent = label;
    head.appendChild(pill);

    const odds = data.companyOdds;
    const oddsEl = document.createElement('span');
    oddsEl.className = 'prc-odds';
    if (odds) {
      oddsEl.textContent = `${odds.responseRate}% reply rate · ${odds.interviewRate}% interviews${odds.medianDaysToResponse != null ? ` · replies in ~${odds.medianDaysToResponse}d` : ''}`;
      oddsEl.setAttribute('data-tip', `From ${odds.applications} applications by Preciprocal users. Shown only when 10+ different people have applied, and never per person.`);
    } else if (data.companyOddsNeedUsers) {
      oddsEl.textContent = 'Reply rate: not enough data yet';
      oddsEl.setAttribute('data-tip', 'We show a company\'s reply rate once 10 or more different Preciprocal users have applied there.');
    }
    if (oddsEl.textContent) head.appendChild(oddsEl);
    wrap.appendChild(head);

    const list = document.createElement('ul');
    list.className = 'prc-signal-list';
    for (const s of (data.signals || []).slice(0, 3)) {
      const li = document.createElement('li');
      li.className = `prc-sig prc-sig-${s.severity}`;
      li.textContent = s.text;
      list.appendChild(li);
    }
    if (list.childElementCount) wrap.appendChild(list);

    host.appendChild(wrap);
    this._attachTooltips(wrap);
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
    this._attachTooltips(this.banner);
  }

  // JS tooltip - appended to body so it is never clipped by the banner container.
  // Also called for the job signals strip, which renders after the banner.
  _attachTooltips(root) {
    root.querySelectorAll('[data-tip]').forEach(btn => {
      let tipEl = null;
      const removeTip = () => { tipEl?.remove(); tipEl = null; };
      btn.addEventListener('mouseenter', () => {
        removeTip(); // clean up any previous orphaned instance
        const text = btn.getAttribute('data-tip'); if (!text) return;
        tipEl = document.createElement('div'); tipEl.className = 'prc-tooltip'; tipEl.textContent = text;
        document.body.appendChild(tipEl);
        const rect = btn.getBoundingClientRect();
        const tw = tipEl.offsetWidth; const th = tipEl.offsetHeight;
        let left = rect.left + rect.width / 2 - tw / 2;
        let top  = rect.top - th - 8; // position:fixed — no scrollY offset needed
        if (left < 8) left = 8;
        if (left + tw > window.innerWidth - 8) left = window.innerWidth - tw - 8;
        tipEl.style.left = left + 'px'; tipEl.style.top = top + 'px';
        requestAnimationFrame(() => tipEl && tipEl.classList.add('prc-tooltip-show'));
      });
      btn.addEventListener('mouseleave', removeTip);
      btn.addEventListener('click', removeTip);
    });
  }

  _toastIcons() {
    return {
      success: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/></svg>`,
      error: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>`,
      info: `<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>`,
    };
  }

  /** A toast in the current design, light or dark to match LinkedIn. */
  _toast(message, type, { sub = '', linkText = '', linkUrl = '', ms = 3200 } = {}) {
    document.querySelectorAll('.preciprocal-notification').forEach(x => x.remove());
    const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const n = document.createElement('div');
    const m = getComputedStyle(document.body).backgroundColor.match(/[\d.]+/g);
    const light = m && (0.2126 * +m[0] + 0.7152 * +m[1] + 0.0722 * +m[2]) > 140;
    n.className = `preciprocal-notification ${type}${light ? ' prc-t-light' : ''}`;
    n.setAttribute('role', 'status');
    n.innerHTML = `<div class="prc-toast-inner"><div class="prc-toast-icon">${this._toastIcons()[type] || this._toastIcons().info}</div><div class="prc-toast-body"><div class="prc-toast-msg">${esc(message)}</div>${sub ? `<div class="prc-toast-sub">${esc(sub)}</div>` : ''}<div class="prc-toast-brand">Preciprocal</div></div>${linkText ? `<button type="button" class="prc-toast-link">${esc(linkText)}</button>` : ''}</div>`;
    n.querySelector('.prc-toast-link')?.addEventListener('click', () => window.open(linkUrl, '_blank'));
    document.body.appendChild(n); setTimeout(() => n.classList.add('show'), 10); setTimeout(() => { n.classList.remove('show'); setTimeout(() => n.remove(), 300); }, ms);
  }

  showNotification(message, type = 'success') { this._toast(message, type); }

  showNotificationWithLink(message, linkText, linkUrl, type = 'success', sub = '') { this._toast(message, type, { sub, linkText, linkUrl, ms: 5000 }); }

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
      /* ── Pro upsell prompt (extension/upsell.js) ──
         Bottom-left, so it never overlaps the toasts top-right or LinkedIn's
         own bottom-right messaging widget. Non-blocking by construction:
         fixed, narrow, and it never covers the apply controls. */
      .preciprocal-upsell { position:fixed; left:20px; bottom:20px; z-index:9998; width:300px; opacity:0; transform:translateY(12px); transition:opacity .25s ease, transform .25s ease; font-family:PrcInter, -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif; }
      .preciprocal-upsell.show { opacity:1; transform:translateY(0); }
      .prc-upsell-inner { position:relative; display:flex; gap:8px; background:linear-gradient(135deg,#1e1b4b 0%,#1e293b 100%); border:1px solid rgba(99,102,241,0.28); border-radius:12px; padding:14px 14px 12px; box-shadow:0 8px 28px rgba(0,0,0,0.35); }
      .prc-upsell-title { font-size:13px; font-weight:700; color:#f5f5f5; margin-bottom:4px; }
      .prc-upsell-msg { font-size:12px; line-height:1.5; color:#94a3b8; margin-bottom:10px; }
      .prc-upsell-actions { display:flex; gap:8px; }
      .prc-upsell-cta { padding:7px 12px; border:none; border-radius:8px; background:linear-gradient(135deg,#6366f1,#a855f7); color:#fff; font-size:12px; font-weight:600; cursor:pointer; font-family:inherit; }
      .prc-upsell-cta:hover { opacity:.9; }
      .prc-upsell-dismiss { padding:7px 12px; border:1px solid rgba(255,255,255,0.12); border-radius:8px; background:transparent; color:#94a3b8; font-size:12px; font-weight:600; cursor:pointer; font-family:inherit; }
      .prc-upsell-dismiss:hover { background:rgba(255,255,255,0.06); color:#e2e8f0; }
      .prc-upsell-close { position:absolute; top:8px; right:8px; width:20px; height:20px; padding:0; border:none; background:transparent; color:#475569; font-size:17px; line-height:1; cursor:pointer; font-family:inherit; }
      .prc-upsell-close:hover { color:#cbd5e1; }

      /* ── Banner container ── */
      .preciprocal-inline-container { margin:16px 0; font-family:PrcInter, -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif; }

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
      .prc-tooltip { position:fixed; z-index:2147483647; background:rgba(10,14,30,0.97); color:#f1f5f9; padding:7px 11px; border-radius:7px; font-size:12px; font-weight:500; line-height:1.45; white-space:normal; max-width:240px; text-align:center; pointer-events:none; box-shadow:0 4px 16px rgba(0,0,0,0.5); border:1px solid rgba(99,102,241,0.25); opacity:0; transform:translateY(3px); transition:opacity 0.15s ease, transform 0.15s ease; font-family:PrcInter, -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
      .prc-tooltip.prc-tooltip-show { opacity:1; transform:translateY(0); }

      /* ── Spinner ── */
      .prc-spinner { width:14px; height:14px; border:2px solid rgba(176,184,193,0.3); border-top-color:#b0b8c1; border-radius:50%; animation:prc-spin 0.7s linear infinite; flex-shrink:0; }
      @keyframes prc-spin { to { transform:rotate(360deg); } }

      /* ── Job signals strip (ghost risk + reply odds) ── */
      .prc-signals { margin-top:12px; padding-top:12px; border-top:1px solid rgba(148,163,184,0.18); }
      .prc-signals-head { display:flex; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:6px; }
      .prc-everify-row { display:flex; margin-top:8px; }
      .prc-risk-pill { font-size:12px; font-weight:700; padding:3px 9px; border-radius:999px; border:1px solid; }
      .prc-risk-low .prc-risk-pill { color:#34d399; border-color:rgba(52,211,153,0.35); background:rgba(52,211,153,0.08); }
      .prc-risk-medium .prc-risk-pill { color:#fbbf24; border-color:rgba(251,191,36,0.35); background:rgba(251,191,36,0.08); }
      .prc-risk-high .prc-risk-pill { color:#f87171; border-color:rgba(248,113,113,0.35); background:rgba(248,113,113,0.08); }
      .prc-odds { font-size:12px; color:#cbd5e1; cursor:help; }
      .prc-signal-list { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:4px; }
      .prc-sig { font-size:12.5px; line-height:1.45; color:#cbd5e1; padding-left:14px; position:relative; }
      .prc-sig::before { content:''; position:absolute; left:2px; top:7px; width:6px; height:6px; border-radius:50%; background:#64748b; }
      .prc-sig-good::before { background:#34d399; }
      .prc-sig-info::before { background:#60a5fa; }
      .prc-sig-warn::before { background:#fbbf24; }
      .prc-sig-bad::before { background:#f87171; }
      .preciprocal-inline-container.prc-light .prc-signals { border-top-color:rgba(0,0,0,0.08); }
      .preciprocal-inline-container.prc-light .prc-odds,
      .preciprocal-inline-container.prc-light .prc-sig { color:#374151; }
      .preciprocal-inline-container.prc-light .prc-risk-low .prc-risk-pill { color:#047857; }
      .preciprocal-inline-container.prc-light .prc-risk-medium .prc-risk-pill { color:#b45309; }
      .preciprocal-inline-container.prc-light .prc-risk-high .prc-risk-pill { color:#b91c1c; }

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

      /* ── Banner, current design ──
         Neutral, in the app's type, and drawn from variables so it follows
         LinkedIn's theme (.prc-light is set from the colour behind it). */
      #preciprocal-inline-banner { --b-bg:rgba(255,255,255,0.03); --b-border:rgba(255,255,255,0.12); --b-fg:rgba(255,255,255,0.92); --b-muted:rgba(255,255,255,0.62); --b-soft:rgba(255,255,255,0.06); --b-hover:rgba(255,255,255,0.09); --b-primary:#5b6ef5; --b-on-primary:#ffffff; --b-ring:rgba(255,255,255,0.12); --b-brand:#a5b0ff; --b-tint:linear-gradient(135deg,rgba(91,110,245,0.16) 0%,rgba(124,58,237,0.07) 55%,rgba(91,110,245,0.02) 100%); --b-edge:rgba(129,140,248,0.38); --b-tag:rgba(165,176,255,0.14); margin:16px 0; font-family:PrcInter, -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif; }
      #preciprocal-inline-banner.prc-light { --b-bg:rgba(0,0,0,0.015); --b-border:rgba(0,0,0,0.12); --b-fg:rgba(0,0,0,0.9); --b-muted:rgba(0,0,0,0.6); --b-soft:rgba(0,0,0,0.04); --b-hover:rgba(0,0,0,0.06); --b-primary:#4f5be8; --b-on-primary:#ffffff; --b-ring:rgba(0,0,0,0.1); --b-brand:#4338ca; --b-tint:linear-gradient(135deg,rgba(91,110,245,0.10) 0%,rgba(124,58,237,0.05) 55%,rgba(91,110,245,0.015) 100%); --b-edge:rgba(79,91,232,0.30); --b-tag:rgba(79,91,232,0.10); }
      #preciprocal-inline-banner .preciprocal-banner-compact { background:var(--b-tint); border:1px solid var(--b-edge); border-radius:12px; padding:18px 18px 16px; box-shadow:none; overflow:hidden; }
      #preciprocal-inline-banner .preciprocal-banner-compact::before { content:''; position:absolute; left:0; right:0; top:0; height:3px; background:linear-gradient(90deg,#5b6ef5 0%,#7c3aed 100%); }
      #preciprocal-inline-banner .preciprocal-banner-compact:hover { border-color:var(--b-edge); box-shadow:none; }
      #preciprocal-inline-banner .prc-fit-slot { margin:0 0 14px; }
      #preciprocal-inline-banner .prc-fit-off { justify-content:space-between; padding:10px 12px; }
      #preciprocal-inline-banner button.prc-link { background:none; border:0; cursor:pointer; font:inherit; font-size:12.5px; padding:0; }
      #preciprocal-inline-banner .prc-fit { display:flex; align-items:center; gap:14px; padding:12px; border-radius:10px; background:var(--b-soft); }
      #preciprocal-inline-banner .prc-ring { position:relative; display:inline-flex; align-items:center; justify-content:center; flex-shrink:0; }
      #preciprocal-inline-banner .prc-ring-num { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; font-size:17px; font-weight:700; line-height:1; color:var(--b-fg); font-variant-numeric:tabular-nums; letter-spacing:-0.02em; }
      #preciprocal-inline-banner .prc-ring-num-3 { font-size:14px; letter-spacing:-0.03em; }
      #preciprocal-inline-banner .prc-ring-num small { font-size:9px; font-weight:600; color:var(--b-muted); margin-left:1px; align-self:center; transform:translateY(1px); }
      #preciprocal-inline-banner .prc-fit-body { min-width:0; flex:1; }
      #preciprocal-inline-banner .prc-fit-head { margin:0; font-size:14px; font-weight:600; color:var(--b-fg); line-height:1.35; }
      #preciprocal-inline-banner .prc-fit-sub { margin:2px 0 0; font-size:12.5px; color:var(--b-muted); }
      #preciprocal-inline-banner .prc-link { color:var(--b-brand); font-weight:600; text-decoration:none; }
      #preciprocal-inline-banner .prc-link:hover { text-decoration:underline; }
      #preciprocal-inline-banner .prc-skills { display:flex; flex-wrap:wrap; gap:5px; margin-top:8px; }
      #preciprocal-inline-banner .prc-skill { display:inline-flex; align-items:center; height:22px; padding:0 8px; border-radius:6px; font-size:12px; font-weight:500; color:var(--b-muted); border:1px dashed var(--b-border); cursor:default; }
      #preciprocal-inline-banner .prc-skill-on { color:#16a34a; border:1px solid rgba(22,163,74,0.35); background:rgba(22,163,74,0.08); }
      #preciprocal-inline-banner .prc-facts { display:flex; flex-wrap:wrap; gap:6px; margin-top:10px; }
      #preciprocal-inline-banner .prc-fact { display:inline-flex; align-items:center; gap:6px; height:24px; padding:0 9px; border-radius:999px; font-size:12px; font-weight:500; color:var(--b-fg); background:transparent; border:1px solid var(--b-border); cursor:help; }
      #preciprocal-inline-banner .prc-fact i { width:6px; height:6px; border-radius:999px; background:#94a3b8; }
      #preciprocal-inline-banner .prc-fact-good i { background:#22c55e; }
      #preciprocal-inline-banner .prc-fact-warn i { background:#f59e0b; }
      #preciprocal-inline-banner .prc-fact-bad { color:#ef4444; border-color:rgba(239,68,68,0.4); }
      #preciprocal-inline-banner .prc-fact-bad i { background:#ef4444; }
      #preciprocal-inline-banner .prc-fact-muted { color:var(--b-muted); }
      #preciprocal-inline-banner .prc-fit-loading .prc-ring-skel { width:64px; height:64px; border-radius:999px; border:6px solid var(--b-ring); flex-shrink:0; }
      #preciprocal-inline-banner .prc-skel-lines { flex:1; display:flex; flex-direction:column; gap:8px; }
      #preciprocal-inline-banner .prc-skel-lines span { height:10px; border-radius:4px; background:var(--b-ring); animation:prc-pulse 1.4s ease-in-out infinite; }
      #preciprocal-inline-banner .prc-skel-lines span:last-child { width:60%; }
      @keyframes prc-pulse { 50% { opacity:.45; } }
      #preciprocal-inline-banner .prc-applied-pill { display:inline-flex; align-items:center; gap:4px; height:20px; padding:0 8px; margin:0; border-radius:999px; font-family:PrcInter, sans-serif; font-size:11px; font-weight:600; line-height:1; color:#fff; background:#16a34a; }
      #preciprocal-inline-banner .prc-tag { display:inline-flex; align-items:center; height:18px; padding:0 7px; margin-left:8px; border-radius:999px; font-family:PrcInter, sans-serif; font-size:11px; font-weight:600; letter-spacing:0; color:var(--b-brand); background:var(--b-tag); vertical-align:1px; }
      #preciprocal-inline-banner .prc-top-section { align-items:flex-start; margin-bottom:14px; gap:14px; }
      #preciprocal-inline-banner .prc-title-row { align-items:flex-start; gap:12px; }
      #preciprocal-inline-banner .prc-logo-img { width:34px; height:34px; border-radius:9px; margin-top:0; padding:5px; box-sizing:border-box; background:var(--b-tag); }
      #preciprocal-inline-banner .prc-title-text { min-width:0; }
      #preciprocal-inline-banner .prc-brand { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin:0 0 2px; font-family:PrcSatoshi, PrcInter, sans-serif; font-size:15px; font-weight:700; letter-spacing:-0.01em; color:var(--b-brand); line-height:1.3; }
      #preciprocal-inline-banner .prc-title { margin:0; font-size:14px; font-weight:400; color:var(--b-muted); line-height:1.45; }
      #preciprocal-inline-banner .prc-actions { gap:8px; flex-wrap:wrap; margin:0; }
      #preciprocal-inline-banner .prc-btn { height:34px; padding:0 14px; border-radius:999px; font-size:14px; font-weight:600; color:var(--b-fg); background:transparent; border:1px solid var(--b-border); backdrop-filter:none; transition:background .15s ease, border-color .15s ease, color .15s ease; }
      #preciprocal-inline-banner .prc-btn:hover { background:var(--b-hover); border-color:var(--b-border); color:var(--b-fg); }
      #preciprocal-inline-banner .prc-btn.prc-apply { background:var(--b-primary); color:var(--b-on-primary); border-color:transparent; }
      #preciprocal-inline-banner .prc-btn.prc-apply { background:linear-gradient(135deg,#5b6ef5 0%,#6d4ee8 100%); box-shadow:0 1px 2px rgba(0,0,0,0.2), 0 4px 14px -4px rgba(91,110,245,0.55); }
      #preciprocal-inline-banner .prc-btn.prc-apply:hover { background:linear-gradient(135deg,#5b6ef5 0%,#6d4ee8 100%); filter:brightness(1.08); color:var(--b-on-primary); }
      #preciprocal-inline-banner .prc-btn.prc-apply.done { background:#15803d; color:#fff; }
      #preciprocal-inline-banner .prc-btn.prc-apply.error { background:#b91c1c; color:#fff; }
      #preciprocal-inline-banner .prc-btn.prc-track { color:var(--b-muted); }
      #preciprocal-inline-banner .prc-btn.prc-track:hover { color:var(--b-fg); }
      #preciprocal-inline-banner .prc-btn.prc-track.done { color:#16a34a; border-color:rgba(22,163,74,0.45); background:rgba(22,163,74,0.08); }
      #preciprocal-inline-banner .prc-btn { flex:0 0 auto; min-width:0; }
      #preciprocal-inline-banner .prc-btn.prc-icon-only { width:34px; padding:0; }
      #preciprocal-inline-banner .prc-btn.prc-track { margin-left:auto; }
      #preciprocal-inline-banner .ring-bg { stroke:var(--b-ring); }
      #preciprocal-inline-banner .score-val .num { font-size:13px; color:var(--b-fg); }
      #preciprocal-inline-banner .prc-spinner { border-color:var(--b-ring); border-top-color:var(--b-fg); }
      #preciprocal-inline-banner .prc-signals { border-top-color:var(--b-border); margin-top:14px; padding-top:12px; }
      #preciprocal-inline-banner .prc-odds, #preciprocal-inline-banner .prc-sig { color:var(--b-muted); }

      /* ── Modal banner ── */
      .preciprocal-banner { display:flex; align-items:center; gap:8px; padding:10px 16px; margin:0 0 4px 0; border-bottom:1px solid rgba(139,92,246,0.25); background:linear-gradient(135deg,rgba(15,10,35,0.97) 0%,rgba(30,18,60,0.97) 100%); font-size:13px; color:#c4b5fd; position:sticky; top:0; z-index:9999; border-radius:8px 8px 0 0; backdrop-filter:blur(12px); font-family:PrcInter, -apple-system,sans-serif; }
      .preciprocal-banner[data-state="filling"] { color:#93c5fd; }
      .preciprocal-banner[data-state="ready"] { color:#86efac; border-bottom-color:rgba(134,239,172,0.2); }
      .pr-icon { font-size:14px; flex-shrink:0; }
      .pr-modal-logo { width:16px; height:16px; border-radius:3px; flex-shrink:0; object-fit:contain; }
      .preciprocal-banner span:not(.pr-icon):not(.pr-spinner) { flex:1; font-weight:500; }
      .pr-dismiss { background:none; border:none; color:rgba(134,239,172,0.6); cursor:pointer; font-size:12px; padding:2px 4px; border-radius:4px; line-height:1; flex-shrink:0; }
      .pr-dismiss:hover { color:#86efac; background:rgba(134,239,172,0.1); }
      .pr-spinner { width:13px; height:13px; border:2px solid rgba(147,197,253,0.3); border-top-color:#93c5fd; border-radius:50%; animation:prc-spin 0.7s linear infinite; flex-shrink:0; }

      /* ── Toast notifications ── */
      .preciprocal-notification { position:fixed; bottom:24px; right:24px; z-index:999999; opacity:0; transform:translateY(8px) scale(0.96); transition:opacity 0.22s cubic-bezier(0.16,1,0.3,1),transform 0.22s cubic-bezier(0.16,1,0.3,1); font-family:PrcInter, -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; pointer-events:none; }
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
      /* Toast, current design */
      .preciprocal-notification { font-family:PrcInter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif !important; }
      .preciprocal-notification .prc-toast-inner { position:relative; overflow:hidden; align-items:flex-start; gap:12px; padding:14px 14px 14px 16px; border-radius:12px; min-width:300px; max-width:380px; background:#151618; border:1px solid rgba(255,255,255,0.1); box-shadow:0 18px 40px -12px rgba(0,0,0,0.6); backdrop-filter:none; }
      .preciprocal-notification .prc-toast-inner::before { content:''; position:absolute; left:0; right:0; top:0; height:2px; background:linear-gradient(90deg,#5b6ef5,#7c3aed); }
      .preciprocal-notification .prc-toast-icon { width:22px; height:22px; border-radius:999px; margin-top:1px; }
      .preciprocal-notification .prc-toast-icon svg { width:13px; height:13px; }
      .preciprocal-notification.success .prc-toast-icon { color:#fff; background:#16a34a; }
      .preciprocal-notification.error .prc-toast-icon { color:#fff; background:#dc2626; }
      .preciprocal-notification.info .prc-toast-icon { color:#fff; background:#5b6ef5; }
      .preciprocal-notification .prc-toast-msg { font-size:13.5px; font-weight:600; color:#f7f8f8; }
      .preciprocal-notification .prc-toast-sub { margin-top:2px; font-size:12.5px; color:#a4a9b1; line-height:1.4; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:220px; }
      .preciprocal-notification .prc-toast-brand { margin-top:4px; font-size:11px; font-weight:600; color:#8b96ff; }
      .preciprocal-notification .prc-toast-link { flex-shrink:0; align-self:center; margin:0; height:30px; padding:0 12px; border-radius:999px; border:0; cursor:pointer; font-family:inherit; font-size:12.5px; font-weight:600; color:#fff; background:linear-gradient(135deg,#5b6ef5,#7c3aed); }
      .preciprocal-notification .prc-toast-link:hover { filter:brightness(1.08); color:#fff; }
      .preciprocal-notification.prc-t-light .prc-toast-inner { background:#ffffff; border-color:rgba(0,0,0,0.1); box-shadow:0 18px 40px -12px rgba(0,0,0,0.25); }
      .preciprocal-notification.prc-t-light .prc-toast-msg { color:#111827; }
      .preciprocal-notification.prc-t-light .prc-toast-sub { color:#4b5563; }
      .preciprocal-notification.prc-t-light .prc-toast-brand { color:#4f5be8; }

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
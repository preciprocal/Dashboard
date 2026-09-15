// extension/upsell.js
// Non-blocking Pro prompt, shown after sustained auto-apply use.
//
// ─── What this deliberately does NOT do ─────────────────────────────────────
// It gates nothing. Every extension feature works exactly the same whether or
// not this file runs, whether the prompt has been shown, and whether the user
// is on Free or Pro. The prompt is a suggestion that can be ignored or
// dismissed, and dismissing it has no consequence.
//
// Loaded before banner.js in the LinkedIn content script list, so
// PreciprocalUpsell is defined by the time the banner calls it. Both scripts
// share one execution world, so this is a plain global rather than a module.
//
// Storage keys used (chrome.storage.local):
//   preciprocal_upsell_applies    — array of auto-apply timestamps (ms)
//   preciprocal_upsell_last_shown — ms timestamp of the last prompt
//   preciprocal_upsell_config     — server-provided config, cached

(function () {
  'use strict';

  // Defaults, used on first run and whenever the server has not answered yet.
  // The authoritative values live in lib/config/extension-upsell.ts and arrive
  // on every upsell-event response, so N can be retuned by deploying the web
  // app rather than shipping a Chrome Web Store update.
  const DEFAULT_CONFIG = {
    threshold:    5,   // auto-applies within the window
    windowDays:   7,
    cooldownDays: 30,  // minimum gap between prompts
  };

  const VARIANT = 'auto_apply_cover_letter';
  const DAY_MS  = 24 * 60 * 60 * 1000;

  const KEYS = {
    applies:   'preciprocal_upsell_applies',
    lastShown: 'preciprocal_upsell_last_shown',
    config:    'preciprocal_upsell_config',
  };

  async function getConfig() {
    try {
      const stored = await chrome.storage.local.get([KEYS.config]);
      return { ...DEFAULT_CONFIG, ...(stored[KEYS.config] || {}) };
    } catch {
      return DEFAULT_CONFIG;
    }
  }

  /**
   * Record one auto-apply and report whether the prompt should now show.
   * Called from banner.js after an auto-apply has actually started.
   */
  async function recordAutoApply() {
    try {
      const config = await getConfig();
      const now    = Date.now();
      const cutoff = now - config.windowDays * DAY_MS;

      const stored  = await chrome.storage.local.get([KEYS.applies, KEYS.lastShown]);
      // Prune on write, so the array stays bounded by the window rather than
      // growing for the life of the install.
      const applies = (stored[KEYS.applies] || []).filter(ts => ts > cutoff);
      applies.push(now);

      await chrome.storage.local.set({ [KEYS.applies]: applies });

      if (applies.length < config.threshold) return { shouldShow: false };

      const lastShown = stored[KEYS.lastShown] || 0;
      if (now - lastShown < config.cooldownDays * DAY_MS) return { shouldShow: false };

      return { shouldShow: true, applyCount: applies.length, config };
    } catch {
      // Telemetry must never break the auto-apply the user actually wanted.
      return { shouldShow: false };
    }
  }

  /** Fire-and-forget event report. Caches any config the server sends back. */
  function reportEvent(auth, event, context) {
    try {
      chrome.runtime.sendMessage(
        {
          type:    'API_POST_UPSELL_EVENT',
          token:   auth.token,
          userId:  auth.userId || '',
          email:   auth.email || '',
          baseUrl: auth.baseUrl,
          payload: { event, variant: VARIANT, context: context || {} },
        },
        (resp) => {
          // Reading lastError suppresses "Unchecked runtime.lastError" noise
          // when the service worker is asleep; nothing here needs to retry.
          void chrome.runtime.lastError;
          if (resp?.success && resp.data?.config) {
            chrome.storage.local.set({ [KEYS.config]: resp.data.config });
          }
        },
      );
    } catch {
      // Ignored by design.
    }
  }

  /**
   * Render the prompt. Non-blocking: it sits in the corner, never covers the
   * page's own controls, auto-dismisses, and does not interrupt the apply
   * flow that triggered it.
   */
  function show({ auth, applyCount, config, onOpen }) {
    if (document.getElementById('preciprocal-upsell')) return;

    const card = document.createElement('div');
    card.id = 'preciprocal-upsell';
    card.className = 'preciprocal-upsell';
    card.innerHTML = `
      <div class="prc-upsell-inner">
        <div class="prc-upsell-body">
          <div class="prc-upsell-title">${applyCount} applications this week</div>
          <div class="prc-upsell-msg">
            Pro writes a cover letter tailored to each one, in about 10 seconds.
          </div>
          <div class="prc-upsell-actions">
            <button class="prc-upsell-cta" type="button">See Pro</button>
            <button class="prc-upsell-dismiss" type="button">Not now</button>
          </div>
        </div>
        <button class="prc-upsell-close" type="button" aria-label="Dismiss">&times;</button>
      </div>
    `;

    let settled = false;
    const close = (event) => {
      if (settled) return;
      settled = true;
      if (event) reportEvent(auth, event, { applyCount, threshold: config.threshold });
      card.classList.remove('show');
      setTimeout(() => card.remove(), 300);
    };

    card.querySelector('.prc-upsell-cta').addEventListener('click', () => {
      close('clicked');
      onOpen();
    });
    card.querySelector('.prc-upsell-dismiss').addEventListener('click', () => close('dismissed'));
    card.querySelector('.prc-upsell-close').addEventListener('click', () => close('dismissed'));

    document.body.appendChild(card);
    setTimeout(() => card.classList.add('show'), 10);

    // Times out on its own. An ignored prompt counts as neither dismissed nor
    // clicked, which keeps the funnel honest: shown-minus-(clicked+dismissed)
    // is genuine indifference, and conflating that with an active "no" would
    // flatter the dismissal rate.
    setTimeout(() => close(null), 20000);

    chrome.storage.local.set({ [KEYS.lastShown]: Date.now() });
    reportEvent(auth, 'shown', { applyCount, threshold: config.threshold });
  }

  window.PreciprocalUpsell = { recordAutoApply, show };
})();

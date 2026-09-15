// lib/config/extension-upsell.ts
// Server-side tuning for the in-extension Pro prompt.
//
// The extension ships with its own defaults so it works offline and on first
// run, but every response from /api/extension/upsell-event carries these
// values back, and the extension caches them. That means N can be retuned by
// deploying the web app, without pushing a Chrome Web Store update and waiting
// on review and staged rollout.

/** Auto-applies within the window before the prompt is eligible to show. */
export const UPSELL_AUTO_APPLY_THRESHOLD = 5;

/** Rolling window the auto-applies are counted over. */
export const UPSELL_WINDOW_DAYS = 7;

/**
 * Minimum gap between showing the prompt to the same person.
 *
 * The prompt is non-blocking, but a heavy user can hit the threshold every
 * week indefinitely, and a suggestion that reappears every week stops reading
 * as a suggestion. 30 days keeps it rare enough to stay ignorable.
 */
export const UPSELL_COOLDOWN_DAYS = 30;

export interface UpsellConfig {
  threshold: number;
  windowDays: number;
  cooldownDays: number;
}

export function getUpsellConfig(): UpsellConfig {
  return {
    threshold:    UPSELL_AUTO_APPLY_THRESHOLD,
    windowDays:   UPSELL_WINDOW_DAYS,
    cooldownDays: UPSELL_COOLDOWN_DAYS,
  };
}

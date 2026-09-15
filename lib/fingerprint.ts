// lib/fingerprint.ts
// A small browser fingerprint, used to stop one person claiming the .edu
// student perk repeatedly from the same machine with different university
// addresses (see supabase/migrations/0022_student_verifications.sql).
//
// WHAT THIS IS AND ISN'T
// This is a speed bump, not an identity check. Every signal below is
// client-supplied and therefore forgeable, and the honest defeats are trivial:
// incognito, a different browser, or a fresh profile all produce a different
// value. It raises the effort of casual repeat-claiming from "log out and sign
// up again" to "open a different browser", which is where most of the abuse
// actually stops. Treat a match as evidence, never as proof, and never use it
// as the sole basis for an irreversible action.
//
// Deliberately hand-rolled rather than pulling in FingerprintJS: v4 ships
// under a Business Source Licence, and this is ~60 lines with no licensing
// question attached. If we ever need real accuracy, swapping this function's
// body for their agent is a contained change - callers only see a string.

const FP_STORAGE_KEY = 'preciprocal_device_id';

/** Stable across reloads, distinct across machines, cheap to compute. */
function collectSignals(): string {
  const nav = navigator as Navigator & { deviceMemory?: number };

  const signals = [
    navigator.userAgent,
    navigator.language,
    (navigator.languages ?? []).join(','),
    // Screen geometry survives window resizes; inner dimensions would not.
    `${screen.width}x${screen.height}x${screen.colorDepth}`,
    String(screen.pixelDepth),
    String(window.devicePixelRatio ?? ''),
    Intl.DateTimeFormat().resolvedOptions().timeZone ?? '',
    String(new Date().getTimezoneOffset()),
    String(navigator.hardwareConcurrency ?? ''),
    String(nav.deviceMemory ?? ''),
    navigator.platform ?? '',
    String(navigator.maxTouchPoints ?? ''),
    canvasSignal(),
  ];

  return signals.join('|');
}

/**
 * Canvas rendering differs measurably between GPU/driver/font-stack
 * combinations, which is what separates two otherwise-identical machines.
 * Wrapped because a blocked canvas (privacy extensions, hardened browsers)
 * throws or returns a blank surface - in that case we simply lose one signal
 * rather than failing the whole verification.
 */
function canvasSignal(): string {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 240;
    canvas.height = 60;
    const ctx = canvas.getContext('2d');
    if (!ctx) return 'no-canvas';

    ctx.textBaseline = 'top';
    ctx.font = "14px 'Arial'";
    ctx.fillStyle = '#f60';
    ctx.fillRect(100, 5, 80, 40);
    ctx.fillStyle = '#069';
    ctx.fillText('Preciprocal.fp@1', 2, 15);
    ctx.fillStyle = 'rgba(102,204,0,0.65)';
    ctx.fillText('Preciprocal.fp@1', 4, 25);

    return canvas.toDataURL().slice(-96);
  } catch {
    return 'canvas-blocked';
  }
}

async function sha256Hex(input: string): Promise<string> {
  const bytes  = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Returns a stable hex device id for this browser, or null when it cannot be
 * computed (SSR, or a browser without SubtleCrypto - which requires a secure
 * context, so plain-HTTP local dev hits this path).
 *
 * Callers MUST treat null as "no signal" and proceed, not as a failure. The
 * server records a null fingerprint and the device-uniqueness index simply
 * does not apply to that row - the per-address ledger still holds. Blocking
 * a verification because we could not fingerprint would punish exactly the
 * privacy-conscious users least likely to be farming the perk.
 */
export async function getDeviceFingerprint(): Promise<string | null> {
  if (typeof window === 'undefined' || !window.crypto?.subtle) return null;

  try {
    // Cached so the value survives a soft navigation mid-flow and stays
    // identical between send-verification and verify-code. Clearing storage
    // regenerates it - an accepted and unavoidable defeat, see the header.
    const cached = window.localStorage?.getItem(FP_STORAGE_KEY);
    if (cached) return cached;

    const fingerprint = await sha256Hex(collectSignals());

    try {
      window.localStorage?.setItem(FP_STORAGE_KEY, fingerprint);
    } catch {
      // Storage disabled/full - the fingerprint is still valid for this call,
      // it just gets recomputed next time (and recomputes to the same value
      // anyway, since every input signal is stable).
    }

    return fingerprint;
  } catch {
    return null;
  }
}

// lib/email/new-device.ts
// Sent when a new login evicts the oldest session because the account hit its
// concurrent-session cap.
//
// Follows lib/email/welcome.ts: same sender identity, same escaping, plain
// markup. Written as a factual security notice rather than a warning - the
// overwhelmingly common case is the account's real owner logging in somewhere
// new, and leading with an accusation would be wrong for almost everyone who
// receives it.
import { Resend } from "resend";
import { SITE } from "@/lib/seo";
import { MAX_CONCURRENT_SESSIONS } from "@/lib/config/session-guard";

const resend = new Resend(process.env.RESEND_API_KEY);

const SENDER_NAME = process.env.WELCOME_EMAIL_SENDER_NAME ?? "Francesca";
const FROM = process.env.WELCOME_EMAIL_FROM ?? `${SENDER_NAME} from Preciprocal <francesca@preciprocal.com>`;
const REPLY_TO = process.env.WELCOME_EMAIL_REPLY_TO ?? "francesca@preciprocal.com";

const APP_URL = (() => {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (!configured || configured.includes("localhost") || configured.includes("127.0.0.1")) {
    return SITE.app;
  }
  return configured.replace(/\/$/, "");
})();

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface NewDeviceEmailParams {
  email: string;
  /** Coarse "City, Country" of the NEW login, or null if the edge gave us none. */
  location: string | null;
  userAgent: string | null;
}

/** "Chrome on macOS"-ish, from a user agent. Best effort, never throws. */
function describeDevice(userAgent: string | null): string {
  if (!userAgent) return "a new device";

  const browser =
    /edg\//i.test(userAgent)     ? "Edge"
    : /chrome|crios/i.test(userAgent) ? "Chrome"
    : /firefox|fxios/i.test(userAgent) ? "Firefox"
    : /safari/i.test(userAgent)  ? "Safari"
    : null;

  const os =
    /windows/i.test(userAgent)        ? "Windows"
    : /mac os|macintosh/i.test(userAgent) ? "macOS"
    : /android/i.test(userAgent)      ? "Android"
    : /iphone|ipad|ios/i.test(userAgent) ? "iOS"
    : /linux/i.test(userAgent)        ? "Linux"
    : null;

  if (browser && os) return `${browser} on ${os}`;
  return browser ?? os ?? "a new device";
}

/**
 * Never throws. An email failure must not roll back the eviction that
 * triggered it - the session is already gone either way, and a thrown error
 * here would surface as a failed page load for the person logging in.
 */
export async function sendNewDeviceEmail({ email, location, userAgent }: NewDeviceEmailParams) {
  try {
    const device = describeDevice(userAgent);
    const where  = location ? ` from ${escapeHtml(location)}` : "";

    await resend.emails.send({
      from: FROM,
      to: email,
      replyTo: REPLY_TO,
      subject: "A new device signed in to your Preciprocal account",
      html: `
        <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:32px;color:#1e1e2e;">
          <p style="margin:0 0 16px;">Hi,</p>
          <p style="margin:0 0 16px;line-height:1.6;">
            Your Preciprocal account was just signed in to on ${escapeHtml(device)}${where}.
          </p>
          <p style="margin:0 0 16px;line-height:1.6;">
            Preciprocal keeps you signed in on up to ${MAX_CONCURRENT_SESSIONS} devices at once,
            so your oldest session was signed out to make room. If that was you, there's nothing to do.
          </p>
          <p style="margin:0 0 24px;line-height:1.6;">
            If it wasn't, change your password now and the other sessions will be signed out with it.
          </p>
          <a href="${APP_URL}/settings"
             style="display:inline-block;background:#6366f1;color:#fff;text-decoration:none;padding:11px 20px;border-radius:10px;font-weight:600;font-size:14px;">
            Review account settings
          </a>
          <p style="margin:24px 0 0;color:#64748b;font-size:13px;line-height:1.6;">
            Reply to this email if anything looks wrong and I'll take a look.<br/>
            ${escapeHtml(SENDER_NAME)}
          </p>
        </div>
      `,
      text:
        `Your Preciprocal account was just signed in to on ${device}` +
        `${location ? ` from ${location}` : ""}.\n\n` +
        `Preciprocal keeps you signed in on up to ${MAX_CONCURRENT_SESSIONS} devices at once, ` +
        `so your oldest session was signed out to make room. If that was you, there's nothing to do.\n\n` +
        `If it wasn't, change your password now and the other sessions will be signed out with it:\n` +
        `${APP_URL}/settings\n\n` +
        `Reply to this email if anything looks wrong.\n${SENDER_NAME}`,
    });
  } catch (err) {
    console.error("⚠️ Failed to send new-device email (non-fatal):", err);
  }
}

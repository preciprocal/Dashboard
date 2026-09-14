// lib/email/welcome.ts
// One-time welcome email, sent after a new account's email address is verified
// (app/auth/confirm/route.ts) or immediately for OAuth signups, whose address
// Google has already verified (lib/actions/auth.action.ts).
//
// Written as a note from a person on the team rather than a marketing blast:
// named sender, working reply-to, restrained markup. Replies land in a human
// inbox, which is the point - it's the cheapest onboarding feedback channel
// there is.
//
// SENDER_NAME is a team persona, not a specific individual, so the copy
// deliberately makes no claim about who is behind it beyond "someone here
// reads this". Whoever staffs the reply inbox signs as the same name; keep
// these three values in sync if it ever changes.
import { Resend } from "resend";
import { SITE } from "@/lib/seo";
import { supabaseAdmin } from "@/supabase/admin";

const resend = new Resend(process.env.RESEND_API_KEY);

const SENDER_NAME = process.env.WELCOME_EMAIL_SENDER_NAME ?? "Francesca";
const FROM = process.env.WELCOME_EMAIL_FROM ?? `${SENDER_NAME} from Preciprocal <francesca@preciprocal.com>`;
const REPLY_TO = process.env.WELCOME_EMAIL_REPLY_TO ?? "francesca@preciprocal.com";

// NEXT_PUBLIC_APP_URL is http://localhost:3000 in local dev, and a localhost
// link in a real inbox is dead on arrival - fall back to the canonical app
// origin unless the env var points somewhere externally reachable.
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

/** "Bruce Wayne" -> "Bruce". Falls back to a greeting that still reads naturally. */
function firstName(name: string | null | undefined) {
  const first = (name ?? "").trim().split(/\s+/)[0];
  return first.length > 0 && first.length <= 40 ? first : "there";
}

interface WelcomeEmailParams {
  userId: string;
  email: string;
  name?: string | null;
}

// `short` feeds the three-column HTML grid, where each column is only ~170px
// wide; `body` is the full sentence, used in the plain-text part where there's
// no such constraint.
const STARTERS = [
  {
    href: `${APP_URL}/resume/upload`,
    title: "Resume Analysis",
    short: "ATS score, missing keywords, and how a recruiter reads your page.",
    body: "You'll get an ATS score, the keywords you're missing for the roles you want, and a read on how a recruiter actually sees the page.",
  },
  {
    href: `${APP_URL}/interview`,
    title: "Mock Interviews",
    short: "Real voice, real follow-ups, scored feedback at the end.",
    body: "Real voice, real follow-up questions, and scored feedback at the end on what landed and what didn't.",
  },
  {
    href: `${APP_URL}/planner/create`,
    title: "Study Plans",
    short: "Your role and timeline, mapped to what to work on next.",
    body: "Tell it the role and your timeline, and it maps out what to work on between now and the interview.",
  },
];

// Light cards floating on the brand gradient. Light rather than dark on
// purpose: Outlook for Windows ignores color-scheme and force-lightens dark
// backgrounds, so a dark build renders as flat grey there. A light design
// survives that same transform intact.
const C = {
  grad1: "#667eea", // --accent
  grad2: "#764ba2", // --accent-2
  gradSolid: "#6e64c6", // midpoint, used wherever gradients aren't supported
  card: "#ffffff",
  heading: "#1e1e2e",
  body: "#64748b",
  muted: "#94a3b8",
  hairline: "#eef1f6",
} as const;

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

// The marketing site's copy of the mark: 256x256 transparent PNG at 15KB.
// public/logo.png is the same artwork at 1024x1024 and 1.4MB, far too heavy
// for an inbox. 256px gives ample headroom at the 64px display size.
const LOGO_URL = `${SITE.marketing}/logo.png`;
// Feature-showcase banner, served from this repo's public/. Generated from
// public/Email Banner.png (1434x1097, 1.7MB) down to 1040x796 JPEG at 219KB:
// the original is far too heavy for an inbox, and its filename contains a
// space, which has to be percent-encoded in a URL. Displayed at 520px wide, so
// 1040 is a clean 2x for retina.
const HERO_URL = `${SITE.app}/email-banner.jpg`;

// Every gradient carries a matching background-color: Outlook on Windows uses
// the Word engine, which ignores background-image entirely and would otherwise
// render these as transparent.
const GRADIENT = (deg: string) =>
  `background-color:${C.gradSolid};background-image:linear-gradient(${deg},${C.grad1} 0%,${C.grad2} 100%);`;

/** One white rounded card, plus the vertical gap separating it from the next. */
const card = (inner: string, padding = "40px") => `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;">
          <tr>
            <td style="background-color:${C.card};border-radius:14px;padding:${padding};font-family:${FONT};">
${inner}
            </td>
          </tr>
        </table>
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;width:100%;">
          <tr><td height="18" style="height:18px;line-height:18px;font-size:0;">&nbsp;</td></tr>
        </table>`;

function buildHtml(name: string) {
  const greeting = escapeHtml(firstName(name));

  // Gradient numbered tiles rather than icon images: remote images are blocked
  // by default in Gmail and Outlook, and inline SVG is stripped by both. The
  // logo and hero above are worth that risk; three small icons are not, and
  // table cells with a background gradient always render.
  const features = STARTERS.map(
    (item, i) => `
                    <td width="33%" valign="top" style="padding:0 ${i === 2 ? "0" : "16px"} 0 0;font-family:${FONT};">
                      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="padding:0 0 14px;">
                        <tr>
                          <td align="center" height="46" style="width:46px;height:46px;border-radius:12px;${GRADIENT("135deg")}font-family:${FONT};font-size:18px;font-weight:700;color:#ffffff;line-height:46px;">${i + 1}</td>
                        </tr>
                      </table>
                      <a href="${item.href}" style="display:block;font-size:16px;font-weight:700;line-height:22px;color:${C.heading};text-decoration:none;padding:0 0 7px;">${item.title}</a>
                      <span style="font-size:13px;line-height:21px;color:${C.body};">${item.short}</span>
                    </td>`
  ).join("");

  const heroCard = `
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center" style="padding:0 0 24px;">
                    <img src="${LOGO_URL}" width="64" height="64" alt="Preciprocal" style="display:block;width:64px;height:64px;border:0;outline:none;text-decoration:none;">
                  </td>
                </tr>
              </table>

              <h1 style="margin:0 0 28px;font-size:33px;line-height:41px;font-weight:800;letter-spacing:-0.8px;color:${C.heading};text-align:center;">
                Welcome to Preciprocal
              </h1>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center" style="padding:0 0 28px;">
                    <a href="${APP_URL}" style="text-decoration:none;">
                      <img src="${HERO_URL}" width="520" height="398" alt="Preciprocal: AI mock interviews, resume analysis, cover letters, job tracker, study plans and the browser extension" style="display:block;width:100%;max-width:520px;height:auto;border:0;outline:none;text-decoration:none;border-radius:10px;">
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 28px;font-size:16px;line-height:26px;color:${C.body};text-align:center;">
                Hi ${greeting}, your account is live. Preciprocal gives you
                <strong style="color:${C.heading};font-weight:700;">AI mock interviews, ATS resume scoring, and personalised study plans</strong>
                in one place, so you walk in prepared instead of hoping.
              </p>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center">
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${APP_URL}" style="height:52px;v-text-anchor:middle;width:240px;" arcsize="19%" stroke="f" fillcolor="${C.grad1}">
                      <v:fill type="gradient" color="${C.grad1}" color2="${C.grad2}" angle="135"/>
                      <w:anchorlock/>
                      <center style="color:#ffffff;font-family:${FONT};font-size:16px;font-weight:700;">Open Preciprocal</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-- -->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center" bgcolor="${C.gradSolid}" style="border-radius:10px;${GRADIENT("135deg")}">
                          <a href="${APP_URL}" style="display:inline-block;padding:16px 38px;font-family:${FONT};font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">Open Preciprocal</a>
                        </td>
                      </tr>
                    </table>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>`;

  const featureCard = `
              <h2 style="margin:0 0 16px;font-size:25px;line-height:32px;font-weight:800;letter-spacing:-0.4px;color:${C.heading};">
                Start here
              </h2>

              <p style="margin:0 0 32px;font-size:15px;line-height:26px;color:${C.body};">
                Most candidates are qualified, but few are prepared. These three close that gap fastest,
                and they take about ten minutes between them.
              </p>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>${features}
                </tr>
              </table>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:34px 0 0;">
                <tr><td height="1" style="height:1px;line-height:1px;font-size:0;background-color:${C.hairline};">&nbsp;</td></tr>
              </table>

              <p style="margin:30px 0 20px;font-size:15px;line-height:26px;color:${C.body};">
                One more thing. This goes to a real person, not a noreply box. If something is broken,
                confusing, or missing, just hit reply and tell me. I read every one, and a fair amount
                of what is in the product came out of replies like that.
              </p>

              <p style="margin:0 0 2px;font-size:15px;font-weight:700;line-height:22px;color:${C.heading};">${SENDER_NAME}</p>
              <p style="margin:0;font-size:13px;line-height:20px;color:${C.muted};">Preciprocal</p>`;

  const footerCard = `
              <p style="margin:0 0 10px;font-size:12px;line-height:20px;color:${C.muted};text-align:center;">
                You are getting this because you created a Preciprocal account.
              </p>
              <p style="margin:0;font-size:12px;line-height:20px;color:${C.muted};text-align:center;">
                <a href="${SITE.marketing}" style="color:${C.grad1};text-decoration:none;">Preciprocal</a>
                &nbsp;&middot;&nbsp;
                <a href="${SITE.marketing}/privacy" style="color:${C.grad1};text-decoration:none;">Privacy</a>
                &nbsp;&middot;&nbsp;
                <a href="${SITE.marketing}/terms" style="color:${C.grad1};text-decoration:none;">Terms</a>
              </p>`;

  return `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Welcome to Preciprocal</title>
  <style>:root{color-scheme:light;supported-color-schemes:light;}</style>
  <!--[if mso]>
  <xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${C.gradSolid};">
  <!-- Outlook cannot render a CSS gradient, but VML can. This paints the page
       behind the cards there; every other client uses background-image below. -->
  <!--[if mso]>
  <v:background xmlns:v="urn:schemas-microsoft-com:vml" fill="t">
    <v:fill type="gradient" color="${C.grad1}" color2="${C.grad2}" angle="180"/>
  </v:background>
  <![endif]-->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your account is live. Here is where to start, and how to reach me.</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${C.gradSolid};background-image:linear-gradient(160deg,${C.grad1} 0%,${C.grad2} 100%);">
    <tr>
      <td align="center" style="padding:36px 16px;">
${card(heroCard, "42px 40px 46px")}
${card(featureCard)}
${card(footerCard, "26px 40px")}
      </td>
    </tr>
  </table>
</body>
</html>`;
}


function buildText(name: string) {
  return `Hi ${firstName(name)},

Welcome to Preciprocal - your account is live, and I wanted to say hello properly.

Preciprocal exists because of a gap we kept running into: most candidates are qualified, but few are prepared. The resume gets filtered out before a human ever reads it. The interview arrives before the practice does. Everything in here is built to close that gap.

If you're not sure where to start, these three do the most in the first ten minutes:

1. Upload your resume - you'll get an ATS score, the keywords you're missing for the roles you want, and a read on how a recruiter actually sees the page.
   ${STARTERS[0].href}

2. Run a mock interview - real voice, real follow-up questions, and scored feedback at the end on what landed and what didn't.
   ${STARTERS[1].href}

3. Build a study plan - tell it the role and your timeline, and it maps out what to work on between now and the interview.
   ${STARTERS[2].href}

Open Preciprocal: ${APP_URL}

One more thing: this goes to a real person, not a noreply box. If something is broken, confusing, or missing, just hit reply and tell me. I read every one, and a fair amount of what's in the product came out of replies like that.

Glad you're here.

${SENDER_NAME}
Preciprocal

---
You're getting this because you created a Preciprocal account.
Privacy: ${SITE.marketing}/privacy
Terms: ${SITE.marketing}/terms`;
}

/**
 * Subject + both body parts for a given recipient name. Exported so the email
 * can be rendered and eyeballed (scripts/preview-welcome-email.ts) without
 * sending anything or touching the database.
 */
export function buildWelcomeEmail(name?: string | null) {
  return {
    subject: `Welcome to Preciprocal, ${firstName(name)}`,
    html: buildHtml(name ?? ""),
    text: buildText(name ?? ""),
  };
}

/**
 * Send the welcome email, at most once per user.
 *
 * Never throws and never blocks the caller's success path - a failed welcome
 * email must not turn a successful signup or verification into an error. On
 * send failure the claim is released so a later verification attempt can retry.
 */
export async function sendWelcomeEmail({ userId, email, name }: WelcomeEmailParams) {
  if (!process.env.RESEND_API_KEY) {
    console.warn("⚠️ RESEND_API_KEY not set - skipping welcome email for", email);
    return;
  }

  try {
    const { data: claimed, error: claimError } = await supabaseAdmin.rpc("claim_welcome_email", {
      p_user_id: userId,
    });
    if (claimError) throw claimError;
    if (!claimed) return; // already sent, or profile row not there yet

    const { error: sendError } = await resend.emails.send({
      from: FROM,
      to: email,
      replyTo: REPLY_TO,
      ...buildWelcomeEmail(name),
    });
    if (sendError) throw sendError;

    console.log(`📧 Welcome email sent - ${email}`);
  } catch (error) {
    console.error("❌ Failed to send welcome email:", error);
    // Release the claim so the next verification attempt can try again.
    await supabaseAdmin
      .from("profiles")
      .update({ welcome_email_sent_at: null })
      .eq("user_id", userId);
  }
}

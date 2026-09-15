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

// Plain white, borderless, full width. No cards, no tinted page background,
// no rules except the one above the footer. The copy carries the email, so the
// type is sized to be read rather than skimmed: 17px at 29px leading, and a
// body colour dark enough (slate-600) to hold attention rather than reading as
// a caption.
const C = {
  // Brand gradient (--accent #667eea / --accent-2 #764ba2) darkened by roughly
  // 15%. At the original values white body text lands near 3.3:1 against the
  // light end, under the 4.5:1 needed to read comfortably; these stops clear it
  // at both ends while staying recognisably the same purple.
  grad1: "#5a4fd0",
  grad2: "#6b3f96",
  gradSolid: "#62479f", // midpoint, used wherever gradients aren't supported
  heading: "#ffffff",
  body: "#f0edfc",
  muted: "#c3bbe4",
  hairline: "#7d6fb8",
  onAccent: "#4a3fb0", // purple text sitting on a white chip or button
} as const;

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

// Email artwork is served from the public `email-assets` Supabase Storage
// bucket rather than from public/ in this repo. Two reasons: the artwork goes
// live without waiting on a deploy, and it can be swapped later without
// shipping code. Set WELCOME_EMAIL_ASSET_BASE to `https://app.preciprocal.com`
// to serve the committed copies from the app domain instead.
//
// There is no failover between the two. HTML email has no image fallback
// mechanism: clients strip onerror, and srcset/<picture> select on resolution,
// not on failure. An <img> resolves exactly one URL, so this is a switch, not
// a chain.
//
// Filenames are versioned by size because objects are uploaded with
// `immutable` cache-control - overwriting a key leaves the CDN serving the old
// bytes indefinitely. Changing artwork means a new filename.
const ASSET_BASE =
  process.env.WELCOME_EMAIL_ASSET_BASE ??
  `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/email-assets`;

/** 128x128 transparent PNG, 5.5KB. Displayed at 40px, so well over 2x. */
const LOGO_URL = `${ASSET_BASE}/logo-128.png`;
/** 1040x796 JPEG, 219KB. Sits in the left column of the hero at ~480px. */
const HERO_URL = `${ASSET_BASE}/email-banner.jpg`;

// Every gradient carries a matching background-color: Outlook on Windows uses
// the Word engine, which ignores background-image entirely and would otherwise
// render these as transparent.
const GRADIENT = (deg: string) =>
  `background-color:${C.gradSolid};background-image:linear-gradient(${deg},${C.grad1} 0%,${C.grad2} 100%);`;

function buildHtml(name: string) {
  const greeting = escapeHtml(firstName(name));

  // Gradient numbered tiles rather than icon images: remote images are blocked
  // by default in Gmail and Outlook, and inline SVG is stripped by both, so
  // icons would be broken boxes for a large share of recipients. Table cells
  // with a background gradient always render.
  const features = STARTERS.map(
    (item, i) => `
                <td width="33%" valign="top" class="col${i === 2 ? " col-last" : ""}" style="padding:0 ${i === 2 ? "0" : "28px"} 0 0;font-family:${FONT};">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="padding:0 0 16px;">
                    <tr>
                      <td align="center" height="44" bgcolor="#ffffff" style="width:44px;height:44px;border-radius:12px;background-color:#ffffff;font-family:${FONT};font-size:17px;font-weight:700;color:${C.onAccent};line-height:44px;">${i + 1}</td>
                    </tr>
                  </table>
                  <a href="${item.href}" style="display:block;font-size:18px;font-weight:700;line-height:25px;color:${C.heading};text-decoration:none;padding:0 0 8px;">${item.title}</a>
                  <span style="font-size:16px;line-height:26px;color:${C.body};">${item.short}</span>
                </td>`
  ).join("");

  return `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Welcome to Preciprocal</title>
  <style>
    :root{color-scheme:light;supported-color-schemes:light;}
    /* Honoured by Apple Mail, iOS, Gmail (web and app) and most modern clients.
       Outlook for Windows ignores <style> and falls back to the fixed table
       widths in the markup, which is correct there - it has no narrow viewport. */
    @media only screen and (max-width:700px) {
      .wrap      { padding:28px 22px !important; }
      .h1        { font-size:30px !important; line-height:38px !important; }
      .h2        { font-size:23px !important; line-height:31px !important; }
      .lede      { font-size:17px !important; line-height:28px !important; }
      /* Table cells cannot wrap, so each half/third is promoted to a block. */
      .half, .col { display:block !important; width:100% !important; max-width:100% !important; padding:0 0 26px 0 !important; }
      .col-last  { padding-bottom:0 !important; }
      .gutter    { display:none !important; width:0 !important; }
      .heroimg   { margin-bottom:26px !important; }
      .btn a     { display:block !important; text-align:center !important; }
    }
  </style>
  <!--[if mso]>
  <xml><o:OfficeDocumentSettings><o:AllowPNG/><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:${C.gradSolid};">
  <!--[if mso]>
  <v:background xmlns:v="urn:schemas-microsoft-com:vml" fill="t">
    <v:fill type="gradient" color="${C.grad1}" color2="${C.grad2}" angle="180"/>
  </v:background>
  <![endif]-->
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">The market is brutal right now. Here is the order that actually works.</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:${C.gradSolid};background-image:linear-gradient(165deg,${C.grad1} 0%,${C.grad2} 100%);">
    <tr>
      <td align="center" style="padding:0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:1100px;width:100%;">
          <tr>
            <td class="wrap" style="padding:44px 40px;font-family:${FONT};">

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="padding:0 0 38px;">
                <tr>
                  <td width="40" valign="middle" style="padding:0 12px 0 0;">
                    <img src="${LOGO_URL}" width="40" height="40" alt="" style="display:block;width:40px;height:40px;border:0;outline:none;">
                  </td>
                  <td valign="middle" style="font-family:${FONT};font-size:18px;font-weight:700;letter-spacing:-0.2px;color:${C.heading};">Preciprocal</td>
                </tr>
              </table>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td width="46%" valign="middle" class="half heroimg" style="padding:0;">
                    <a href="${APP_URL}" style="display:block;text-decoration:none;font-size:0;line-height:0;">
                      <img src="${HERO_URL}" width="480" height="367" alt="Preciprocal feature overview" style="display:block;width:100%;max-width:520px;height:auto;border:0;outline:none;border-radius:12px;color:${C.body};font-family:${FONT};font-size:14px;line-height:22px;">
                    </a>
                  </td>
                  <td width="6%" class="gutter" style="font-size:0;line-height:0;">&nbsp;</td>
                  <td width="48%" valign="middle" class="half" style="padding:0;font-family:${FONT};">
                    <h1 class="h1" style="margin:0 0 20px;font-size:38px;line-height:46px;font-weight:800;letter-spacing:-1px;color:${C.heading};">
                      Welcome to Preciprocal
                    </h1>
                    <p class="lede" style="margin:0 0 18px;font-size:19px;line-height:31px;color:${C.body};">
                      Hi ${greeting}, let me be straight with you about why this exists.
                    </p>
                    <p class="lede" style="margin:0;font-size:19px;line-height:31px;color:${C.body};">
                      The market right now is brutal, and it is not in your head.
                    </p>
                  </td>
                </tr>
              </table>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:40px 0 0;">
                <tr>
                  <td style="font-family:${FONT};">
                    <p style="margin:0 0 22px;font-size:17px;line-height:29px;color:${C.body};">
                      Postings collect hundreds of applicants within hours. Most resumes are scored by software
                      before a person opens them. Plenty of genuinely qualified people go months without a
                      callback and start assuming something is wrong with them. Usually there is not. The
                      process is just badly broken.
                    </p>
                    <p style="margin:0 0 44px;font-size:17px;line-height:29px;color:${C.body};">
                      What actually changes the outcome is narrower than most people expect, and it is the same
                      pattern almost every time.
                    </p>
                  </td>
                </tr>
              </table>

              <h2 class="h2" style="margin:0 0 14px;font-size:27px;line-height:35px;font-weight:800;letter-spacing:-0.5px;color:${C.heading};">
                The three steps, in order
              </h2>
              <p style="margin:0 0 38px;font-size:17px;line-height:29px;color:${C.body};">
                The people who get traction here work through these in sequence rather than all at once.
                The order matters more than the effort.
              </p>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>${features}
                </tr>
              </table>

              <p style="margin:44px 0 36px;font-size:17px;line-height:29px;color:${C.body};">
                <strong style="color:#ffffff;font-weight:700;">Start with the resume.</strong>
                If it is not clearing the filter, nothing after it gets a chance to matter. That one usually
                takes about ten minutes and changes the most.
              </p>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 44px;">
                <tr>
                  <td>
                    <!--[if mso]>
                    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${APP_URL}" style="height:54px;v-text-anchor:middle;width:250px;" arcsize="19%" stroke="f" fillcolor="#ffffff">
                      <w:anchorlock/>
                      <center style="color:${C.onAccent};font-family:${FONT};font-size:17px;font-weight:700;">Open Preciprocal</center>
                    </v:roundrect>
                    <![endif]-->
                    <!--[if !mso]><!-- -->
                    <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center" bgcolor="#ffffff" class="btn" style="border-radius:10px;background-color:#ffffff;">
                          <a href="${APP_URL}" style="display:inline-block;padding:17px 40px;font-family:${FONT};font-size:17px;font-weight:700;color:${C.onAccent};text-decoration:none;border-radius:10px;">Open Preciprocal</a>
                        </td>
                      </tr>
                    </table>
                    <!--<![endif]-->
                  </td>
                </tr>
              </table>

              <p style="margin:0 0 22px;font-size:17px;line-height:29px;color:${C.body};">
                One more thing. This goes to a real person, not a noreply box. If you are stuck, or the search
                is wearing you down, reply and tell me where you are at. I read every one, and I would rather
                hear from you early than after three more months of silence.
              </p>

              <p style="margin:0 0 30px;font-size:17px;line-height:29px;color:${C.body};">
                You are closer than it feels right now.
              </p>

              <p style="margin:0 0 3px;font-size:17px;font-weight:700;line-height:25px;color:${C.heading};">${SENDER_NAME}</p>
              <p style="margin:0 0 44px;font-size:15px;line-height:23px;color:${C.muted};">Preciprocal</p>

              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr><td height="1" style="height:1px;line-height:1px;font-size:0;background-color:${C.hairline};">&nbsp;</td></tr>
              </table>

              <p style="margin:26px 0 8px;font-size:13px;line-height:21px;color:${C.muted};">
                You are getting this because you created a Preciprocal account.
              </p>
              <p style="margin:0;font-size:13px;line-height:21px;color:${C.muted};">
                <a href="${SITE.marketing}" style="color:#ffffff;text-decoration:underline;">Preciprocal</a>
                &nbsp;&middot;&nbsp;
                <a href="${SITE.marketing}/privacy" style="color:#ffffff;text-decoration:underline;">Privacy</a>
                &nbsp;&middot;&nbsp;
                <a href="${SITE.marketing}/terms" style="color:#ffffff;text-decoration:underline;">Terms</a>
              </p>

            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}


function buildText(name: string) {
  return `Hi ${firstName(name)},

Welcome to Preciprocal. Let me be straight with you about why it exists.

The market right now is brutal, and it is not in your head. Postings collect hundreds of applicants within hours. Most resumes are scored by software before a person opens them. Plenty of genuinely qualified people go months without a callback and start assuming something is wrong with them. Usually there is not. The process is just badly broken.

What actually changes the outcome is narrower than most people expect, and it is the same pattern almost every time. The people who get traction here work through these in sequence rather than all at once. The order matters more than the effort.

1. ${STARTERS[0].title} - ${STARTERS[0].body}
   ${STARTERS[0].href}

2. ${STARTERS[1].title} - ${STARTERS[1].body}
   ${STARTERS[1].href}

3. ${STARTERS[2].title} - ${STARTERS[2].body}
   ${STARTERS[2].href}

Start with the resume. If it is not clearing the filter, nothing after it gets a chance to matter. That one usually takes about ten minutes and changes the most.

Open Preciprocal: ${APP_URL}

One more thing. This goes to a real person, not a noreply box. If you are stuck, or the search is wearing you down, reply and tell me where you are at. I read every one, and I would rather hear from you early than after three more months of silence.

You are closer than it feels right now.

${SENDER_NAME}
Preciprocal

---
You are getting this because you created a Preciprocal account.
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

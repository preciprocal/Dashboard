// lib/email/welcome.ts
// One-time welcome email, sent after a new account's email address is verified
// (app/auth/confirm/route.ts) or immediately for OAuth signups, whose address
// Google has already verified (lib/actions/auth.action.ts).
//
// The copy is written to land emotionally rather than to read as a feature
// list: it names the silence a job seeker is living with, then shows what
// changes. What survived from the earlier, deliberately understated version is
// the part that matters - a named sender, a working reply-to, and no claim we
// cannot back. Replies land in a human inbox, which is still the cheapest
// onboarding feedback channel there is.
//
// The sender, her role and her signature live in lib/email/sender.ts, shared
// with every other email she signs.
import { Resend } from "resend";
import { supabaseAdmin } from "@/supabase/admin";
import { renderEmail, renderText, escapeHtml, firstName } from "@/lib/email/layout";
import { emailAppUrl } from "@/lib/email/app-url";
import { SENDER_FROM as FROM, SENDER_REPLY_TO as REPLY_TO, senderSignature } from "@/lib/email/sender";
import { recordEmailSend } from "@/lib/email/track";
import {
  unsubscribeUrl,
  unsubscribeHeaders,
  unsubscribeFooterHtml,
  unsubscribeFooterText,
} from "@/lib/email/unsubscribe";

const resend = new Resend(process.env.RESEND_API_KEY);


// Shared with every other email sender - see lib/email/app-url.ts.
const APP_URL = emailAppUrl();

interface WelcomeEmailParams {
  userId: string;
  email: string;
  name?: string | null;
}

// Each entry leads with the PAIN, not the feature name. "Resume Analysis"
// tells a new user nothing; "most applications are filtered before a person
// sees them" tells them why they should care, and the feature arrives as the
// answer to a question they are already asking themselves.
//
// ─── On naming competitors ──────────────────────────────────────────────────
// Comparative advertising is legal and the FTC actively encourages it, but the
// claim has to be TRUTHFUL and SUBSTANTIABLE. "Nobody else can do this" is the
// one phrasing that is genuinely actionable, because it is unfalsifiable and
// disparaging at the same time.
//
// So the copy below makes a STRUCTURAL claim instead, which is both defensible
// and more persuasive: a scoring tool never learns what happened to the resume
// after you sent it, because it never sees the application. That is a fact
// about what data those products hold, not an opinion about their quality, and
// it is the actual reason our feedback differs.
//
// Keep it that way. If this ever drifts back to "better than X", it becomes a
// claim we would have to defend with evidence we do not have.
const STARTERS = [
  {
    icon: "01",
    href: `${APP_URL}/resume/upload`,
    title: "Find out why it is being filtered out",
    short:
      "Before a person reads your resume, it often has to get past software that screens it first. Upload the resume you have been sending and you will see your ATS score, the keywords you are missing for the roles you want, and how it reads to a recruiter at first glance.",
    cta: "Analyse my resume",
  },
  {
    icon: "02",
    href: `${APP_URL}/interview`,
    title: "Say it out loud before it counts",
    short:
      "The first time you answer \"tell me about yourself\" should not be in the interview that matters. Practise against a voice interviewer that asks follow-up questions and pushes back on vague answers, then read the scored feedback on what landed and what did not.",
    cta: "Start a mock interview",
  },
  {
    icon: "03",
    href: `${APP_URL}/cover-letter/create`,
    title: "Stop rewriting the same letter twelve times",
    short:
      "Paste the job description and get a first draft written for that specific role, ready for you to edit. The hours you get back go into the applications actually worth tailoring.",
    cta: "Write a cover letter",
  },
  {
    icon: "04",
    href: `${APP_URL}/job-tracker`,
    title: "Learn which version is actually working",
    short:
      "A resume score on its own cannot tell you this, because it never sees what happened after you hit send. Preciprocal tracks the resume alongside the application, so after a handful of applications you find out which version is getting callbacks and which one has been quietly costing you interviews.",
    cta: "Open my tracker",
  },
];

// ─── Rendering ───────────────────────────────────────────────────────────────
//
// The shared dark shell (lib/email/layout.ts) carrying copy written to land
// emotionally: name the silence a job seeker is living with, then show what
// changes. Numbered badges rather than image icons - see PanelRow.icon in the
// layout for why an image-based icon set is the wrong call in email.

// ─── The subject line is "Congratulations!", and that is a deliberate hook ──
//
// It is the exact subject a job seeker is waiting for from an employer, which
// is why it gets opened. It is also why the FIRST line has to own the twist
// rather than dance around it: an email that mimics the thing someone is
// desperate for and then pretends otherwise earns resentment, not attention.
//
// The preheader does the same work in the inbox, before the open. Between the
// two, the reader is never actually misled - they are told the joke is on the
// situation, not on them, and that recognition is the emotional hook.
//
// If this ever starts drawing spam complaints, the subject is the first thing
// to change. See the note in buildWelcomeEmail.
const OPENING = [
  "Almost certainly not. You have been waiting for that subject line from a company you applied to, and so far it has not arrived.",
  "That is exactly why you are here, and exactly what Preciprocal is built to change.",
  "The hardest part of a job search is not rejection. A rejection at least tells you something. It is the silence, because silence teaches you nothing at all, and you cannot fix what nobody will tell you is broken.",
  "So this is not about firing off more applications faster. It is about finally knowing what happens to the ones you send.",
];

const CLOSING =
  "You do not need all of it today. Do one thing: upload the resume you have been sending out. A few minutes from now you will have a clearer picture of why it might not be landing than silence will ever give you.";

const SIGNATURE = senderSignature(
  // Reads as a commitment rather than a casual aside, but stays a promise we
  // can actually keep: REPLY_TO is a monitored human inbox, not a no-reply.
  // The moment that stops being true this line has to go, because it is the
  // single most trust-bearing sentence in the email.
  "Every reply to this address reaches me directly. If anything is unclear, " +
  "or the product does not work the way you expect, please write back and I " +
  "will look into it personally.",
);

function buildHtml(name: string, unsubscribe?: string) {
  return renderEmail({
    campaign: "welcome",
    // Carries the turn in the inbox preview, so the subject never reads as a
    // straight bait. The reader sees both lines before deciding to open.
    preheader: "Not the one you were hoping for. Let us change that.",
    eyebrow: "Welcome to Preciprocal",
    heading: "Is this the email you have been waiting for?",
    paragraphs: [
      `Hi ${escapeHtml(firstName(name))},`,
      ...OPENING.map(escapeHtml),
      "Here is where to start.",
    ],
    panel: {
      title: "Four things that change immediately",
      rows: STARTERS.map(s => ({
        icon: s.icon,
        label: s.title,
        value: escapeHtml(s.short),
        link: { label: s.cta, url: s.href },
      })),
    },
    closing: escapeHtml(CLOSING),
    cta: { label: "Let's start by fixing my resume", url: `${APP_URL}/resume/upload` },
    signature: SIGNATURE,
    footerNote: "You are receiving this because you created a Preciprocal account.",
    footerExtraHtml: unsubscribe ? unsubscribeFooterHtml(unsubscribe, "all") : undefined,
  });
}

function buildText(name: string, unsubscribe?: string) {
  return renderText({
    campaign: "welcome",
    heading: "Is this the email you have been waiting for?",
    paragraphs: [`Hi ${firstName(name)},`, ...OPENING, "Here is where to start."],
    panel: {
      title: "Four things that change immediately",
      lines: STARTERS.flatMap(s => [
        `${s.icon}. ${s.title}`,
        `    ${s.short}`,
        `    ${s.cta}: ${s.href}`,
        "",
      ]),
    },
    closing: CLOSING,
    cta: { label: "Let's start by fixing my resume", url: `${APP_URL}/resume/upload` },
    signature: SIGNATURE,
    footerNote: unsubscribe
      ? `You created a Preciprocal account.
${unsubscribeFooterText(unsubscribe, "all")}`
      : "You created a Preciprocal account.",
  });
}

/**
 * Subject and both body parts for a given recipient name. Exported so the
 * email can be rendered and eyeballed (scripts/preview-welcome-email.ts)
 * without sending anything or touching the database.
 *
 * `unsubscribe` is optional only so the preview can omit it. Every real send
 * passes one: the welcome email is the first mail a new account gets, and the
 * place to learn that the rest of it can be switched off.
 */
export function buildWelcomeEmail(name?: string | null, unsubscribe?: string) {
  return {
    // Deliberately the subject line every job seeker is waiting for. The
    // heading and preheader both own the turn immediately, so the reader is
    // never left feeling tricked.
    //
    // Two costs worth watching. A one-word celebratory subject with an
    // exclamation mark is a pattern spam classifiers weight against, and a
    // high open rate followed by immediate deletes is itself a negative
    // reputation signal. If Resend starts reporting complaints or the open-to-
    // click gap widens, change this before changing anything else.
    subject: "Congratulations!",
    html: buildHtml(name ?? "", unsubscribe),
    text: buildText(name ?? "", unsubscribe),
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

    const unsubscribe = unsubscribeUrl(userId, "all");
    const built = buildWelcomeEmail(name, unsubscribe);
    const { data: sent, error: sendError } = await resend.emails.send({
      from: FROM,
      to: email,
      replyTo: REPLY_TO,
      headers: unsubscribeHeaders(unsubscribe),
      ...built,
    });
    if (sendError) throw sendError;
    await recordEmailSend({ resendId: sent?.id, userId, emailType: "welcome", subject: built.subject });

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

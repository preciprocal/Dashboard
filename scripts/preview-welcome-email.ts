// Renders the welcome email to an HTML file so it can be opened in a browser,
// and prints the plain-text part. Sends nothing and touches no database.
//
//   npx tsx --env-file=.env.local scripts/preview-welcome-email.ts [name]
//
// Pass --send <address> to send one real email to yourself through Resend,
// bypassing the once-per-user claim (useful for checking rendering in a real
// client and confirming the from-address is verified on the domain).
import { writeFileSync } from "fs";
import { resolve } from "path";
import { buildWelcomeEmail } from "../lib/email/welcome";

async function main() {
  const args = process.argv.slice(2);
  const sendIndex = args.indexOf("--send");
  const sendTo = sendIndex === -1 ? null : args[sendIndex + 1];
  const name = args.filter((a, i) => !a.startsWith("--") && i !== sendIndex + 1)[0] ?? "Bruce Wayne";

  const { subject, html, text } = buildWelcomeEmail(name);

  // Point the local preview at public/ on disk. Assets only reach their real
  // URLs once deployed, so without this the browser preview shows a broken
  // image for anything added since the last deploy. The sent email is
  // untouched and keeps the absolute URLs.
  const outPath = resolve(process.cwd(), "welcome-email-preview.html");
  const localHtml = html.replace(
    /https:\/\/(?:app\.)?preciprocal\.com\/([\w.-]+\.(?:png|jpe?g|gif|webp))/g,
    "public/$1"
  );
  writeFileSync(outPath, localHtml, "utf8");

  console.log(`Subject: ${subject}\n`);
  console.log(text);
  console.log(`\n---\nHTML written to ${outPath} - open it in a browser.`);

  if (!sendTo) return;

  if (!process.env.RESEND_API_KEY) {
    console.error("\n✗ RESEND_API_KEY not set - cannot send.");
    process.exit(1);
  }

  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);
  const senderName = process.env.WELCOME_EMAIL_SENDER_NAME ?? "Francesca";
  const from = process.env.WELCOME_EMAIL_FROM ?? `${senderName} from Preciprocal <francesca@preciprocal.com>`;
  const replyTo = process.env.WELCOME_EMAIL_REPLY_TO ?? "francesca@preciprocal.com";

  // Test sends carry a unique subject prefix so they never thread with each
  // other - or with a real welcome email - in the recipient's inbox. Gmail
  // groups by subject, and successive tests are otherwise indistinguishable.
  const stamp = new Date().toISOString().slice(11, 16);
  const testSubject = `[test ${stamp}] ${subject}`;

  const { data, error } = await resend.emails.send({
    from,
    to: sendTo,
    replyTo,
    subject: testSubject,
    html,
    text,
  });
  if (error) {
    console.error(`\n✗ Send failed:`, error);
    process.exit(1);
  }
  console.log(`\n✓ Sent to ${sendTo} from ${from} (id: ${data?.id})`);
}

main();

// lib/email/layout.ts
// One dark transactional shell for every email the product sends.
//
// Every sender used to hand-roll its own markup, which meant six different
// interpretations of the brand and six places for a dark-mode bug to hide.
// This is the single template; senders supply content, never chrome.
//
// ─── FIVE THINGS THAT ARE LOAD-BEARING - do not "tidy" these away ───────────
//
// 1. TWO SEPARATE <style> BLOCKS. Gmail does not support @import and discards
//    the entire <style> element containing one. When the webfont @import
//    shared a block with the colour rules, Gmail binned the colour rules too
//    and rendered black text on a black card. Keep @import alone in block one.
//
// 2. background-image:linear-gradient(X,X) ALONGSIDE background-color:X.
//    Gmail's mobile apps re-colour a message by substituting background-color
//    but leave background-image alone, so painting the colour a second time as
//    a flat gradient puts it back. This is what keeps the email dark.
//
// 3. TEXT COLOURS PINNED TO MATCH (.t-fg / .t-accent / .t-muted / .t-dim).
//    Protecting backgrounds alone is WORSE than protecting neither: the fill
//    stays dark while the client darkens the text on top of it. Backgrounds
//    and text must be locked together or not at all.
//
// 4. HTML ENTITIES, NEVER LITERAL UTF-8. &bull; &middot; &nbsp; &ndash; rather
//    than the characters. A literal bullet survives only if the ESP's MIME
//    encoding, the receiving server and the client's parser all agree on the
//    charset; when they do not, every one renders as a question mark. The
//    rendered output here is deliberately pure ASCII. Keep it that way, and
//    note that escapeHtml() below does NOT convert non-ASCII - user-supplied
//    names can still carry accents, which is correct and expected.
//
// 5. TABLE LAYOUT. Outlook on Windows renders through Word: no flexbox, no
//    reliable margin or max-width on block elements. Tables with explicit
//    widths are the one primitive every client still agrees on.
//
// ─── KNOWN LIMITS (client limits, not bugs to fix) ──────────────────────────
// Webfonts reach Apple Mail, iOS Mail and Samsung Mail only; Gmail and Outlook
// strip @import and fall back to Arial. Outlook squares off border-radius, so
// the pill button becomes a rectangle. Gmail mobile's dark-mode adaptation
// cannot be fully controlled by anyone; the measures here are the standard
// mitigations. Always send the plain-text part alongside the HTML - HTML-only
// scores worse with spam filters and text-only clients show nothing otherwise.
import { SITE } from '@/lib/seo';

// ─── Palette, matched to the app ─────────────────────────────────────────────
// Mirrors the Stripe Elements theme in app/(root)/pricing/page.tsx so an email
// and the page it links to do not look like two different products.
const C = {
  base:     '#05070c', // page and inset panel
  surface:  '#0d1117', // card
  fg:       '#ffffff',
  muted:    '#94a3b8',
  dim:      '#64748b',
  hairline: '#1e2532',
  // indigo-400, not the #6366f1 button colour. #6366f1 on #0d1117 fails
  // contrast at 11px; this clears it while still reading as the brand.
  accent:   '#818cf8',
  ctaBg:    '#6366f1',
  ctaText:  '#ffffff',
} as const;

const SANS = "'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

/**
 * Display face, for headings only. Never the brand lockup, which stays in the
 * body sans so the wordmark is consistent with the product UI.
 *
 * Space Grotesk over the serif that was here before. The reason is the
 * FALLBACK, which is what most recipients actually see: Gmail and Outlook
 * strip @import and never load a webfont at all. A serif stack falls back to
 * Georgia, which is everywhere but reads dated. This falls back to Helvetica
 * Neue and then Arial, which stays clean.
 *
 * The honest trade: where the webfont does not load, headings and body are
 * both grotesques and differ only by size, weight and tracking rather than by
 * typeface. That is a quieter distinction than a serif would give, but it
 * never looks like an accident, which a stray Times New Roman does.
 *
 * Alternatives if you want to try others, all with the same fallback shape:
 *   'Manrope'        softer, rounder, friendlier
 *   'DM Sans'        neutral and very safe
 *   'Sora'           more geometric, more assertive
 * Swap the first name in the stack; nothing else needs to change.
 */
const DISPLAY = "'Space Grotesk','Helvetica Neue',Helvetica,Arial,sans-serif";

/**
 * Card width.
 *
 * '100%' makes the card fill the reading pane on desktop instead of sitting in
 * a 600px column. Phones are unchanged: they were already narrower than 600px,
 * so the card was full-bleed there either way.
 *
 * ─── The trade, stated plainly ─────────────────────────────────────────────
 * Line length is the cost. Body copy at 16px across a maximised window on a
 * wide monitor runs well past the 60-75 characters that text is comfortable to
 * read at, and the eye loses its place returning to the start of each line.
 * Most clients cap the reading pane well below full screen, which softens this
 * a lot, but a maximised Apple Mail or Outlook window will show it.
 *
 * To put a ceiling back without returning to a narrow column, set this to a
 * pixel value - '900px' keeps the wider feel while holding line length in
 * range. It is the only edit needed; every table below reads from it.
 */
const SHELL_WIDTH = '100%';

/**
 * Readable measure for the content column inside the full-bleed card.
 *
 * The card fills the reading pane, but the TEXT must not. Body copy running
 * the full width of a maximised window hits 140-plus characters per line,
 * roughly double the 60-75 that prose is comfortable at, and the eye loses its
 * place on every carriage return. Constraining the column is what makes a
 * full-width email look designed rather than unstyled.
 *
 * Applied inline rather than through a media query, because Outlook ignores
 * media queries entirely and several clients strip them. The MSO ghost table
 * in contentWrap() handles Outlook, which also ignores max-width.
 */
const MEASURE = '660px';

/**
 * Centres `inner` in a column of at most MEASURE inside a full-width cell.
 *
 * align="center" rather than `margin:0 auto`, because margin on a table is
 * unreliable across clients while the align attribute is understood by all of
 * them, Outlook included.
 */
const contentWrap = (inner: string): string => `
  <!--[if mso]><table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" width="660"><tr><td><![endif]-->
  <table role="presentation" align="center" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;max-width:${MEASURE};">
    <tr><td align="left">${inner}</td></tr>
  </table>
  <!--[if mso]></td></tr></table><![endif]-->`;

/**
 * Absolute and publicly reachable, or clients cache a broken image.
 *
 * Served from the APP origin deliberately. The previous welcome email pointed
 * at `${marketing}/logo-128.png`, which 404s; /logo.png on the app origin is
 * the file that actually exists.
 */
const LOGO_URL = `${process.env.EMAIL_ASSET_BASE ?? SITE.app}/logo.png`;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** "Bruce Wayne" -> "Bruce". Falls back to something that still reads. */
export function firstName(name: string | null | undefined): string {
  const first = (name ?? '').trim().split(/\s+/)[0];
  return first.length > 0 && first.length <= 40 ? first : 'there';
}

export interface PanelRow {
  label: string;
  /** Single value, or a list rendered as bullets. */
  value?: string;
  items?: string[];
  /**
   * Badge glyph, e.g. "01" or a numeric HTML entity like "&#10003;".
   *
   * ─── Why not image icons ───────────────────────────────────────────────
   * Outlook and many corporate clients block remote images by default, and
   * Gmail blocks them until the reader clicks "display images". An icon set
   * built from PNGs therefore renders as a column of broken-image boxes for a
   * large share of recipients, which looks far worse than no icons at all.
   *
   * SVG is worse still: Gmail, Outlook and Yahoo strip it outright.
   *
   * So the badge is TEXT inside a styled circle. It always renders, it cannot
   * break, and it survives images-off. Keep the glyph to one or two
   * characters, ASCII or a numeric entity - a literal UTF-8 symbol is exactly
   * the charset gamble rule 4 exists to avoid.
   */
  icon?: string;
  /** Accented action link under the value, with a trailing arrow. */
  link?: { label: string; url: string };
}

export interface EmailPanel {
  title: string;
  rows: PanelRow[];
}

export interface EmailOptions {
  /** Inbox preview line, shown beside the subject. */
  preheader: string;
  /** Wide caps above the headline. */
  eyebrow: string;
  heading: string;
  /** Rendered in order as body paragraphs. Pre-escaped by the caller only if
   *  it needs inline markup; otherwise pass plain text. */
  paragraphs: string[];
  panel?: EmailPanel;
  /** One last line between the panel and the button. This is the slot for the
   *  "do this one thing" nudge: after the reader has seen what is on offer and
   *  immediately before they are asked to click. */
  closing?: string;
  cta?: { label: string; url: string };
  /** Defaults to a plain sign-off. Ignored when `signature` is supplied. */
  signoff?: string;
  /**
   * Proper sign-off block: name, role, and contact details under a rule.
   *
   * Preferred over `signoff` for anything a person is notionally sending. A
   * bare "The Preciprocal team" reads as automated, which undercuts the one
   * line in these emails that earns trust - the promise that a reply reaches
   * someone.
   */
  signature?: {
    name: string;
    title?: string;
    email?: string;
    /** Short line above the block, e.g. "Reply and I will take a look." */
    note?: string;
  };
  /** Why-you-got-this line, outside the card. */
  footerNote: string;
  /** Appended under the footer links, e.g. an unsubscribe link. */
  footerExtraHtml?: string;
}

const panelRowHtml = (row: PanelRow, isLast: boolean): string => {
  const body = row.items
    ? row.items.map(i => `<div style="margin:0 0 2px 0;">&bull;&nbsp;&nbsp;${i}</div>`).join('')
    : (row.value ?? '');

  // A single chevron rather than a full arrow. The arrow reads as consumer-app
  // wayfinding; the chevron is the restrained "read more" treatment print and
  // editorial sites have used for decades, and it carries the same affordance
  // without the visual weight.
  //
  // &rsaquo; is a named HTML entity, so it does not depend on the charset
  // negotiation a literal character would - see rule 4 at the top of this file.
  const link = row.link
    ? `<div style="margin:10px 0 0 0;"><a href="${row.link.url}" class="t-accent" style="font-family:${SANS};font-size:14px;font-weight:600;line-height:1.4;color:${C.accent};text-decoration:none;letter-spacing:0.2px;">${escapeHtml(row.link.label)}<span style="padding-left:6px;">&rsaquo;</span></a></div>`
    : '';

  const content =
    `<div class="t-fg" style="margin:0 0 6px 0;font-family:${SANS};font-size:15px;font-weight:700;line-height:1.4;color:${C.fg};">${escapeHtml(row.label)}</div>` +
    `<div class="t-muted" style="margin:0;font-family:${SANS};font-size:14px;line-height:1.65;color:${C.muted};">${body}</div>` +
    link;

  // ─── All vertical spacing lives on the divider row ─────────────────────
  //
  // It used to be split: 18px of padding-bottom on the content cells plus
  // 18px of padding-top on the divider, and nothing underneath. That put 36px
  // above the rule and 0 below it, so the line sat flush against the next
  // badge and read as overlapping it.
  //
  // Content cells now carry no bottom padding at all and the divider owns the
  // gap on both sides, which is the only way the two halves cannot drift
  // apart again.
  const divider = isLast
    ? ''
    : `<tr><td colspan="2" style="padding:22px 0 22px 0;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr><td height="1" bgcolor="${C.hairline}" style="height:1px;line-height:1px;font-size:0;">&nbsp;</td></tr></table></td></tr>`;

  // No badge: one full-width cell, so rows without an icon still line up with
  // the rest of the panel.
  if (!row.icon) {
    return `<tr><td colspan="2" style="padding:0;">${content}</td></tr>${divider}`;
  }

  // Badge and content as two cells of one row. valign="top" pins the badge to
  // the first line instead of centring it against a three-line paragraph,
  // which is what makes the column read as aligned.
  //
  // line-height on the span is what vertically centres the glyph inside the
  // circle; it must stay equal to the cell height.
  return `
    <tr>
      <td valign="top" width="52" style="width:52px;padding:0 16px 0 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="36" style="width:36px;">
          <tr>
            <td align="center" valign="middle" height="36" bgcolor="${C.base}" style="width:36px;height:36px;border:1px solid ${C.accent};border-radius:999px;background-color:${C.base};background-image:linear-gradient(${C.base},${C.base});">
              <span class="t-accent" style="font-family:${SANS};font-size:13px;font-weight:700;line-height:36px;color:${C.accent};">${row.icon}</span>
            </td>
          </tr>
        </table>
      </td>
      <td valign="top" style="padding:0;">${content}</td>
    </tr>${divider}`;
};

const panelHtml = (panel: EmailPanel | undefined): string => {
  // An empty titled panel reads as a rendering fault, so drop the whole table
  // rather than render a heading with nothing under it.
  if (!panel || panel.rows.length === 0) return '';

  const rows = panel.rows
    .map((r, i) => panelRowHtml(r, i === panel.rows.length - 1))
    .join('');

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="${C.base}" class="bg-base" style="margin:10px 0 6px 0;border-collapse:separate;background-color:${C.base};background-image:linear-gradient(${C.base},${C.base});border:1px solid ${C.hairline};border-radius:14px;">
      <tr>
        <td style="padding:26px 28px;">
          <div class="t-fg" style="margin:0 0 20px 0;font-family:${DISPLAY};font-size:17px;font-weight:600;line-height:1.3;letter-spacing:-0.1px;color:${C.fg};">${escapeHtml(panel.title)}</div>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${rows}</table>
        </td>
      </tr>
    </table>`;
};

/**
 * One size for every line of the signature, matching the note above it.
 *
 * The name was 16px over a 13px role and address, which made the block step
 * down twice and read as a heading bolted to the end of the email. Holding
 * the size flat and separating the lines by weight and colour instead is the
 * cleaner treatment, and it keeps the signature visually part of the message
 * rather than an appendix to it.
 */
const SIG_SIZE = '15px';

const signatureHtml = (sig: NonNullable<EmailOptions['signature']>): string => {
  const lines = [
    `<div class="t-fg" style="font-family:${SANS};font-size:${SIG_SIZE};font-weight:700;line-height:1.5;color:${C.fg};">${escapeHtml(sig.name)}</div>`,
    sig.title
      ? `<div class="t-muted" style="margin:2px 0 0 0;font-family:${SANS};font-size:${SIG_SIZE};line-height:1.5;color:${C.muted};">${escapeHtml(sig.title)}</div>`
      : '',
    sig.email
      ? `<div style="margin:6px 0 0 0;font-family:${SANS};font-size:${SIG_SIZE};line-height:1.5;"><a href="mailto:${sig.email}" class="t-accent" style="color:${C.accent};text-decoration:none;">${escapeHtml(sig.email)}</a></div>`
      : '',
  ].join('');

  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:30px 0 0 0;">
      ${sig.note ? `<tr><td style="padding:0 0 18px 0;"><p class="t-muted" style="margin:0;font-family:${SANS};font-size:15px;line-height:1.65;color:${C.muted};">${sig.note}</p></td></tr>` : ''}
      <tr><td style="padding:0 0 18px 0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr><td height="1" bgcolor="${C.hairline}" style="height:1px;line-height:1px;font-size:0;">&nbsp;</td></tr>
        </table>
      </td></tr>
      <tr><td>${lines}</td></tr>
    </table>`;
};

const ctaHtml = (cta: EmailOptions['cta']): string => {
  if (!cta) return '';

  // Centred via a full-width outer table with align="center" on its cell,
  // rather than align="center" on the button table itself. The attribute on a
  // table makes later content flow AROUND it in some renderers, which pulls
  // the sign-off up beside the button; the wrapper cell has no such effect.
  //
  // Centred at every width, not just desktop. Restricting it would need a
  // media query, and those were deliberately removed from the desktop path
  // because Outlook ignores them and several clients strip them - the
  // inconsistency would show up exactly where it cannot be tested.
  //
  // The <td> carries the fill so the whole pill is clickable, not just the
  // text, and the gradient doubles as the Gmail dark-mode lock from rule 2.
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:26px 0 6px 0;">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;">
            <tr>
              <td align="center" bgcolor="${C.ctaBg}" class="cta-td" style="border-radius:999px;background-color:${C.ctaBg};background-image:linear-gradient(135deg,${C.ctaBg},#a855f7);">
                <a href="${cta.url}" class="cta-a" style="display:inline-block;padding:15px 34px;font-family:${SANS};font-size:15px;font-weight:600;line-height:1;color:${C.ctaText};text-decoration:none;border-radius:999px;">${escapeHtml(cta.label)}</a>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
};

export function renderEmail(o: EmailOptions): string {
  const paragraphs = o.paragraphs
    .map(p => `<p class="t-muted" style="margin:0 0 18px 0;font-family:${SANS};font-size:16px;line-height:1.65;color:${C.muted};">${p}</p>`)
    .join('');

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${escapeHtml(o.heading)}</title>
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />

  <!-- BLOCK 1 of 2: webfont, ISOLATED. Gmail discards this whole element,
       which is expected. Nothing else may live in here - see rule 1. -->
  <style type="text/css">
    @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600;700&display=swap');
  </style>

  <!-- BLOCK 2 of 2: everything that must survive Gmail. -->
  <style type="text/css">
    :root { color-scheme: dark; supported-color-schemes: dark; }
    body { margin:0 !important; padding:0 !important; width:100% !important; background-color:${C.base}; background-image:linear-gradient(${C.base},${C.base}); }
    a { color:${C.accent}; }
    a[x-apple-data-detectors] { color:inherit !important; text-decoration:none !important; font-size:inherit !important; font-family:inherit !important; font-weight:inherit !important; line-height:inherit !important; }

    .bg-base { background-color:${C.base}; background-image:linear-gradient(${C.base},${C.base}); }
    .bg-surface { background-color:${C.surface}; background-image:linear-gradient(${C.surface},${C.surface}); }
    .t-fg { color:${C.fg} !important; }
    .t-accent { color:${C.accent} !important; }
    .t-muted { color:${C.muted} !important; }
    .t-dim { color:${C.dim} !important; }
    .cta-td { background-color:${C.ctaBg}; background-image:linear-gradient(135deg,${C.ctaBg},#a855f7); }
    .cta-a { color:${C.ctaText} !important; }

    @media (prefers-color-scheme: dark) {
      .bg-base { background-color:${C.base}; background-image:linear-gradient(${C.base},${C.base}); }
      .bg-surface { background-color:${C.surface}; background-image:linear-gradient(${C.surface},${C.surface}); }
      .t-fg { color:${C.fg} !important; }
      .t-accent { color:${C.accent} !important; }
      .t-muted { color:${C.muted} !important; }
      .t-dim { color:${C.dim} !important; }
      .cta-td { background-color:${C.ctaBg}; background-image:linear-gradient(135deg,${C.ctaBg},#a855f7); }
      .cta-a { color:${C.ctaText} !important; }
    }

    /* Outlook.com rewrites the DOM and prefixes elements with data-ogsc
       (text) and data-ogsb (background). It is the only hook it offers. */
    [data-ogsc] .t-fg { color:${C.fg} !important; }
    [data-ogsc] .t-accent { color:${C.accent} !important; }
    [data-ogsc] .t-muted { color:${C.muted} !important; }
    [data-ogsc] .t-dim { color:${C.dim} !important; }
    [data-ogsc] .cta-a { color:${C.ctaText} !important; }
    [data-ogsb] .bg-base { background-color:${C.base}; background-image:linear-gradient(${C.base},${C.base}); }
    [data-ogsb] .bg-surface { background-color:${C.surface}; background-image:linear-gradient(${C.surface},${C.surface}); }
    [data-ogsb] .cta-td { background-color:${C.ctaBg}; background-image:linear-gradient(135deg,${C.ctaBg},#a855f7); }

    /* Phones keep exactly the current look: full-bleed card, tighter side
       padding, smaller headline. The shell is already 100% at every size now,
       so this block only handles the spacing and type scale. */
    @media only screen and (max-width:620px) {
      .shell { width:100% !important; max-width:100% !important; }
      .pad { padding-left:24px !important; padding-right:24px !important; }
      .h1 { font-size:28px !important; }
    }

    /* Desktop inset is inline on the cells, not here: Outlook ignores media
       queries outright and several clients strip them, which left the copy
       nearly touching the card edge on exactly the widths this was meant to
       fix. The centred wrapper does the real work now. */
  </style>
</head>

<body bgcolor="${C.base}" class="bg-base" style="margin:0;padding:0;background-color:${C.base};background-image:linear-gradient(${C.base},${C.base});">

  <!-- Inbox preview line: hidden, then padded with &nbsp; so the client does
       not drag the opening markup in after it. Do NOT pad with &zwnj; -
       most fonts have no glyph and they show as question marks. -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${C.base};opacity:0;">${escapeHtml(o.preheader)}${'&nbsp;'.repeat(40)}</div>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" height="100%" bgcolor="${C.base}" class="bg-base" style="background-color:${C.base};background-image:linear-gradient(${C.base},${C.base});">
    <tr>
      <td align="center" valign="top" bgcolor="${C.base}" class="bg-base" style="padding:32px 12px;background-color:${C.base};background-image:linear-gradient(${C.base},${C.base});">

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="shell bg-surface" bgcolor="${C.surface}" style="width:${SHELL_WIDTH};max-width:${SHELL_WIDTH};border-collapse:separate;background-color:${C.surface};background-image:linear-gradient(${C.surface},${C.surface});border:1px solid ${C.hairline};border-radius:18px;overflow:hidden;">

          <!-- Lit top edge. bgcolor is the flat fallback for Outlook, which
               ignores the gradient entirely. -->
          <tr>
            <td height="3" bgcolor="${C.ctaBg}" style="height:3px;line-height:3px;font-size:0;background-color:${C.ctaBg};background-image:linear-gradient(90deg,${C.surface},${C.ctaBg},#a855f7,${C.surface});">&nbsp;</td>
          </tr>

          <!-- Brand lockup -->
          <tr>
            <td align="center" class="pad" style="padding:30px 40px 0 40px;">
              <img src="${LOGO_URL}" width="96" height="96" alt="${escapeHtml(SITE.name)}" style="display:block;width:96px;height:96px;border:0;outline:none;text-decoration:none;" />
            </td>
          </tr>
          <tr>
            <td align="center" class="pad" style="padding:0 40px;">
              <div class="t-fg" style="font-family:${SANS};font-size:22px;font-weight:700;line-height:1.2;letter-spacing:-0.2px;color:${C.fg};">${escapeHtml(SITE.name)}</div>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:12px 40px 0 40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="150">
                <tr>
                  <td height="1" bgcolor="${C.ctaBg}" style="height:1px;line-height:1px;font-size:0;background-color:${C.ctaBg};background-image:linear-gradient(90deg,${C.surface},${C.accent},${C.surface});">&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Message -->
          <tr>
            <td class="pad" style="padding:40px 32px 0 32px;">
              ${contentWrap(`
              <div class="t-accent" style="margin:0 0 14px 0;font-family:${SANS};font-size:11px;font-weight:600;line-height:1.4;letter-spacing:3.2px;text-transform:uppercase;color:${C.accent};">${escapeHtml(o.eyebrow)}</div>
              <h1 class="h1 t-fg" style="margin:0 0 22px 0;font-family:${DISPLAY};font-size:31px;font-weight:700;line-height:1.15;letter-spacing:-0.6px;color:${C.fg};">${escapeHtml(o.heading)}</h1>
              ${paragraphs}
              ${panelHtml(o.panel)}
              ${o.closing ? `<p class="t-muted" style="margin:22px 0 0 0;font-family:${SANS};font-size:16px;line-height:1.65;color:${C.muted};">${o.closing}</p>` : ''}
              ${ctaHtml(o.cta)}
              ${o.signature
                ? signatureHtml(o.signature)
                : `<p class="t-muted" style="margin:26px 0 0 0;font-family:${SANS};font-size:16px;line-height:1.65;color:${C.muted};">${o.signoff ?? `Talk soon,<br />The ${escapeHtml(SITE.name)} team`}</p>`}
              `)}
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td class="pad" style="padding:38px 32px 0 32px;">
              ${contentWrap(`
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr><td height="1" bgcolor="${C.hairline}" style="height:1px;line-height:1px;font-size:0;">&nbsp;</td></tr>
              </table>`)}
            </td>
          </tr>
          <tr>
            <td class="pad" style="padding:22px 32px 40px 32px;">
              ${contentWrap(`
              <div class="t-muted" style="margin:0 0 10px 0;font-family:${SANS};font-size:12px;line-height:1.6;letter-spacing:0.3px;color:${C.muted};">Resumes &middot; Mock interviews &middot; Cover letters &middot; Job tracking</div>
              <div class="t-muted" style="font-family:${SANS};font-size:12px;line-height:1.6;color:${C.muted};">
                <a href="${SITE.app}" class="t-accent" style="color:${C.accent};text-decoration:none;">app.preciprocal.com</a>
                &nbsp;&middot;&nbsp;
                <a href="mailto:support@preciprocal.com" class="t-accent" style="color:${C.accent};text-decoration:none;">support@preciprocal.com</a>
              </div>
              ${o.footerExtraHtml ?? ''}`)}
            </td>
          </tr>

        </table>

        <!-- Why-you-got-this, outside the card so it reads as metadata -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="shell" style="width:${SHELL_WIDTH};max-width:${SHELL_WIDTH};">
          <tr>
            <td align="center" style="padding:18px 24px 0 24px;">
              <div class="t-dim" style="font-family:${SANS};font-size:11px;line-height:1.6;color:${C.dim};">${escapeHtml(o.footerNote)}</div>
            </td>
          </tr>
        </table>

      </td>
    </tr>
  </table>
</body>
</html>`;
}

/**
 * Plain-text part. Never optional: HTML-only mail scores worse with spam
 * filters, and text-only clients show nothing at all without it.
 *
 * Takes its own strings rather than trying to strip tags out of the HTML,
 * because a regex tag-stripper mangles exactly the entities rule 4 requires.
 */
export function renderText(opts: {
  heading: string;
  paragraphs: string[];
  panel?: { title: string; lines: string[] };
  closing?: string;
  cta?: { label: string; url: string };
  signoff?: string;
  signature?: { name: string; title?: string; email?: string; note?: string };
  footerNote?: string;
}): string {
  const parts: string[] = [opts.heading, ''];
  parts.push(...opts.paragraphs, '');

  if (opts.panel && opts.panel.lines.length) {
    parts.push(opts.panel.title, ...opts.panel.lines.map(l => `  ${l}`), '');
  }
  if (opts.closing) parts.push(opts.closing, '');
  if (opts.cta) parts.push(`${opts.cta.label}: ${opts.cta.url}`, '');

  parts.push(opts.signoff ?? `Talk soon,\nThe ${SITE.name} team`);
  parts.push('', `${SITE.app}  |  support@preciprocal.com`);
  if (opts.footerNote) parts.push('', opts.footerNote);

  return parts.join('\n');
}

// scripts/fix-confirmation-cards.ts
//
// One-off repair for tracker cards the extension saved from a job board's
// thank-you page before app/api/extension/track-job learned to recognise one:
// company "Job-boards", "Jobs" or "Breezy", titles like "Thank you for
// applying", and the same posting saved twice.
//
// For each such card: when the student already has a card for the same
// posting, that card moves to Applied and the stray card is removed;
// otherwise the stray card gets the employer and title from its address.
// Two extension cards for one posting collapse to the oldest.
//
//   npx tsx scripts/fix-confirmation-cards.ts          dry run, prints the plan
//   npx tsx scripts/fix-confirmation-cards.ts --apply  makes the changes
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { canonicalPostingUrl, companyFromPostingUrl, isBoardName, isConfirmationTitle, isSpecificPosting, parseApplicationTitle, stripCompanySuffix, titleFromPostingUrl } from '../lib/jobs/posting-url';

const env = Object.fromEntries(fs.readFileSync('.env.local', 'utf8').split(/\r?\n/).map(l => l.match(/^([A-Z_]+)=(.*)$/)).filter((m): m is RegExpMatchArray => !!m).map(m => [m[1], m[2].replace(/^["']|["']$/g, '')]));
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const APPLY = process.argv.includes('--apply');
const NOT_YET = new Set(['wishlist', 'saved', '']);

interface Row { id: string; user_id: string; company: string; job_title: string; job_url: string | null; status: string | null; applied_date: string | null; created_at: string; source: string | null }

async function main() {
const rows: Row[] = [];
for (let from = 0; ; from += 1000) {
  const { data, error } = await db.from('job_applications').select('id, user_id, company, job_title, job_url, status, applied_date, created_at, source').order('created_at').range(from, from + 999);
  if (error) throw error;
  rows.push(...(data as Row[]));
  if (!data || data.length < 1000) break;
}
const key = (r: Row) => `${r.user_id}|${(canonicalPostingUrl(r.job_url) ?? '').toLowerCase()}`;
const byPosting = new Map<string, Row[]>();
for (const r of rows) if (r.job_url) byPosting.set(key(r), [...(byPosting.get(key(r)) ?? []), r]);

const remove = new Set<string>();
const updates: { id: string; patch: Record<string, unknown>; why: string }[] = [];
const isStray = (r: Row) => isBoardName(r.company) || isConfirmationTitle(r.job_title) || !!parseApplicationTitle(r.job_title);
/** The employer and role a stray card should show, read as the save route now does. */
const fixed = (r: Row) => {
  const t = parseApplicationTitle(r.job_title);
  const company = isBoardName(r.company) ? (companyFromPostingUrl(r.job_url) || t?.company || r.company) : r.company;
  const title = stripCompanySuffix(t?.role || (isConfirmationTitle(r.job_title) ? (titleFromPostingUrl(r.job_url) || 'Job application') : r.job_title), company);
  return { company, title };
};
const rename = (r: Row) => {
  const f = fixed(r);
  if (f.company !== r.company || f.title !== r.job_title) updates.push({ id: r.id, patch: { company: f.company, job_title: f.title }, why: `rename ${r.company} | ${r.job_title}  ->  ${f.company} | ${f.title}` });
};

for (const group of byPosting.values()) {
  // A shared apply page says nothing about which job it was: fix names only.
  if (!isSpecificPosting(group[0].job_url)) { group.filter(isStray).forEach(rename); continue; }
  if (group.length === 1) { if (isStray(group[0])) rename(group[0]); continue; }
  // One posting saved more than once. Keep a real card, preferring the one
  // the Apply flow made (it holds the tailored resume and letter), else the
  // oldest; the others go. A card past Applied (an interview, an offer) is
  // never removed.
  const keeper = group.find(r => !isStray(r) && r.source === 'Preciprocal jobs') ?? group.find(r => !isStray(r)) ?? group[0];
  if (isStray(keeper)) rename(keeper);
  let applied: string | null = null;
  for (const r of group) {
    if (r === keeper) continue;
    if (!NOT_YET.has(r.status ?? '') && r.status !== 'applied') { if (isStray(r)) rename(r); continue; }
    remove.add(r.id);
    if (r.status === 'applied') applied = applied ?? (r.applied_date ?? r.created_at.slice(0, 10));
    console.log(`remove             ${r.id.slice(0, 8)} ${r.company} | ${r.job_title}  (same posting as ${keeper.id.slice(0, 8)} ${fixed(keeper).company} | ${fixed(keeper).title})`);
  }
  if (applied && NOT_YET.has(keeper.status ?? '')) {
    const prev = updates.find(u => u.id === keeper.id);
    if (prev) { prev.patch = { ...prev.patch, status: 'applied', applied_date: applied }; prev.why += ', and to applied'; }
    else updates.push({ id: keeper.id, patch: { status: 'applied', applied_date: applied }, why: `move ${keeper.company} | ${keeper.job_title} to applied` });
  }
}
for (const u of updates) console.log(`update             ${u.id.slice(0, 8)} ${u.why}`);
console.log(`\n${rows.length} cards checked: ${remove.size} to remove, ${updates.length} to update.${APPLY ? '' : ' Dry run; pass --apply to make the changes.'}`);

if (APPLY) {
  for (const u of updates) {
    const { error } = await db.from('job_applications').update({ ...u.patch, updated_at: new Date().toISOString() }).eq('id', u.id);
    if (error) throw error;
  }
  if (remove.size) {
    const { error } = await db.from('job_applications').delete().in('id', [...remove]);
    if (error) throw error;
  }
  console.log('Done.');
}
}

main().catch(e => { console.error(e); process.exit(1); });

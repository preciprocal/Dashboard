// app/api/salary/searches/route.ts
//
// The Market Pay searches a student has run, kept on their profile
// (extended_data.salarySearches) so they can come back to them.
//
// GET                         -> { searches }
// POST   { title, location, occ?, occTitle?, area?, median? } -> { searches }
//        Adds or refreshes a search: newest first, one entry per title and
//        location (case-insensitive), at most MAX.
// DELETE ?id=<id> | ?all=1    -> { searches }
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import { supabaseAdmin } from '@/supabase/admin';

export const runtime = 'nodejs';

const MAX = 12;

export interface SavedSalarySearch {
  id: string;
  title: string;
  location: string;
  /** The BLS occupation it matched, so a rerun shows the same figures. */
  occ: string | null;
  occTitle: string | null;
  /** The area the figures were for (e.g. "Boston-Cambridge-Newton, MA-NH"). */
  area: string | null;
  /** The median annual wage it showed, in dollars, when it was run. */
  median: number | null;
  at: string;
}

type Ext = Record<string, unknown>;
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const keyOf = (s: { title: string; location: string }) => `${s.title.toLowerCase()}|${s.location.toLowerCase()}`;

async function load(uid: string): Promise<{ ext: Ext; searches: SavedSalarySearch[] } | null> {
  const { data } = await supabaseAdmin.from('profiles').select('extended_data').eq('user_id', uid).maybeSingle();
  if (!data) return null;
  const ext = ((data.extended_data as Ext | null) ?? {});
  const searches = Array.isArray(ext.salarySearches) ? (ext.salarySearches as SavedSalarySearch[]).filter(s => s && typeof s.title === 'string') : [];
  return { ext, searches };
}

async function save(uid: string, ext: Ext, searches: SavedSalarySearch[]) {
  const { error } = await supabaseAdmin.from('profiles')
    .update({ extended_data: { ...ext, salarySearches: searches }, updated_at: new Date().toISOString() })
    .eq('user_id', uid);
  if (error) throw error;
}

export async function GET(request: NextRequest) {
  const user = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const row = await load(user.supabaseUserId);
  return NextResponse.json({ searches: row?.searches ?? [] });
}

export async function POST(request: NextRequest) {
  const user = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const title = str(body?.title, 200);
  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 });
  const occ = str(body?.occ, 7);
  const median = typeof body?.median === 'number' && Number.isFinite(body.median) && body.median > 0 && body.median < 2_000_000 ? Math.round(body.median) : null;
  const entry: SavedSalarySearch = {
    id: crypto.randomUUID().slice(0, 8),
    title,
    location: str(body?.location, 200),
    occ: /^\d{2}-\d{4}$/.test(occ) ? occ : null,
    occTitle: str(body?.occTitle, 200) || null,
    area: str(body?.area, 200) || null,
    median,
    at: new Date().toISOString(),
  };
  try {
    const row = await load(user.supabaseUserId);
    if (!row) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    const rest = row.searches.filter(s => keyOf(s) !== keyOf(entry));
    const searches = [entry, ...rest].slice(0, MAX);
    await save(user.supabaseUserId, row.ext, searches);
    return NextResponse.json({ searches });
  } catch (e) {
    console.error('❌ salary searches save:', e);
    return NextResponse.json({ error: 'Could not save this search' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getAuthedUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const sp = request.nextUrl.searchParams;
  try {
    const row = await load(user.supabaseUserId);
    if (!row) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });
    const searches = sp.get('all') === '1' ? [] : row.searches.filter(s => s.id !== sp.get('id'));
    await save(user.supabaseUserId, row.ext, searches);
    return NextResponse.json({ searches });
  } catch (e) {
    console.error('❌ salary searches delete:', e);
    return NextResponse.json({ error: 'Could not remove this search' }, { status: 500 });
  }
}

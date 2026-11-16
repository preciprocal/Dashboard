// lib/text/word-diff.ts
//
// A word-level diff of two lines (longest common subsequence over words),
// so a rewrite shows only the words that changed, not the whole line.

export type DiffOp = { t: 'same' | 'del' | 'add'; w: string };

const tokens = (s: string) => s.trim().split(/\s+/).filter(Boolean);
const norm = (w: string) => w.toLowerCase().replace(/[.,;:!?()"']/g, '');

export function wordDiff(before: string, after: string): DiffOp[] {
  const a = tokens(before), b = tokens(after);
  const n = a.length, m = b.length;
  // Lines on a resume are short, so the full table is cheap.
  const L: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      L[i][j] = norm(a[i]) === norm(b[j]) ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
    }
  }
  const out: DiffOp[] = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (norm(a[i]) === norm(b[j])) { out.push({ t: 'same', w: b[j] }); i++; j++; }
    else if (L[i + 1][j] >= L[i][j + 1]) out.push({ t: 'del', w: a[i++] });
    else out.push({ t: 'add', w: b[j++] });
  }
  while (i < n) out.push({ t: 'del', w: a[i++] });
  while (j < m) out.push({ t: 'add', w: b[j++] });
  return out;
}

/** How many words were removed and added. */
export function diffCounts(ops: DiffOp[]) {
  return { removed: ops.filter(o => o.t === 'del').length, added: ops.filter(o => o.t === 'add').length };
}

// lib/jobs/roles.ts
//
// The role a student named in setup (e.g. "Data analyst"), as a title match
// for the job feed, and the roles close to it that are worth a look.

const STOP = new Set(['and', 'or', 'the', 'of', 'a', 'an', 'in', 'for', 'to', 'with', 'jr', 'sr', 'junior', 'senior', 'entry', 'level', 'intern', 'internship']);

/** The words of a role, cut to a stem so "analyst" also matches "analytics". */
function stems(role: string): string[] {
  return role.toLowerCase().replace(/[^a-z0-9+#/ ]/g, ' ').split(/[\s/]+/)
    .filter(w => w && !STOP.has(w))
    .map(w => (w.length > 6 ? w.slice(0, 5) : w.replace(/s$/, '')));
}

/** True when a job title has every word of the role (by stem). */
export function titleMatchesRole(title: string, role: string): boolean {
  const words = stems(role);
  if (!words.length) return false;
  const t = title.toLowerCase();
  // Each word must start a word in the title, so "bi" does not match "ability".
  return words.every(w => new RegExp(`(^|[^a-z0-9])${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`).test(t));
}

export function titleMatchesAny(title: string, roles: string[]): boolean {
  return roles.some(r => titleMatchesRole(title, r));
}

// Close roles, by the words in the role the student named. The first group
// whose key is in the role wins.
const GROUPS: [RegExp, string[]][] = [
  [/data anal|analytics/, ['Business analyst', 'BI analyst', 'Product analyst', 'Data scientist', 'Analytics engineer', 'Data engineer']],
  [/data sci/, ['Machine learning engineer', 'Data analyst', 'Applied scientist', 'AI engineer', 'Research scientist']],
  [/machine learn|\bml\b|\bai\b|deep learn/, ['Data scientist', 'AI engineer', 'Applied scientist', 'Research engineer', 'Software engineer']],
  [/data eng/, ['Analytics engineer', 'Software engineer', 'Data analyst', 'Platform engineer', 'Cloud engineer']],
  [/business anal|operations anal/, ['Data analyst', 'Product analyst', 'Operations analyst', 'Financial analyst', 'Business intelligence']],
  [/financ|accounting|fp&a|invest/, ['Financial analyst', 'Accounting', 'FP&A analyst', 'Investment analyst', 'Business analyst']],
  [/product manag|program manag|product owner/, ['Product analyst', 'Program manager', 'Business analyst', 'Technical program manager', 'Product owner']],
  [/design|ux|ui\b/, ['Product designer', 'UX designer', 'UI designer', 'UX researcher', 'Visual designer']],
  [/market|growth|content|brand/, ['Marketing analyst', 'Growth', 'Product marketing', 'Content', 'Digital marketing']],
  [/front.?end|react|web dev/, ['Software engineer', 'Full stack engineer', 'UI engineer', 'Web developer', 'Mobile engineer']],
  [/back.?end|full.?stack|software|developer|swe\b|programmer/, ['Backend engineer', 'Full stack engineer', 'Frontend engineer', 'Platform engineer', 'Mobile engineer', 'Cloud engineer']],
  [/devops|cloud|site reliab|sre\b|infrastructure/, ['Cloud engineer', 'DevOps engineer', 'Site reliability engineer', 'Platform engineer', 'Software engineer']],
  [/secur|cyber/, ['Security engineer', 'Security analyst', 'Cloud engineer', 'Network engineer', 'Software engineer']],
  [/hardware|electric|embedded|firmware/, ['Hardware engineer', 'Embedded engineer', 'Firmware engineer', 'Electrical engineer', 'Test engineer']],
  [/mechanic|manufactur/, ['Mechanical engineer', 'Manufacturing engineer', 'Design engineer', 'Quality engineer', 'Test engineer']],
];

/** Roles related to the one named, not including it. Up to five. */
export function relatedRoles(role: string): string[] {
  const r = role.toLowerCase().trim();
  if (!r) return [];
  const hit = GROUPS.find(([re]) => re.test(r));
  let list = hit ? hit[1] : [];
  if (!list.length) {
    // Fall back on the last word: "X engineer" gets other engineers, and so on.
    const last = r.split(/\s+/).pop() ?? '';
    const byKind: Record<string, string[]> = {
      engineer: ['Software engineer', 'Data engineer', 'Systems engineer', 'Test engineer'],
      analyst: ['Data analyst', 'Business analyst', 'Financial analyst', 'Operations analyst'],
      scientist: ['Data scientist', 'Research scientist', 'Applied scientist'],
      designer: ['Product designer', 'UX designer', 'UI designer'],
      manager: ['Product manager', 'Program manager', 'Project manager'],
    };
    list = byKind[last] ?? [];
  }
  return list.filter(x => x.toLowerCase() !== r).slice(0, 5);
}

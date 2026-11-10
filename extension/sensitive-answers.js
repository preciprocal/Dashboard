// sensitive-answers.js - questions autofill must never answer for the user.
//
// Demographic (EEO) questions, work authorization, sponsorship, citizenship,
// criminal record, age and consent questions are statements the applicant
// makes, often on a legal form. Autofill used to answer them with defaults
// ("I am not a protected veteran", "Yes" to authorized, "No" to sponsorship)
// when the user had never said so, which is exactly the "it ticked the wrong
// box" failure people report about other autofill tools.
//
// The rule, for every form this extension fills: answer only with what the
// user saved in their profile. Otherwise leave the question blank, outline it,
// and list it in a "needs your answer" note. Loaded before banner.js and
// external-apply.js (manifest.json) so both use the same rules.
//
// The server sends null for anything the user has not chosen
// (app/api/extension/auto-apply/route.ts, sensitiveValue).

(function () {
  if (window.PreciprocalSensitive) return;

  /** Question label -> kind. Order matters: the first match wins. */
  const KINDS = [
    ['orientation', /sexual orientation|lgbt/i],
    ['pronouns',    /pronoun/i],
    ['gender',      /\bgender\b|\bsex\b(?! offender)/i],
    ['race',        /\brace\b|ethnicit|hispanic|latin[oa]/i],
    ['disability',  /disabilit/i],
    ['veteran',     /veteran|military|armed forces|served in the/i],
    ['clearance',   /security clearance/i],
    ['sponsor',     /sponsor/i],
    ['citizen',     /citizen/i],
    // Deliberately broad: a question wrongly caught here is left for the user
    // to answer, which is harmless; one wrongly missed gets a guessed answer.
    ['authorized',  /\bauthori[sz]ed\b|work authori[sz]|legally (authori[sz]ed|eligible|able|permitted)|eligible (to|for) (work|employment)|right to work|work permit/i],
    ['over18',      /\b18\b|legal(ly)?( working)? age|\bof age\b|\badult\b/i],
    ['criminal',    /criminal|felony|convict/i],
    ['background',  /background\s*(check|screen)/i],
    ['drug',        /drug\s*(test|screen)/i],
    ['license',     /driver.?s?\s*licen[sc]e/i],
  ];

  const LABELS = {
    orientation: 'Sexual orientation', pronouns: 'Pronouns', gender: 'Gender',
    race: 'Race / ethnicity', disability: 'Disability status', veteran: 'Veteran status',
    clearance: 'Security clearance', sponsor: 'Visa sponsorship', citizen: 'Citizenship',
    authorized: 'Work authorization', over18: 'Age (18+)', criminal: 'Criminal record',
    background: 'Background check consent', drug: 'Drug test consent', license: "Driver's license",
  };

  function kindOf(label) {
    const t = String(label || '');
    for (const [kind, re] of KINDS) if (re.test(t)) return kind;
    return null;
  }

  const yesNo = (v) => (v === true ? 'Yes' : v === false ? 'No' : null);
  const str = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);

  /** The user's saved answer for this kind, or null to leave it for them. */
  function answer(p, kind) {
    if (!p) return null;
    switch (kind) {
      case 'gender':     return str(p.gender);
      case 'pronouns':   return str(p.pronouns);
      case 'race':       return str(p.race);
      case 'veteran':    return str(p.veteranStatus);
      case 'disability': return str(p.disabilityStatus);
      case 'authorized': return /^(yes|no)$/i.test(p.workAuthorization || '') ? (/^y/i.test(p.workAuthorization) ? 'Yes' : 'No') : null;
      case 'sponsor':    return yesNo(p.requireSponsorship);
      case 'over18':     return yesNo(p.over18);
      case 'criminal':   return yesNo(p.criminalRecord);
      case 'background': return yesNo(p.backgroundCheck);
      case 'drug':       return yesNo(p.drugTest);
      case 'license':    return yesNo(p.driverLicense);
      case 'citizen': {
        // From the visa field only. Living in the US says nothing about
        // citizenship, and inferring it mislabels every international student.
        const v = str(p.visaType);
        if (!v || /not applicable/i.test(v)) return null;
        return /us citizen/i.test(v) ? 'Yes' : 'No';
      }
      // No profile field exists for these; always the user's call.
      case 'orientation':
      case 'clearance':
      default:
        return null;
    }
  }

  const pending = new Map();

  /** Outline a question the user must answer, and remember it for the note. */
  function flag(el, label, kind) {
    const k = kind || kindOf(label);
    const name = (k && LABELS[k]) || String(label || 'A question').trim().slice(0, 60);
    pending.set(name, true);
    try {
      const target = el && (el.closest('fieldset,[role="radiogroup"],[class*="field" i],[class*="question" i]') || el);
      if (target && target.style) {
        target.style.outline = '2px solid #f59e0b';
        target.style.outlineOffset = '3px';
        target.style.borderRadius = target.style.borderRadius || '6px';
        target.setAttribute('data-prc-needs-you', name);
      }
    } catch (_) { /* never let highlighting break a fill */ }
  }

  function pendingList() { return Array.from(pending.keys()); }
  function reset() { pending.clear(); }

  /** A small, dismissible note listing what is left for the user. */
  function showSummary() {
    const items = pendingList();
    document.getElementById('prc-needs-you')?.remove();
    if (!items.length || !document.body) return;
    const box = document.createElement('div');
    box.id = 'prc-needs-you';
    box.setAttribute('role', 'status');
    box.style.cssText = 'position:fixed;left:20px;bottom:20px;z-index:2147483646;max-width:320px;background:#0f172a;color:#e2e8f0;border:1px solid rgba(245,158,11,0.45);border-radius:12px;padding:12px 14px;box-shadow:0 8px 28px rgba(0,0,0,0.4);font:13px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;';
    const title = document.createElement('div');
    title.style.cssText = 'font-weight:700;color:#fbbf24;margin-bottom:4px;';
    title.textContent = `${items.length} question${items.length === 1 ? '' : 's'} left for you`;
    const why = document.createElement('div');
    why.style.cssText = 'color:#94a3b8;font-size:12px;margin-bottom:6px;';
    why.textContent = 'We never answer these for you. They are outlined in amber. Save answers in your Preciprocal profile to fill them next time.';
    const ul = document.createElement('ul');
    ul.style.cssText = 'margin:0;padding-left:16px;';
    for (const it of items) { const li = document.createElement('li'); li.textContent = it; ul.appendChild(li); }
    const close = document.createElement('button');
    close.type = 'button';
    close.textContent = '×';
    close.setAttribute('aria-label', 'Dismiss');
    close.style.cssText = 'position:absolute;top:6px;right:8px;background:none;border:none;color:#64748b;font-size:18px;cursor:pointer;';
    close.addEventListener('click', () => box.remove());
    box.append(close, title, why, ul);
    document.body.appendChild(box);
  }

  window.PreciprocalSensitive = { kindOf, answer, flag, pendingList, reset, showSummary, LABELS };
})();

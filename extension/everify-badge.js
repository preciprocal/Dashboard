// everify-badge.js - the E-Verify chip shown while applying.
//
// STEM OPT needs an E-Verify employer, and the moment to know is before the
// application goes in. banner.js (LinkedIn) and external-apply.js
// (application portals) both use this: one place for the wording, the
// colours and the link to the official search.
//
// The data is the public E-Verify Employer Search, copied daily
// (/api/extension/everify). Nothing is shown when the copy is not available
// yet, and "not found" is worded as "we couldn't match it", never as "does
// not use E-Verify": names differ between job boards and the list.
//
// Inline styles with !important, because the chip lands inside pages whose
// CSS we do not control.
(function () {
  if (window.PreciprocalEverify) return;

  // Dark surfaces (LinkedIn's dark banner) and light ones (the portal
  // sidebar, LinkedIn's light banner) need different text colours to stay
  // readable; the light set matches the banner's own light risk pills.
  const STYLES = {
    dark: {
      enrolled:   { color: '#34d399', border: 'rgba(52,211,153,0.40)',  bg: 'rgba(52,211,153,0.10)' },
      ending:     { color: '#fbbf24', border: 'rgba(251,191,36,0.40)',  bg: 'rgba(251,191,36,0.10)' },
      ended:      { color: '#f87171', border: 'rgba(248,113,113,0.40)', bg: 'rgba(248,113,113,0.10)' },
      'not-found':{ color: '#cbd5e1', border: 'rgba(148,163,184,0.35)', bg: 'rgba(148,163,184,0.08)' },
    },
    light: {
      enrolled:   { color: '#047857', border: 'rgba(4,120,87,0.30)',    bg: 'rgba(16,185,129,0.10)' },
      ending:     { color: '#b45309', border: 'rgba(180,83,9,0.30)',    bg: 'rgba(245,158,11,0.12)' },
      ended:      { color: '#b91c1c', border: 'rgba(185,28,28,0.28)',   bg: 'rgba(239,68,68,0.10)' },
      'not-found':{ color: '#475569', border: 'rgba(71,85,105,0.28)',   bg: 'rgba(100,116,139,0.08)' },
    },
  };

  function fmtDate(iso) {
    if (!iso) return '';
    const d = new Date(iso.length <= 10 ? iso + 'T00:00:00' : iso);
    return isNaN(d) ? '' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function copy(status, syncedAt) {
    const checked = fmtDate(syncedAt);
    const source = `From the public E-Verify Employer Search (employer-reported${checked ? `, checked ${checked}` : ''}). Click to confirm on e-verify.gov.`;
    switch (status.state) {
      case 'enrolled':
        return { text: 'E-Verify: enrolled', tip: `${status.employer || 'This employer'} is enrolled in E-Verify, which STEM OPT requires. ${source}` };
      case 'ending':
        return { text: `E-Verify: until ${fmtDate(status.terminatesOn)}`, tip: `Enrolled, but the listing ends on ${fmtDate(status.terminatesOn)}. Worth confirming before relying on it for STEM OPT. ${source}` };
      case 'ended':
        return { text: 'E-Verify: enrollment ended', tip: `${status.employer || 'This employer'} is listed with an ended E-Verify enrollment. Ask the recruiter before counting on STEM OPT. ${source}` };
      default:
        return { text: 'E-Verify: no match found', tip: `We couldn't match this company in the E-Verify list. Names often differ (a parent company or legal name), so check the official search. ${source}` };
    }
  }

  async function fetchStatus({ company, token, userId, email, baseUrl }) {
    if (!company || company === 'Unknown Company' || !token) return null;
    try {
      const resp = await chrome.runtime.sendMessage({
        type: 'API_FETCH_EVERIFY', token, userId: userId || '', email: email || '', baseUrl,
        payload: { company },
      });
      const d = resp?.success ? resp.data : null;
      if (!d?.success || !d.available || !d.status) return null;
      return d;
    } catch { return null; }
  }

  /** The chip, or null when there is nothing trustworthy to show. */
  // tipMode 'data-tip' for banner.js, which draws its own tooltips; 'title'
  // (the browser's) everywhere else, so there is never a double tooltip.
  function chip(data, { size = 'md', tipMode = 'title', theme = 'dark' } = {}) {
    if (!data?.status) return null;
    const palette = STYLES[theme] || STYLES.dark;
    const st = palette[data.status.state] || palette['not-found'];
    const { text, tip } = copy(data.status, data.syncedAt);

    const a = document.createElement('a');
    a.className = 'prc-everify-chip';
    a.href = data.searchUrl || 'https://www.e-verify.gov/e-verify-employer-search';
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    if (tipMode === 'data-tip') a.setAttribute('data-tip', tip); else a.title = tip;
    a.setAttribute('aria-label', `${text}. ${tip}`);

    const dot = document.createElement('span');
    dot.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.textContent = text;
    a.append(dot, label);

    const set = (el, props) => { for (const [k, v] of Object.entries(props)) el.style.setProperty(k, v, 'important'); };
    set(a, {
      display: 'inline-flex', 'align-items': 'center', gap: '6px',
      padding: size === 'sm' ? '2px 8px' : '3px 10px',
      'font-size': size === 'sm' ? '11.5px' : '12px', 'font-weight': '600', 'line-height': '1.5',
      'font-family': 'inherit', 'border-radius': '999px', border: `1px solid ${st.border}`,
      background: st.bg, color: st.color, 'text-decoration': 'none', 'white-space': 'nowrap',
      cursor: 'pointer',
    });
    set(dot, { width: '6px', height: '6px', 'border-radius': '50%', background: st.color, 'flex-shrink': '0' });
    return a;
  }

  window.PreciprocalEverify = { fetchStatus, chip };
})();

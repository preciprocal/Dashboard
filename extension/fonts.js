// extension/fonts.js
//
// The app's own type on every page the extension draws on: Inter for text,
// Satoshi for headings, the same files the dashboard uses (app/fonts). They
// ship inside the extension, so a site that blocks Google Fonts still shows
// them. Registered under Prc names so a site's own "Inter" never collides.
(() => {
  if (window.__prcFontsLoaded || !document.fonts || typeof FontFace === 'undefined') return;
  window.__prcFontsLoaded = true;
  const url = (f) => `url(${chrome.runtime.getURL('fonts/' + f)}) format('woff2')`;
  const faces = [
    new FontFace('PrcInter', url('Inter-Variable.woff2'), { weight: '100 900', style: 'normal', display: 'swap' }),
    new FontFace('PrcSatoshi', url('Satoshi-500.woff2'), { weight: '500', style: 'normal', display: 'swap' }),
    new FontFace('PrcSatoshi', url('Satoshi-700.woff2'), { weight: '600 900', style: 'normal', display: 'swap' }),
  ];
  for (const f of faces) {
    try { document.fonts.add(f); f.load().catch(() => {}); } catch { /* fall back to system fonts */ }
  }
})();

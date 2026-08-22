// lib/resume/resolve-pdf-url.ts
// Client-safe helpers for opening/downloading a resume PDF regardless of
// whether `resumePath` is a legacy Firebase Storage download URL or a bare
// Supabase Storage path (Phase 1 of the migration — see
// C:\Users\yashv\.claude\plans\lovely-exploring-turing.md). Supabase's
// bucket is private, so bare paths are resolved to a short-lived signed URL
// on demand via /api/resume/proxy-pdf rather than stored as a permanent URL.

const SUPABASE_PATH_PREFIXES = ['resumes/', 'transcripts/', 'support-attachments/'];

export function isSupabaseStoragePath(value: string): boolean {
  return SUPABASE_PATH_PREFIXES.some((prefix) => value.startsWith(prefix));
}

/**
 * Fetch the raw PDF bytes for a resumePath value, whichever backend it lives on.
 */
export async function fetchResumePdfBytes(resumePath: string): Promise<ArrayBuffer> {
  if (resumePath.startsWith('http')) {
    const res = await fetch('/api/resume/proxy-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: resumePath }),
    });
    if (!res.ok) throw new Error(`Failed to load PDF (${res.status})`);
    return res.arrayBuffer();
  }

  if (isSupabaseStoragePath(resumePath)) {
    const res = await fetch('/api/resume/proxy-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: resumePath }),
    });
    if (!res.ok) throw new Error(`Failed to load PDF (${res.status})`);
    return res.arrayBuffer();
  }

  // Base64 data URL / raw base64 payload
  const base64 = resumePath.includes('base64,') ? resumePath.split('base64,')[1] : resumePath;
  const binary = atob(base64);
  const buf = new ArrayBuffer(binary.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
  return buf;
}

/**
 * Open or download a resume PDF in the browser, resolving a signed URL
 * on demand for Supabase-backed paths.
 */
export async function openResumePdf(
  resumePath: string,
  mode: 'view' | 'download' = 'view',
  downloadName?: string,
): Promise<void> {
  if (resumePath.startsWith('http')) {
    if (mode === 'download' && downloadName) {
      const a = Object.assign(document.createElement('a'), { href: resumePath, download: downloadName });
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else {
      window.open(resumePath, '_blank');
    }
    return;
  }

  const bytes = await fetchResumePdfBytes(resumePath);
  const blobUrl = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));

  if (mode === 'download' && downloadName) {
    const a = Object.assign(document.createElement('a'), { href: blobUrl, download: downloadName });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } else {
    window.open(blobUrl, '_blank');
  }

  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

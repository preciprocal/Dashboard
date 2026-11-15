// components/apply/ResumeChanges.tsx
//
// The student's own resume file, before and after this job's changes: the
// original with the replaced lines in red, and the edited file with the new
// lines in green. The edited file, under their file name, is what auto-apply
// and the extension upload.
'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, FileText, Loader2, AlertTriangle } from 'lucide-react';

interface PdfPage {
  getViewport: (p: { scale: number }) => { width: number; height: number };
  render: (p: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<void> };
}
interface PdfDoc { numPages: number; getPage: (n: number) => Promise<PdfPage>; destroy: () => Promise<void> }
interface PdfJs { GlobalWorkerOptions: { workerSrc: string }; getDocument: (src: { data: ArrayBuffer }) => { promise: Promise<PdfDoc> }; version: string }

let pdfjsPromise: Promise<PdfJs> | null = null;
const getPdfjs = () => (pdfjsPromise ??= import('pdfjs-dist').then(m => {
  const lib = m as unknown as PdfJs;
  lib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${lib.version}/pdf.worker.min.mjs`;
  return lib;
}));

/** Renders every page of a PDF into canvases inside `host`, at its width. */
async function renderInto(host: HTMLElement, data: ArrayBuffer, cancelled: () => boolean) {
  const lib = await getPdfjs();
  const doc = await lib.getDocument({ data }).promise;
  try {
    const canvases: HTMLCanvasElement[] = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const page = await doc.getPage(n);
      const base = page.getViewport({ scale: 1 });
      const width = host.clientWidth || 400;
      const viewport = page.getViewport({ scale: (width / base.width) * Math.min(2, window.devicePixelRatio || 1) });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      canvas.className = 'w-full h-auto block rounded-md bg-white shadow-sm';
      await page.render({ canvasContext: canvas.getContext('2d')!, viewport }).promise;
      if (cancelled()) return;
      canvases.push(canvas);
    }
    host.replaceChildren(...canvases);
  } finally {
    await doc.destroy();
  }
}

function Pane({ url, label, tone }: { url: string; label: string; tone: 'removed' | 'added' }) {
  const host = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    let stop = false;
    setState('loading');
    (async () => {
      try {
        const r = await fetch(url, { cache: 'no-store' });
        if (!r.ok) throw new Error(String(r.status));
        const data = await r.arrayBuffer();
        if (stop || !host.current) return;
        await renderInto(host.current, data, () => stop);
        if (!stop) setState('ready');
      } catch {
        if (!stop) setState('error');
      }
    })();
    return () => { stop = true; };
  }, [url]);

  return (
    <figure className="min-w-0">
      <figcaption className="flex items-center gap-2 mb-2 text-[12px] text-slate-400">
        <span className={`w-2.5 h-2.5 rounded-sm ${tone === 'removed' ? 'bg-rose-400/80' : 'bg-emerald-400/80'}`} />
        {label}
      </figcaption>
      <div className="relative rounded-lg border border-white/[0.08] bg-white/[0.02] p-2 max-h-[640px] overflow-y-auto">
        <div ref={host} className="space-y-2" />
        {state === 'loading' && (
          <div className="aspect-[8.5/11] flex items-center justify-center text-slate-500"><Loader2 className="w-5 h-5 animate-spin" /></div>
        )}
        {state === 'error' && (
          <p className="aspect-[8.5/11] flex items-center justify-center gap-2 text-[12.5px] text-slate-400"><AlertTriangle className="w-4 h-4 text-amber-400" /> Could not show the file</p>
        )}
      </div>
    </figure>
  );
}

export default function ResumeChanges({ applicationId, fileName, version, count }: {
  applicationId: string;
  fileName: string;
  /** Changes when the approved set changes, so both views reload. */
  version: string;
  /** Approved changes in the file. */
  count: number;
}) {
  const base = `/api/apply/${applicationId}/resume`;
  const v = encodeURIComponent(version);
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <p className="text-[12.5px] text-slate-400 flex items-center gap-1.5 min-w-0">
          <FileText className="w-3.5 h-3.5 text-indigo-300 flex-shrink-0" />
          <span className="truncate"><span className="text-white font-medium">{fileName}</span> with {count} change{count === 1 ? '' : 's'}. Auto-apply and the extension upload this file.</span>
        </p>
        <a href={`${base}?view=file&download=1&v=${v}`} className="btn-secondary h-9"><Download className="w-4 h-4" /> Download</a>
      </div>
      {count === 0 ? (
        <p className="text-[13px] text-slate-400 rounded-lg border border-white/[0.06] bg-white/[0.02] p-4">Approve a change above to see it in your resume.</p>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Pane url={`${base}?view=before&v=${v}`} label="Your resume: what changes, in red" tone="removed" />
          <Pane url={`${base}?view=after&v=${v}`} label="Updated resume: the new wording, in green" tone="added" />
        </div>
      )}
    </div>
  );
}

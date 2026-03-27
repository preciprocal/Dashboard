'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Eye, Download, FileText, ChevronLeft, ChevronRight, AlertCircle } from 'lucide-react';

interface ResumePreviewProps {
  resumePath:    string;
  onViewPdf:     () => void;
  onDownloadPdf: () => void;
}

interface PDFDocumentProxy {
  numPages: number;
  getPage:  (n: number) => Promise<PDFPageProxy>;
}

interface PDFAnnotation {
  subtype:    string;
  url?:       string;
  unsafeUrl?: string;
  rect:       [number, number, number, number];
}

interface PDFPageProxy {
  getViewport:    (p: { scale: number }) => { width: number; height: number };
  render:         (p: { canvasContext: CanvasRenderingContext2D; viewport: { width: number; height: number } }) => { promise: Promise<void> };
  getAnnotations: () => Promise<PDFAnnotation[]>;
}

interface PDFJSStatic {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument: (src: { data: ArrayBuffer }) => { promise: Promise<PDFDocumentProxy> };
  version: string;
}

interface LinkOverlay {
  url: string;
  top: number; left: number; width: number; height: number; // all in % of PDF page
}

// ─── PDF.js singleton ────────────────────────────────────────────────────────

let _pdfjs: PDFJSStatic | null = null;

async function getPdfjs(): Promise<PDFJSStatic> {
  if (_pdfjs) return _pdfjs;
  const lib = (await import('pdfjs-dist')) as unknown as PDFJSStatic;
  lib.GlobalWorkerOptions.workerSrc =
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${lib.version}/pdf.worker.min.mjs`;
  _pdfjs = lib;
  return lib;
}

async function fetchPdfBytes(resumePath: string): Promise<ArrayBuffer> {
  if (!resumePath.startsWith('http')) {
    const base64 = resumePath.includes('base64,') ? resumePath.split('base64,')[1] : resumePath;
    const binary = atob(base64);
    const buf    = new ArrayBuffer(binary.length);
    const view   = new Uint8Array(buf);
    for (let i = 0; i < binary.length; i++) view[i] = binary.charCodeAt(i);
    return buf;
  }
  const res = await fetch('/api/resume/proxy-pdf', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: resumePath }),
  });
  if (!res.ok) throw new Error(`Failed to load PDF (${res.status})`);
  return res.arrayBuffer();
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ResumePreview({ resumePath, onViewPdf, onDownloadPdf }: ResumePreviewProps) {
  const canvasRef     = useRef<HTMLCanvasElement>(null);
  const containerRef  = useRef<HTMLDivElement>(null);
  const renderTaskRef = useRef<{ cancel: () => void } | null>(null);

  const [pdfDoc,   setPdfDoc]   = useState<PDFDocumentProxy | null>(null);
  const [page,     setPage]     = useState(1);
  const [total,    setTotal]    = useState(0);
  const [status,   setStatus]   = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [errMsg,   setErrMsg]   = useState('');
  const [links,    setLinks]    = useState<LinkOverlay[]>([]);
  // Store raw PDF viewport so we can recompute link positions on resize
  const pdfViewportRef = useRef<{ width: number; height: number } | null>(null);

  // ── Load PDF ───────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!resumePath) return;
    let cancelled = false;
    (async () => {
      setStatus('loading'); setErrMsg('');
      try {
        const [lib, bytes] = await Promise.all([getPdfjs(), fetchPdfBytes(resumePath)]);
        if (cancelled) return;
        const doc = await lib.getDocument({ data: bytes }).promise;
        if (cancelled) return;
        setPdfDoc(doc); setTotal(doc.numPages); setPage(1); setStatus('ready');
      } catch (err) {
        if (cancelled) return;
        setErrMsg(err instanceof Error ? err.message : 'Failed to load PDF');
        setStatus('error');
      }
    })();
    return () => { cancelled = true; };
  }, [resumePath]);

  // ── Compute link overlay positions from stored PDF viewport ───────────────
  // Called after render AND on container resize so overlays always align.

  const computeLinks = useCallback(async (
    pdfPage: PDFPageProxy,
    pdfVp: { width: number; height: number },
    canvasEl: HTMLCanvasElement,
  ) => {
    const annotations = await pdfPage.getAnnotations();
    const rect        = canvasEl.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    const overlays: LinkOverlay[] = annotations
      .filter(a => a.subtype === 'Link' && (a.url || a.unsafeUrl))
      .map(a => {
        const url          = a.url || a.unsafeUrl || '';
        const [x1, y1, x2, y2] = a.rect;
        // PDF origin is bottom-left; convert to top-left % for CSS
        return {
          url,
          left:   (x1 / pdfVp.width)            * 100,
          top:    ((pdfVp.height - y2) / pdfVp.height) * 100,
          width:  ((x2 - x1) / pdfVp.width)     * 100,
          height: ((y2 - y1) / pdfVp.height)    * 100,
        };
      });
    setLinks(overlays);
  }, []);

  // ── Render page ────────────────────────────────────────────────────────────

  const renderPage = useCallback(async (doc: PDFDocumentProxy, pageNum: number) => {
    const canvas    = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    if (renderTaskRef.current) { renderTaskRef.current.cancel(); renderTaskRef.current = null; }

    try {
      const pdfPage = await doc.getPage(pageNum);

      // High-DPI: render at 2× device pixel ratio for crisp text
      const dpr        = Math.min(window.devicePixelRatio ?? 1, 3); // cap at 3× to avoid memory issues
      const containerW = container.clientWidth || 700;

      // Scale to fill container width, then multiply by dpr for sharpness
      const viewport1x = pdfPage.getViewport({ scale: 1 });
      const cssScale   = containerW / viewport1x.width;
      const renderScale= cssScale * dpr;
      const viewport   = pdfPage.getViewport({ scale: renderScale });

      // Canvas buffer = full resolution; CSS display = container width
      canvas.width        = Math.floor(viewport.width);
      canvas.height       = Math.floor(viewport.height);
      canvas.style.width  = '100%';
      canvas.style.height = 'auto';

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const task = pdfPage.render({ canvasContext: ctx, viewport });
      renderTaskRef.current = task as unknown as { cancel: () => void };
      await task.promise;
      renderTaskRef.current = null;

      // Store unscaled PDF viewport for link coord conversion
      pdfViewportRef.current = { width: viewport1x.width, height: viewport1x.height };
      await computeLinks(pdfPage, pdfViewportRef.current, canvas);

    } catch (err: unknown) {
      if (err instanceof Error && err.message?.includes('cancelled')) return;
      console.error('❌ Page render error:', err);
    }
  }, [computeLinks]);

  useEffect(() => {
    if (status === 'ready' && pdfDoc) { setLinks([]); renderPage(pdfDoc, page); }
  }, [status, pdfDoc, page, renderPage]);

  // ── Recompute link overlays on container resize ────────────────────────────
  // The canvas CSS size changes on resize but links are stored as % so they
  // stay aligned automatically — no recalculation needed. The % approach handles it.

  const showPagination = status === 'ready' && total > 1;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="h-full flex flex-col overflow-hidden min-w-0">

      {/* Canvas area */}
      <div ref={containerRef} className="flex-1 min-h-0 relative overflow-hidden bg-slate-900/60">

        {status === 'loading' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 z-10">
            <div className="relative">
              <div className="w-10 h-10 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
              <FileText className="w-4 h-4 text-indigo-400 absolute inset-0 m-auto" />
            </div>
            <p className="text-[11px] text-slate-500 font-medium">Loading preview…</p>
          </div>
        )}

        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-4 z-10">
            <div className="w-10 h-10 rounded-xl bg-red-500/10 flex items-center justify-center">
              <AlertCircle className="w-5 h-5 text-red-400" />
            </div>
            <div className="text-center">
              <p className="text-[12px] font-semibold text-red-400 mb-1">Preview failed</p>
              <p className="text-[10px] text-slate-600 leading-relaxed">{errMsg || 'Could not render PDF'}</p>
            </div>
          </div>
        )}

        {!resumePath && status === 'idle' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 z-10">
            <div className="w-10 h-10 rounded-xl bg-slate-800/60 flex items-center justify-center">
              <FileText className="w-5 h-5 text-slate-600" />
            </div>
            <p className="text-[11px] text-slate-600">No preview available</p>
          </div>
        )}

        {/* Scrollable PDF area */}
        <div className="absolute inset-0 overflow-y-auto overflow-x-hidden glass-scrollbar">
          {/* position:relative so link <a> tags are positioned against the canvas */}
          <div className="relative w-full">
            <canvas
              ref={canvasRef}
              className={`block w-full transition-opacity duration-300 ${
                status === 'ready' ? 'opacity-100' : 'opacity-0 pointer-events-none'
              }`}
            />
            {/* Clickable link overlays — positioned as % of the canvas element */}
            {status === 'ready' && links.map((link, i) => (
              <a
                key={i}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                title={link.url}
                style={{
                  position: 'absolute',
                  top:    `${link.top}%`,
                  left:   `${link.left}%`,
                  width:  `${link.width}%`,
                  height: `${link.height}%`,
                  cursor: 'pointer',
                  // Uncomment to debug overlay positions:
                  // background: 'rgba(255,0,0,0.2)',
                }}
              />
            ))}
          </div>
        </div>

        {/* Page counter */}
        {showPagination && (
          <div className="absolute top-2.5 right-2.5 z-20 flex items-center gap-1 px-2 py-1
                          bg-black/60 backdrop-blur-sm rounded-lg border border-white/10">
            <span className="text-[10px] font-medium text-slate-300">{page} / {total}</span>
          </div>
        )}

        {/* Action buttons — floating over PDF */}
        <div className="absolute bottom-3 left-3 right-3 z-20 flex gap-2">
          <button onClick={onViewPdf} disabled={!resumePath}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl
                       text-[11px] font-medium text-white bg-black/60 backdrop-blur-sm
                       border border-white/10 hover:bg-black/80 hover:border-white/20
                       disabled:opacity-30 disabled:cursor-not-allowed transition-all">
            <Eye className="w-3 h-3" /> View PDF
          </button>
          <button onClick={onDownloadPdf} disabled={!resumePath}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl
                       text-[11px] font-medium text-white bg-black/60 backdrop-blur-sm
                       border border-white/10 hover:bg-black/80 hover:border-white/20
                       disabled:opacity-30 disabled:cursor-not-allowed transition-all">
            <Download className="w-3 h-3" /> Download
          </button>
        </div>
      </div>

      {/* Pagination */}
      {showPagination && (
        <div className="flex items-center justify-center gap-2 py-2 flex-shrink-0 bg-slate-900/40">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/[0.04]
                       border border-white/[0.08] text-slate-400 hover:bg-white/[0.08]
                       hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all">
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(total, 5) }, (_, i) => {
              const p = total <= 5 ? i + 1 : Math.max(1, Math.min(total - 4, page - 2)) + i;
              return (
                <button key={p} onClick={() => setPage(p)}
                  className={`rounded-full transition-all ${p === page ? 'w-4 h-1.5 bg-indigo-500' : 'w-1.5 h-1.5 bg-white/20 hover:bg-white/40'}`} />
              );
            })}
          </div>
          <button onClick={() => setPage(p => Math.min(total, p + 1))} disabled={page === total}
            className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/[0.04]
                       border border-white/[0.08] text-slate-400 hover:bg-white/[0.08]
                       hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all">
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
// pdf.js ships no types for its worker module. lib/applications/pdf-edit.ts
// imports it only for its side effect (it sets globalThis.pdfjsWorker).
declare module 'pdfjs-dist/legacy/build/pdf.worker.mjs';

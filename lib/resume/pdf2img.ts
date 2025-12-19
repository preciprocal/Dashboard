// lib/pdf2img.ts
import { PdfConversionResult } from '@/types/resume';

interface PDFJSLib {
  GlobalWorkerOptions: {
    workerSrc: string;
  };
  getDocument: (params: { data: ArrayBuffer }) => {
    promise: Promise<PDFDocument>;
  };
}

interface PDFDocument {
  numPages: number;
  getPage: (pageNum: number) => Promise<PDFPage>;
}

interface PDFPage {
  getViewport: (params: { scale: number }) => PDFViewport;
  render: (params: { canvasContext: CanvasRenderingContext2D; viewport: PDFViewport }) => {
    promise: Promise<void>;
  };
}

interface PDFViewport {
  width: number;
  height: number;
}

let pdfjsLib: PDFJSLib | null = null;
let loadPromise: Promise<PDFJSLib> | null = null;

async function loadPdfJs(): Promise<PDFJSLib> {
  if (pdfjsLib) return pdfjsLib;
  if (loadPromise) return loadPromise;

  loadPromise = import("pdfjs-dist").then((lib) => {
    lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.worker.min.mjs';
    pdfjsLib = lib as unknown as PDFJSLib;
    return pdfjsLib;
  });
  
  return await loadPromise;
}

export async function convertPdfToImage(file: File): Promise<PdfConversionResult> {
  try {
    console.log('Starting PDF conversion for file:', file.name);
    
    const lib = await loadPdfJs();
    console.log('PDF.js library loaded successfully');

    const arrayBuffer = await file.arrayBuffer();
    console.log('File read as array buffer, size:', arrayBuffer.byteLength);
    
    const loadingTask = lib.getDocument({ data: arrayBuffer });
    const pdf = await loadingTask.promise;
    console.log('PDF document loaded, pages:', pdf.numPages);
    
    const page = await pdf.getPage(1);
    console.log('First page loaded');

    const scale = 1.5;
    const viewport = page.getViewport({ scale });
    
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (!context) {
      throw new Error("Could not get canvas 2D context");
    }

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    console.log('Canvas created:', { width: canvas.width, height: canvas.height });

    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";

    const renderContext = {
      canvasContext: context,
      viewport: viewport,
    };

    await page.render(renderContext).promise;
    console.log('Page rendered to canvas');

    return new Promise((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const originalName = file.name.replace(/\.pdf$/i, "");
            const imageFile = new File([blob], `${originalName}.png`, {
              type: "image/png",
            });

            console.log('Conversion successful, image size:', blob.size);

            resolve({
              success: true,
              imageUrl: URL.createObjectURL(blob),
              file: imageFile,
            });
          } else {
            console.error('Failed to create blob from canvas');
            resolve({
              success: false,
              imageUrl: "",
              file: undefined,
              error: "Failed to create image blob from canvas",
            });
          }
        },
        "image/png",
        0.9
      );
    });
  } catch (err) {
    console.error('PDF conversion error:', err);
    return {
      success: false,
      imageUrl: "",
      file: undefined,
      error: `Failed to convert PDF: ${err instanceof Error ? err.message : 'Unknown error'}`,
    };
  }
}
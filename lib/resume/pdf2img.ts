// lib/pdf2img.ts
import { PdfConversionResult } from '@/types/resume';

let pdfjsLib: any = null;
let isLoading = false;
let loadPromise: Promise<any> | null = null;

async function loadPdfJs(): Promise<any> {
  if (pdfjsLib) return pdfjsLib;
  if (loadPromise) return loadPromise;

  isLoading = true;
  try {
    loadPromise = import("pdfjs-dist").then((lib) => {
      // Use the matching worker version for 4.8.69
      lib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.8.69/pdf.worker.min.mjs';
      pdfjsLib = lib;
      isLoading = false;
      return lib;
    });
    return await loadPromise;
  } catch (error) {
    isLoading = false;
    loadPromise = null;
    throw error;
  }
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

    // Use reasonable scale for good quality without memory issues
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

    // Enable high quality rendering
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
              imageUrl: URL.createObjectURL(blob),
              file: imageFile,
            });
          } else {
            console.error('Failed to create blob from canvas');
            resolve({
              imageUrl: "",
              file: null,
              error: "Failed to create image blob from canvas",
            });
          }
        },
        "image/png",
        0.9 // Good quality balance
      );
    });
  } catch (err) {
    console.error('PDF conversion error:', err);
    return {
      imageUrl: "",
      file: null,
      error: `Failed to convert PDF: ${err instanceof Error ? err.message : 'Unknown error'}`,
    };
  }
}
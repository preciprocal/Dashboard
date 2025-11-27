// lib/resume/pdf-parser.ts

interface TextContentItem {
  str: string;
  [key: string]: unknown;
}

interface TextContent {
  items: TextContentItem[];
}

interface PDFPage {
  getTextContent: () => Promise<TextContent>;
}

interface PDFDocumentProxy {
  numPages: number;
  getPage: (pageNum: number) => Promise<PDFPage>;
}

/**
 * Extract text from PDF file (Client-side)
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  try {
    const pdfjsLib = await import('pdfjs-dist');
    
    // Set worker source
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

    const arrayBuffer = await file.arrayBuffer();
    
    const loadingTask = pdfjsLib.getDocument({ 
      data: arrayBuffer,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    });
    
    const pdf = await loadingTask.promise as unknown as PDFDocumentProxy;

    console.log(`📄 PDF loaded: ${pdf.numPages} pages`);

    const textPromises: Promise<string>[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      textPromises.push(extractPageText(pdf, i));
    }

    const pageTexts = await Promise.all(textPromises);
    const fullText = pageTexts.join('\n\n');

    console.log(`✅ Extracted ${fullText.length} characters`);

    return fullText;
  } catch (error) {
    console.error('PDF extraction error:', error);
    throw new Error('Failed to extract text from PDF');
  }
}

/**
 * Extract text from a single page
 */
async function extractPageText(pdf: PDFDocumentProxy, pageNumber: number): Promise<string> {
  try {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();

    const text = textContent.items
      .map((item: TextContentItem) => item.str)
      .join(' ')
      .trim();

    return text;
  } catch (error) {
    console.error(`Error extracting page ${pageNumber}:`, error);
    return '';
  }
}

/**
 * Validate PDF file
 */
export function validatePDFFile(file: File): {
  valid: boolean;
  error?: string;
} {
  if (file.type !== 'application/pdf') {
    return {
      valid: false,
      error: 'File must be a PDF',
    };
  }

  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'File size must be less than 10MB',
    };
  }

  return { valid: true };
}
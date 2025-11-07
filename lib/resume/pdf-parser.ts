// lib/utils/pdf-parser.ts

import { getDocument } from 'pdfjs-dist/legacy/build/pdf';

// For Node.js environment, we need to use the legacy build
if (typeof window === 'undefined') {
  // Server-side configuration
  const pdfjsLib = require('pdfjs-dist/legacy/build/pdf');
  
  // Disable worker in Node.js environment
  pdfjsLib.GlobalWorkerOptions.workerSrc = '';
}

/**
 * Extract text from PDF file (Server-side compatible)
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  try {
    // Convert file to array buffer
    const arrayBuffer = await file.arrayBuffer();
    
    // Use legacy build for better compatibility
    const pdfjsLib = typeof window === 'undefined' 
      ? require('pdfjs-dist/legacy/build/pdf')
      : await import('pdfjs-dist');

    // Load PDF document
    const loadingTask = pdfjsLib.getDocument({ 
      data: arrayBuffer,
      useWorkerFetch: false,
      isEvalSupported: false,
      useSystemFonts: true,
    });
    
    const pdf = await loadingTask.promise;

    console.log(`📄 PDF loaded: ${pdf.numPages} pages`);

    // Extract text from all pages
    const textPromises: Promise<string>[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      textPromises.push(extractPageText(pdf, i));
    }

    const pageTexts = await Promise.all(textPromises);

    // Combine all pages
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
async function extractPageText(pdf: any, pageNumber: number): Promise<string> {
  try {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();

    // Combine text items
    const text = textContent.items
      .map((item: any) => item.str)
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
  // Check file type
  if (file.type !== 'application/pdf') {
    return {
      valid: false,
      error: 'File must be a PDF',
    };
  }

  // Check file size (max 10MB)
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'File size must be less than 10MB',
    };
  }

  return { valid: true };
}
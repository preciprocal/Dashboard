// lib/resume/pdf-parser-server.ts
import pdf from 'pdf-parse';

interface ParsedPDF {
  text: string;
  numPages: number;
  metadata: any;
}

/**
 * Parse PDF buffer to extract text (server-side only)
 */
export async function parsePDFServer(buffer: Buffer): Promise<ParsedPDF> {
  try {
    const data = await pdf(buffer);
    
    return {
      text: data.text,
      numPages: data.numpages,
      metadata: data.info
    };
  } catch (err) {
    console.error('PDF parsing error:', err);
    throw new Error('Failed to parse PDF');
  }
}

/**
 * Extract text from PDF file (Server-side only)
 */
export async function extractTextFromPDF(file: File): Promise<string> {
  try {
    console.log('📄 Starting PDF text extraction...');

    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Parse PDF
    const data = await pdf(buffer);

    console.log(`✅ Extracted text from ${data.numpages} pages`);
    console.log(`   Total characters: ${data.text.length}`);

    // Clean up the text
    const cleanedText = data.text
      .replace(/\s+/g, ' ')
      .replace(/\n\s*\n/g, '\n\n')
      .trim();

    if (cleanedText.length < 100) {
      throw new Error('Extracted text is too short. PDF might be image-based or corrupted.');
    }

    return cleanedText;
  } catch (err) {
    console.error('❌ PDF extraction error:', err);
    
    if (err instanceof Error) {
      throw new Error(`Failed to extract PDF text: ${err.message}`);
    }
    
    throw new Error('Failed to extract text from PDF');
  }
}

/**
 * Get PDF metadata
 */
export async function getPDFMetadata(file: File): Promise<{
  pages: number;
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
}> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const data = await pdf(buffer);

    return {
      pages: data.numpages,
      title: data.info?.Title,
      author: data.info?.Author,
      subject: data.info?.Subject,
      keywords: data.info?.Keywords,
    };
  } catch (err) {
    console.error('PDF metadata error:', err);
    throw err;
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

  if (file.size < 1024) {
    return {
      valid: false,
      error: 'File appears to be empty or corrupted',
    };
  }

  return { valid: true };
}

/**
 * Check if PDF is text-based or image-based
 */
export async function isPDFTextBased(file: File): Promise<boolean> {
  try {
    const text = await extractTextFromPDF(file);
    return text.length > 50;
  } catch {
    return false;
  }
}
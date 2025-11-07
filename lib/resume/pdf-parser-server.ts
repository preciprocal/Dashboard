// lib/utils/pdf-parser-server.ts

import pdf from 'pdf-parse';

/**
 * Extract text from PDF file (Server-side only)
 * This is the recommended approach for API routes
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
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .replace(/\n\s*\n/g, '\n\n') // Normalize line breaks
      .trim();

    if (cleanedText.length < 100) {
      throw new Error('Extracted text is too short. PDF might be image-based or corrupted.');
    }

    return cleanedText;
  } catch (error) {
    console.error('❌ PDF extraction error:', error);
    
    if (error instanceof Error) {
      throw new Error(`Failed to extract PDF text: ${error.message}`);
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
  } catch (error) {
    console.error('PDF metadata error:', error);
    throw error;
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

  // Check minimum size (1KB)
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
    // If we got reasonable amount of text, it's text-based
    return text.length > 50;
  } catch (error) {
    return false;
  }
}
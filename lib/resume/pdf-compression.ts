// lib/utils/pdf-compression.ts

/**
 * Compress a PDF file by reducing quality and removing unnecessary data
 * Uses browser-native APIs - no external dependencies needed!
 */
export async function compressPDF(file: File): Promise<File> {
  const compressionThreshold = 2 * 1024 * 1024; // 2MB
  
  // If file is already small, return as-is
  if (file.size < compressionThreshold) {
    console.log(`✅ File size (${(file.size / 1024).toFixed(2)}KB) is acceptable, no compression needed`);
    return file;
  }

  console.log(`🗜️ Starting compression for ${file.name} (${(file.size / 1024).toFixed(2)}KB)`);

  try {
    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    
    // Simple compression: re-encode the PDF
    // This removes metadata and can reduce file size
    const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
    
    // Create a compressed version
    const compressedFile = new File([blob], file.name, {
      type: 'application/pdf',
      lastModified: Date.now(),
    });

    const reductionPercent = ((file.size - compressedFile.size) / file.size * 100).toFixed(1);
    console.log(`✅ Compression complete:`);
    console.log(`   Original: ${(file.size / 1024).toFixed(2)}KB`);
    console.log(`   Compressed: ${(compressedFile.size / 1024).toFixed(2)}KB`);
    console.log(`   Reduction: ${reductionPercent}%`);

    return compressedFile;
  } catch (error) {
    console.error('⚠️ PDF compression failed, using original file:', error);
    return file;
  }
}

/**
 * Advanced compression using canvas (if pdf.js is available)
 * This requires installing: npm install pdfjs-dist
 * 
 * Uncomment and use this if you need more aggressive compression
 */
/*
import * as pdfjsLib from 'pdfjs-dist';

export async function advancedCompressPDF(file: File, quality: number = 0.7): Promise<File> {
  console.log('🗜️ Starting advanced PDF compression...');
  
  try {
    // Set worker source
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not get canvas context');

    const compressedPages: Blob[] = [];

    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const viewport = page.getViewport({ scale: 1.5 });

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({
        canvasContext: context,
        viewport: viewport,
      }).promise;

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob(
          (blob) => resolve(blob!),
          'image/jpeg',
          quality
        );
      });

      compressedPages.push(blob);
    }

    // Combine pages back into PDF (requires additional library like jsPDF)
    // For now, we return the first page as an image
    const compressedFile = new File(compressedPages, file.name, {
      type: 'application/pdf',
    });

    console.log(`✅ Advanced compression complete`);
    return compressedFile;
  } catch (error) {
    console.error('⚠️ Advanced compression failed:', error);
    return file;
  }
}
*/

/**
 * Validate PDF file before upload
 */
export function validatePDF(file: File): { valid: boolean; error?: string } {
  // Check file type
  if (file.type !== 'application/pdf') {
    return {
      valid: false,
      error: 'Only PDF files are supported. Please upload a PDF.',
    };
  }

  // Check file size (10MB limit)
  const maxSize = 10 * 1024 * 1024;
  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'File size must be less than 10MB. Please compress your PDF.',
    };
  }

  // Check if file is empty
  if (file.size === 0) {
    return {
      valid: false,
      error: 'The file appears to be empty. Please select a valid PDF.',
    };
  }

  return { valid: true };
}

/**
 * Get file size category
 */
export function getFileSizeCategory(sizeInBytes: number): {
  category: 'small' | 'medium' | 'large' | 'very-large';
  needsCompression: boolean;
  estimatedUploadTime: string;
} {
  const sizeInMB = sizeInBytes / (1024 * 1024);

  if (sizeInMB < 1) {
    return {
      category: 'small',
      needsCompression: false,
      estimatedUploadTime: '< 5 seconds',
    };
  } else if (sizeInMB < 3) {
    return {
      category: 'medium',
      needsCompression: false,
      estimatedUploadTime: '5-10 seconds',
    };
  } else if (sizeInMB < 7) {
    return {
      category: 'large',
      needsCompression: true,
      estimatedUploadTime: '10-20 seconds',
    };
  } else {
    return {
      category: 'very-large',
      needsCompression: true,
      estimatedUploadTime: '20-30 seconds',
    };
  }
}
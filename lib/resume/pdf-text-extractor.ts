// lib/resume/pdf-text-extractor.ts
// Utility to extract text from PDF files using PDF.js without worker

export async function extractTextFromPDF(pdfUrl: string): Promise<string> {
  try {
    const pdfjsLib = await import('pdfjs-dist');
    
    // Configure to work without external worker
    pdfjsLib.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;

    console.log('📄 Loading PDF from URL:', pdfUrl.substring(0, 50) + '...');

    const loadingTask = pdfjsLib.getDocument(pdfUrl);
    const pdf = await loadingTask.promise;

    console.log('📄 PDF loaded, total pages:', pdf.numPages);

    let fullText = '';

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      let pageText = '';
      let lastY = 0;
      
      textContent.items.forEach((item: any) => {
        if (lastY !== 0 && Math.abs(item.transform[5] - lastY) > 5) {
          pageText += '\n';
        }
        
        if (item.str.trim()) {
          pageText += item.str + ' ';
        }
        
        lastY = item.transform[5];
      });
      
      fullText += pageText.trim() + '\n\n';
      console.log(`✅ Page ${pageNum}/${pdf.numPages} extracted`);
    }

    const finalText = fullText.trim();
    console.log('✅ Total text extracted:', finalText.length, 'characters');
    
    return finalText;
  } catch (error) {
    console.error('❌ Error extracting text from PDF URL:', error);
    throw new Error(`PDF extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Extract text from base64 encoded PDF without worker
export async function extractTextFromBase64PDF(base64Data: string): Promise<string> {
  try {
    console.log('📦 Starting base64 PDF extraction...');
    
    // Remove data URI prefix if present
    const base64String = base64Data.includes('base64,') 
      ? base64Data.split('base64,')[1] 
      : base64Data;

    console.log('📦 Base64 string length:', base64String.length);

    // Convert base64 to binary
    const binaryString = atob(base64String);
    const bytes = new Uint8Array(binaryString.length);
    
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    console.log('📦 Binary data size:', bytes.length, 'bytes');

    // Import PDF.js - use unpkg CDN for worker
    const pdfjsLib = await import('pdfjs-dist');
    
    // Set worker source to unpkg (more reliable than cdnjs)
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.js`;

    console.log('📦 Loading PDF from bytes...');
    console.log('🔧 Worker source:', pdfjsLib.GlobalWorkerOptions.workerSrc);

    // Load PDF from bytes
    const loadingTask = pdfjsLib.getDocument({ 
      data: bytes,
    });
    
    const pdf = await loadingTask.promise;

    console.log('📄 PDF loaded successfully, total pages:', pdf.numPages);

    let fullText = '';

    // Extract text from each page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      console.log(`🔄 Processing page ${pageNum}/${pdf.numPages}...`);
      
      try {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        let pageText = '';
        let lastY = 0;
        let lastX = 0;
        
        textContent.items.forEach((item: any) => {
          const currentY = item.transform[5];
          const currentX = item.transform[4];
          
          // Detect new line
          if (lastY !== 0 && Math.abs(currentY - lastY) > 5) {
            pageText += '\n';
            lastX = 0;
          }
          // Detect horizontal gap
          else if (lastX !== 0 && (currentX - lastX) > 100) {
            pageText += '  ';
          }
          
          // Add the text
          if (item.str.trim()) {
            pageText += item.str;
            
            if (!item.str.match(/[\s\-\.\,\;\:\!\?]$/)) {
              pageText += ' ';
            }
          }
          
          lastY = currentY;
          lastX = currentX + (item.width || 0);
        });
        
        fullText += pageText.trim() + '\n\n';
        console.log(`✅ Page ${pageNum}/${pdf.numPages} extracted (${pageText.length} chars)`);
      } catch (pageError) {
        console.error(`❌ Error extracting page ${pageNum}:`, pageError);
        fullText += `\n\n[Error extracting page ${pageNum}]\n\n`;
      }
    }

    const finalText = fullText.trim();
    console.log('✅ Total text extracted:', finalText.length, 'characters');
    console.log('📝 Preview:', finalText.substring(0, 200));
    
    if (finalText.length === 0) {
      throw new Error('No text could be extracted from the PDF');
    }
    
    return finalText;
  } catch (error) {
    console.error('❌ Error extracting text from base64 PDF:', error);
    throw new Error(`PDF extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Format extracted text for better readability
export function formatResumeText(rawText: string): string {
  return rawText
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();
}

// Check if a string is base64 encoded
export function isBase64PDF(data: string): boolean {
  return data.startsWith('data:application/pdf;base64,') || 
         (data.length % 4 === 0 && /^[A-Za-z0-9+/=]+$/.test(data));
}

// Main extraction function that automatically detects format
export async function extractTextFromResume(resumePath: string): Promise<string> {
  try {
    console.log('🔍 Detecting PDF format...');
    
    if (!resumePath) {
      throw new Error('Resume path is empty');
    }

    // Check if it's a base64 PDF
    if (resumePath.startsWith('data:application/pdf;base64,')) {
      console.log('📦 Detected base64 PDF');
      return await extractTextFromBase64PDF(resumePath);
    }
    // Check if it's a URL
    else if (resumePath.startsWith('http://') || resumePath.startsWith('https://')) {
      console.log('🌐 Detected PDF URL');
      return await extractTextFromPDF(resumePath);
    }
    // Check if it's raw base64
    else if (isBase64PDF(resumePath)) {
      console.log('📦 Detected raw base64 data');
      return await extractTextFromBase64PDF(resumePath);
    }
    else {
      throw new Error('Invalid resume path format. Must be a URL or base64 PDF.');
    }
  } catch (error) {
    console.error('❌ Resume text extraction failed:', error);
    throw error;
  }
}
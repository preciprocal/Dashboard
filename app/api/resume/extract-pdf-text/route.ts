// app/api/resume/extract-pdf-text/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export async function POST(request: NextRequest) {
  try {
    const { resumeId, pdfBase64 } = await request.json();

    console.log('📄 PDF text extraction request for:', resumeId);

    if (!resumeId || !pdfBase64) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    if (!genAI || !apiKey) {
      console.error('❌ Gemini API not configured');
      return NextResponse.json(
        { error: 'AI service not configured' },
        { status: 500 }
      );
    }

    // Use Gemini Flash model for PDF processing
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash-exp' 
    });

    console.log('🤖 Sending PDF to Gemini for text extraction...');

    // Extract base64 data
    const base64Data = pdfBase64.includes('base64,') 
      ? pdfBase64.split('base64,')[1] 
      : pdfBase64;

    const result = await model.generateContent([
      {
        inlineData: {
          data: base64Data,
          mimeType: 'application/pdf'
        }
      },
      `Extract ALL text from this PDF resume/document. 

IMPORTANT INSTRUCTIONS:
- Extract EVERY word, sentence, and section
- Preserve the original structure and formatting
- Keep headings as they appear (usually in ALL CAPS)
- Maintain bullet points with • or - symbols
- Preserve dates, phone numbers, emails exactly as shown
- Keep line breaks between sections
- Do NOT summarize or paraphrase - extract the EXACT text
- Do NOT add any commentary or explanations
- Output ONLY the extracted text

Return the complete text content of this document.`
    ]);

    const response = await result.response;
    const extractedText = response.text();

    console.log('✅ Gemini extracted text:', extractedText.length, 'characters');
    console.log('📝 Preview:', extractedText.substring(0, 200));

    if (!extractedText || extractedText.length < 50) {
      throw new Error('Extracted text is too short');
    }

    return NextResponse.json({
      success: true,
      text: extractedText
    });

  } catch (error) {
    console.error('❌ PDF extraction error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to extract text from PDF',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
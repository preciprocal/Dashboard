// app/api/resume/extract-pdf-text/route.ts
// Accepts the actual PDF (or image) file via multipart/form-data.
// Gemini reads it natively — no base64 JSON payloads, no data-URL juggling.
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const genAI  = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file     = formData.get('file')     as File   | null;
    const resumeId = formData.get('resumeId') as string | null;

    console.log('📄 PDF text extraction request for:', resumeId);

    if (!file || !resumeId) {
      return NextResponse.json(
        { error: 'Missing required fields: file and resumeId' },
        { status: 400 },
      );
    }

    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isImg = file.type.startsWith('image/');

    if (!isPdf && !isImg) {
      return NextResponse.json(
        { error: 'File must be a PDF or image (PNG, JPEG, WebP)' },
        { status: 400 },
      );
    }

    if (!genAI || !apiKey) {
      console.error('❌ Gemini API not configured');
      return NextResponse.json(
        { error: 'AI service not configured — add GOOGLE_GENERATIVE_AI_API_KEY' },
        { status: 500 },
      );
    }

    // Convert file to base64 for Gemini inlineData
    const arrayBuffer = await file.arrayBuffer();
    const base64Data  = Buffer.from(arrayBuffer).toString('base64');
    const mimeType    = isPdf ? 'application/pdf' : file.type;

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-001' });

    console.log(`🤖 Sending ${isPdf ? 'PDF' : 'image'} to Gemini for text extraction...`);

    const result = await model.generateContent([
      {
        inlineData: { data: base64Data, mimeType },
      },
      `Extract ALL text from this resume ${isPdf ? 'PDF' : 'image'} with complete accuracy.

INSTRUCTIONS:
- Capture every word, number, date, email, phone number, URL exactly as shown
- Preserve all section headers (EDUCATION, EXPERIENCE, SKILLS, PROJECTS, etc.)
- Include all job titles, company names, dates, and locations
- Extract every bullet point in full
- Include all technical skills, tools, frameworks, and languages
- Include contact information (name, email, phone, LinkedIn, GitHub)
- Do NOT summarise, interpret, or modify — extract exactly what is present
- Output ONLY the extracted text, nothing else

Return the complete text content of this document.`,
    ]);

    const extractedText = result.response.text().trim();

    console.log('✅ Extracted text length:', extractedText.length);
    console.log('📝 Preview:', extractedText.substring(0, 200));

    if (!extractedText || extractedText.length < 50) {
      throw new Error('Extracted text is too short — the file may be empty or unreadable');
    }

    return NextResponse.json({ success: true, text: extractedText });

  } catch (error) {
    console.error('❌ PDF extraction error:', error);
    return NextResponse.json(
      {
        error:   'Failed to extract text from file',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
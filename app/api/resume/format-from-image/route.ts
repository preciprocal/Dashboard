// app/api/resume/format-from-image/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

export async function POST(request: NextRequest) {
  try {
    const { resumeId, imageBase64 } = await request.json();

    console.log('🎨 Vision formatting request for resume:', resumeId);

    if (!resumeId || !imageBase64) {
      return NextResponse.json(
        { error: 'Missing resumeId or imageBase64' },
        { status: 400 }
      );
    }

    if (!genAI || !apiKey) {
      console.error('❌ Gemini API not configured');
      return NextResponse.json(
        { error: 'AI service not configured. Please check GOOGLE_GENERATIVE_AI_API_KEY environment variable.' },
        { status: 500 }
      );
    }

    console.log('👁️ Using Gemini Vision to analyze resume...');

    // Use Gemini Flash with vision
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash' 
    });

    // Extract base64 data
    const base64Data = imageBase64.includes('base64,') 
      ? imageBase64.split('base64,')[1] 
      : imageBase64;

    console.log('📦 Base64 data length:', base64Data.length);

    // Determine mime type
    const mimeType = imageBase64.includes('image/png') ? 'image/png' : 
                     imageBase64.includes('image/jpeg') ? 'image/jpeg' : 
                     imageBase64.includes('image/jpg') ? 'image/jpeg' : 'image/png';

    console.log('🖼️ Image type:', mimeType);

    const result = await model.generateContent([
      {
        inlineData: {
          data: base64Data,
          mimeType: mimeType
        }
      },
      `Analyze this resume image and extract ALL text with EXACT formatting.

Return ONLY HTML code (no markdown, no explanations) that recreates this resume's appearance.

Use inline CSS styles to match:
- Text alignment (text-align: center/left/right)
- Font sizes (use proper pt sizes)
- Bold text (<strong> or <b>)
- Headings (<h1>, <h2>)
- Lists (<ul>, <li>)
- Spacing (margin, padding)

Example format:
<h1 style="text-align: center; font-size: 24pt;">JOHN DOE</h1>
<p style="text-align: center;">email@email.com | (555) 123-4567</p>
<h2 style="font-size: 14pt; margin-top: 1.5em;">EXPERIENCE</h2>
<p><strong>Software Engineer | Google</strong></p>
<ul>
<li>Achievement here</li>
</ul>

Return ONLY the HTML. No code blocks, no explanations.`
    ]);

    const response = await result.response;
    let htmlContent = response.text();

    console.log('📝 Gemini response length:', htmlContent.length);

    // Clean up response
    htmlContent = htmlContent
      .replace(/```html\n?/gi, '')
      .replace(/```\n?/g, '')
      .trim();

    console.log('✅ Cleaned HTML length:', htmlContent.length);
    console.log('📝 HTML preview:', htmlContent.substring(0, 300));

    if (!htmlContent || htmlContent.length < 50) {
      throw new Error('Generated HTML is too short or empty');
    }

    // Extract plain text
    const plainText = htmlContent
      .replace(/<[^>]*>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    console.log('✅ Success! HTML:', htmlContent.length, 'chars, Text:', plainText.length, 'chars');

    return NextResponse.json({
      success: true,
      html: htmlContent,
      text: plainText
    });

  } catch (error) {
    console.error('❌ Vision formatting error:', error);
    console.error('Error type:', error instanceof Error ? error.constructor.name : typeof error);
    console.error('Error message:', error instanceof Error ? error.message : String(error));
    
    // ALWAYS return valid JSON
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to format resume from image',
        details: error instanceof Error ? error.message : 'Unknown error',
        html: null,
        text: null
      },
      { 
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
}
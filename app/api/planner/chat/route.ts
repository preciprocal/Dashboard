// app/api/planner/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth } from '@/firebase/admin';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Use the SAME environment variable as your generate route
const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;

if (!apiKey) {
  console.error('❌ GOOGLE_GENERATIVE_AI_API_KEY is not set');
}

const genAI = apiKey ? new GoogleGenerativeAI(apiKey) : null;

// System prompt for the AI coach
const COACH_SYSTEM_PROMPT = `You are an expert interview preparation coach and technical mentor. Your role is to:

1. **Answer technical questions** clearly and concisely with examples
2. **Generate practice questions** for behavioral, technical, or system design interviews
3. **Evaluate mock answers** using frameworks like STAR, providing constructive feedback
4. **Explain concepts** in simple, understandable terms
5. **Provide encouragement** and motivation while maintaining professionalism
6. **Suggest resources** when appropriate (courses, articles, practice problems)

Guidelines:
- Be supportive but honest in your feedback
- Use structured frameworks (STAR, CAR, PAR) when discussing behavioral questions
- Provide specific examples and actionable advice
- Keep technical explanations clear and progressive (simple to complex)
- If asked to evaluate an answer, provide: strengths, areas for improvement, and a revised version
- Format code examples with proper syntax highlighting when relevant
- Be concise but thorough - aim for clarity over length
- When explaining algorithms or data structures, break them down step-by-step
- For behavioral questions, always remind candidates to use the STAR method
- Maintain a professional yet friendly tone

Remember: You're here to help candidates succeed in their interviews!`;

/**
 * POST handler for AI coach chat
 * Endpoint: /api/planner/chat
 */
export async function POST(request: NextRequest) {
  const requestStartTime = Date.now();

  try {
    console.log('🚀 Chat API request received');
    console.log('   API Key Available:', !!apiKey);

    // Check API configuration
    if (!genAI || !apiKey) {
      console.error('❌ Gemini API not configured');
      return NextResponse.json(
        { 
          success: false,
          error: 'AI service not configured. Please add GOOGLE_GENERATIVE_AI_API_KEY to environment variables.',
          code: 'API_NOT_CONFIGURED'
        },
        { status: 503 }
      );
    }

    // ==================== AUTHENTICATION ====================
    const cookieStore = await cookies();
    const session = cookieStore.get('session');

    if (!session) {
      console.error('❌ No session cookie found');
      return NextResponse.json(
        { 
          success: false,
          error: 'Unauthorized - No session found',
          code: 'NO_SESSION'
        },
        { status: 401 }
      );
    }

    // Verify Firebase session
    let decodedClaims;
    try {
      decodedClaims = await auth.verifySessionCookie(session.value, true);
      console.log('✅ Session verified for user:', decodedClaims.uid);
    } catch (error) {
      console.error('❌ Session verification failed:', error);
      return NextResponse.json(
        { 
          success: false,
          error: 'Unauthorized - Invalid session',
          code: 'INVALID_SESSION'
        },
        { status: 401 }
      );
    }

    const userId = decodedClaims.uid;

    // ==================== INPUT VALIDATION ====================
    let body;
    try {
      body = await request.json();
    } catch (error) {
      console.error('❌ Invalid JSON body:', error);
      return NextResponse.json(
        { 
          success: false,
          error: 'Invalid request body',
          code: 'INVALID_JSON'
        },
        { status: 400 }
      );
    }

    const { message, planId, conversationHistory } = body;

    // Validate message
    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { 
          success: false,
          error: 'Message is required and must be a string',
          code: 'INVALID_MESSAGE'
        },
        { status: 400 }
      );
    }

    const trimmedMessage = message.trim();
    
    if (trimmedMessage.length === 0) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Message cannot be empty',
          code: 'EMPTY_MESSAGE'
        },
        { status: 400 }
      );
    }

    if (trimmedMessage.length > 5000) {
      return NextResponse.json(
        { 
          success: false,
          error: 'Message is too long (max 5000 characters)',
          code: 'MESSAGE_TOO_LONG'
        },
        { status: 400 }
      );
    }

    console.log('📝 Message validated - Length:', trimmedMessage.length);
    console.log('📚 Conversation history:', conversationHistory?.length || 0, 'messages');

    // ==================== PREPARE PROMPT ====================
    const messages = conversationHistory || [];
    
    // Limit to last 10 messages to avoid token limits
    const recentMessages = messages.slice(-10);
    
    // Build the conversation prompt
    const formattedPrompt = [
      `SYSTEM: ${COACH_SYSTEM_PROMPT}`,
      ...recentMessages.map((msg: any) => 
        `${msg.role.toUpperCase()}: ${msg.content}`
      ),
      `USER: ${trimmedMessage}`
    ].join('\n\n');

    console.log('🤖 Preparing to call Gemini 2.0 Flash API...');
    console.log('📊 Total prompt length:', formattedPrompt.length, 'characters');

    // ==================== CALL GEMINI API ====================
    const aiStartTime = Date.now();

    // Use the SAME model as your generate route
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash-001',
      generationConfig: {
        temperature: 0.7,        // Balanced creativity
        topP: 0.9,              // Nucleus sampling
        topK: 40,               // Vocabulary diversity
        maxOutputTokens: 2048,  // Max response length
      },
      safetySettings: [
        {
          category: 'HARM_CATEGORY_HARASSMENT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        },
        {
          category: 'HARM_CATEGORY_HATE_SPEECH',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        },
        {
          category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        },
        {
          category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
          threshold: 'BLOCK_MEDIUM_AND_ABOVE',
        },
      ],
    });
    
    let assistantResponse: string;
    let tokensUsed = 0;
    
    try {
      const result = await model.generateContent(formattedPrompt);
      const response = result.response;
      assistantResponse = response.text();
      
      // Get token usage if available
      if (response.usageMetadata) {
        tokensUsed = response.usageMetadata.totalTokenCount || 0;
      }
      
      if (!assistantResponse || assistantResponse.trim().length === 0) {
        throw new Error('Empty response from Gemini');
      }
      
      const aiResponseTime = Date.now() - aiStartTime;
      console.log('✅ Gemini response received');
      console.log('📏 Response length:', assistantResponse.length, 'characters');
      console.log('⏱️  AI response time:', aiResponseTime, 'ms');
      console.log('🎯 Tokens used:', tokensUsed);
      
    } catch (geminiError: any) {
      console.error('❌ Gemini API error:', geminiError);
      console.error('Error details:', {
        message: geminiError.message,
        name: geminiError.name,
        stack: geminiError.stack
      });
      
      // Handle specific Gemini errors
      if (geminiError.message?.includes('quota')) {
        return NextResponse.json(
          { 
            success: false,
            error: 'API quota exceeded. Please try again later.',
            code: 'QUOTA_EXCEEDED'
          },
          { status: 429 }
        );
      }
      
      if (geminiError.message?.includes('API key')) {
        return NextResponse.json(
          { 
            success: false,
            error: 'API configuration error. Please contact support.',
            code: 'API_CONFIG_ERROR'
          },
          { status: 503 }
        );
      }
      
      if (geminiError.message?.includes('safety') || geminiError.message?.includes('blocked')) {
        assistantResponse = "I apologize, but I cannot respond to that message due to content safety guidelines. Please rephrase your question in a professional manner, and I'll be happy to help with your interview preparation.";
        console.log('⚠️  Safety filter triggered, using default response');
      } else {
        // Unknown error - re-throw
        throw geminiError;
      }
    }

    // ==================== PREPARE RESPONSE ====================
    const totalResponseTime = Date.now() - requestStartTime;
    const aiResponseTime = Date.now() - aiStartTime;
    
    const responseData = {
      success: true,
      response: assistantResponse,
      metadata: {
        model: 'gemini-2.0-flash-001',
        responseTime: totalResponseTime,
        aiResponseTime: aiResponseTime,
        tokensUsed,
        userId,
        planId: planId || null,
        messageLength: trimmedMessage.length,
        responseLength: assistantResponse.length,
        timestamp: new Date().toISOString()
      }
    };

    console.log('✅ Chat request completed successfully');
    console.log('⏱️  Total response time:', totalResponseTime, 'ms');
    
    return NextResponse.json(responseData);

  } catch (error: any) {
    const totalResponseTime = Date.now() - requestStartTime;
    
    console.error('❌ Unexpected error in chat API:', error);
    console.error('Error details:', {
      message: error.message,
      name: error.name,
      stack: error.stack
    });
    
    return NextResponse.json(
      { 
        success: false,
        error: 'Failed to process chat message',
        code: 'INTERNAL_ERROR',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        responseTime: totalResponseTime
      },
      { status: 500 }
    );
  }
}

/**
 * GET handler for health check
 * Endpoint: GET /api/planner/chat
 */
export async function GET(request: NextRequest) {
  try {
    // Check if Gemini API key is configured
    if (!apiKey) {
      return NextResponse.json(
        { 
          status: 'error',
          message: 'Gemini API key not configured',
          timestamp: new Date().toISOString()
        },
        { status: 503 }
      );
    }

    // Basic health check response
    return NextResponse.json({
      status: 'ok',
      service: 'planner-ai-coach-chat',
      model: 'gemini-2.0-flash-001',
      version: '1.0.0',
      features: [
        'technical-questions',
        'behavioral-coaching',
        'mock-answer-evaluation',
        'concept-explanation',
        'resource-suggestions'
      ],
      limits: {
        maxMessageLength: 5000,
        maxOutputTokens: 2048,
        conversationHistoryLimit: 10
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    return NextResponse.json(
      { 
        status: 'error',
        message: 'Service unavailable',
        timestamp: new Date().toISOString()
      },
      { status: 503 }
    );
  }
}
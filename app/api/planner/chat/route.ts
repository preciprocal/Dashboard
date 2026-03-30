// app/api/planner/chat/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth } from '@/firebase/admin';
import OpenAI from 'openai';

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
  console.error('❌ OPENAI_API_KEY is not set');
}

const openai = apiKey ? new OpenAI({ apiKey }) : null;

// Define interfaces
interface ConversationMessage {
  role: string;
  content: string;
}

interface ChatRequest {
  message: string;
  planId?: string;
  conversationHistory?: ConversationMessage[];
}

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

    if (!openai || !apiKey) {
      console.error('❌ OpenAI API not configured');
      return NextResponse.json(
        {
          success: false,
          error: 'AI service not configured. Please add OPENAI_API_KEY to environment variables.',
          code: 'API_NOT_CONFIGURED'
        },
        { status: 503 }
      );
    }

    // ==================== AUTH ====================
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session')?.value;

    if (!sessionCookie) {
      return NextResponse.json(
        { success: false, error: 'Not authenticated', code: 'AUTH_REQUIRED' },
        { status: 401 }
      );
    }

    let userId: string;
    try {
      const decodedClaims = await auth.verifySessionCookie(sessionCookie, true);
      userId = decodedClaims.uid;
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid session', code: 'INVALID_SESSION' },
        { status: 401 }
      );
    }

    // ==================== PARSE BODY ====================
    const body = await request.json() as ChatRequest;
    const { message, planId, conversationHistory } = body;

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Message is required', code: 'INVALID_INPUT' },
        { status: 400 }
      );
    }

    const trimmedMessage = message.trim();
    if (trimmedMessage.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Message cannot be empty', code: 'EMPTY_MESSAGE' },
        { status: 400 }
      );
    }

    if (trimmedMessage.length > 5000) {
      return NextResponse.json(
        { success: false, error: 'Message too long. Maximum 5000 characters.', code: 'MESSAGE_TOO_LONG' },
        { status: 400 }
      );
    }

    console.log('📝 Processing message:', {
      userId,
      messageLength: trimmedMessage.length,
      planId: planId || 'none',
      historyLength: conversationHistory?.length || 0,
    });

    // ==================== BUILD MESSAGES ====================
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: COACH_SYSTEM_PROMPT },
    ];

    // Add conversation history (limit to last 10 messages)
    if (conversationHistory && Array.isArray(conversationHistory)) {
      const recentHistory = conversationHistory.slice(-10);
      for (const msg of recentHistory) {
        if (msg.role === 'user' || msg.role === 'assistant') {
          messages.push({
            role: msg.role as 'user' | 'assistant',
            content: msg.content,
          });
        }
      }
    }

    messages.push({ role: 'user', content: trimmedMessage });

    // ==================== CALL OPENAI ====================
    const aiStartTime = Date.now();
    let assistantResponse = '';
    let tokensUsed = 0;

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages,
        temperature: 0.7,
        max_tokens: 2048,
      });

      assistantResponse = completion.choices[0]?.message?.content?.trim() ?? '';
      tokensUsed = completion.usage?.total_tokens ?? 0;

      if (!assistantResponse || assistantResponse.length === 0) {
        throw new Error('Empty response from OpenAI');
      }

      const aiResponseTime = Date.now() - aiStartTime;
      console.log('✅ OpenAI response received');
      console.log('📏 Response length:', assistantResponse.length, 'characters');
      console.log('⏱️  AI response time:', aiResponseTime, 'ms');
      console.log('🎯 Tokens used:', tokensUsed);

    } catch (openaiError) {
      console.error('❌ OpenAI API error:', openaiError);
      const error = openaiError as Error;
      console.error('Error details:', {
        message: error.message,
        name: error.name,
        stack: error.stack
      });

      if (error.message?.includes('quota') || error.message?.includes('rate_limit')) {
        return NextResponse.json(
          {
            success: false,
            error: 'API quota exceeded. Please try again later.',
            code: 'QUOTA_EXCEEDED'
          },
          { status: 429 }
        );
      }

      if (error.message?.includes('API key') || error.message?.includes('authentication')) {
        return NextResponse.json(
          {
            success: false,
            error: 'API configuration error. Please contact support.',
            code: 'API_CONFIG_ERROR'
          },
          { status: 503 }
        );
      }

      if (error.message?.includes('content_policy') || error.message?.includes('content_filter')) {
        assistantResponse = "I apologize, but I cannot respond to that message due to content safety guidelines. Please rephrase your question in a professional manner, and I'll be happy to help with your interview preparation.";
        console.log('⚠️  Safety filter triggered, using default response');
      } else {
        throw openaiError;
      }
    }

    const totalResponseTime = Date.now() - requestStartTime;
    const aiResponseTime = Date.now() - aiStartTime;

    const responseData = {
      success: true,
      response: assistantResponse,
      metadata: {
        model: 'gpt-4o-mini',
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

  } catch (error) {
    const totalResponseTime = Date.now() - requestStartTime;
    const err = error as Error;

    console.error('❌ Unexpected error in chat API:', err);
    console.error('Error details:', {
      message: err.message,
      name: err.name,
      stack: err.stack
    });

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to process chat message',
        code: 'INTERNAL_ERROR',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined,
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
export async function GET() {
  try {
    if (!apiKey) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'OpenAI API key not configured',
          timestamp: new Date().toISOString()
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      status: 'ok',
      service: 'planner-ai-coach-chat',
      model: 'gpt-4o-mini',
      version: '2.0.0',
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

  } catch {
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
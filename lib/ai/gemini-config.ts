// lib/ai/gemini-config.ts

export const GEMINI_CONFIG = {
  // Model selection - Using ONLY gemini-2.0-flash-001
  models: {
    pro: 'gemini-2.0-flash-exp',        // Use Flash for everything
    flash: 'gemini-2.0-flash-exp',      // Same model
    vision: 'gemini-2.0-flash-exp',     // Same model
  },

  // Generation parameters
  generationConfig: {
    temperature: 0.7,
    topK: 40,
    topP: 0.95,
    maxOutputTokens: 8192,
  },

  // Safety settings
  safetySettings: [
    {
      category: 'HARM_CATEGORY_HARASSMENT',
      threshold: 'BLOCK_ONLY_HIGH',
    },
    {
      category: 'HARM_CATEGORY_HATE_SPEECH',
      threshold: 'BLOCK_ONLY_HIGH',
    },
    {
      category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
      threshold: 'BLOCK_ONLY_HIGH',
    },
    {
      category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
      threshold: 'BLOCK_ONLY_HIGH',
    },
  ],

  // Rate limiting
  rateLimit: {
    requestsPerMinute: 60,
    tokensPerMinute: 32000,
  },

  // Retry configuration
  retry: {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
  },
};

export const API_CONFIG = {
  apiKey: process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_AI_API_KEY || '',
  baseURL: 'https://generativelanguage.googleapis.com/v1beta',
};

// Validate API key on import
if (!API_CONFIG.apiKey) {
  console.error('⚠️ Warning: GOOGLE_GENERATIVE_AI_API_KEY is not set in environment variables');
}

// Log configuration in development
if (process.env.NODE_ENV === 'development') {
  console.log('🤖 Gemini Configuration:');
  console.log(`   Model: gemini-2.0-flash-exp`);
  console.log(`   API Key: ${API_CONFIG.apiKey ? '✅ Set' : '❌ Missing'}`);
}
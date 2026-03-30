// lib/ai/ai-config.ts

export const AI_CONFIG = {
  // Model selection
  models: {
    primary: 'gpt-4o',          // Full analysis, complex tasks
    fast: 'gpt-4o-mini',        // Quick scans, chat, feedback
  },

  // Generation parameters
  generationConfig: {
    temperature: 0.7,
    maxTokens: 8192,
  },

  // Rate limiting
  rateLimit: {
    requestsPerMinute: 60,
    tokensPerMinute: 90000,
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
  apiKey: process.env.OPENAI_API_KEY || '',
};

// Validate API key on import
if (!API_CONFIG.apiKey) {
  console.error('⚠️ Warning: OPENAI_API_KEY is not set in environment variables');
}

// Log configuration in development
if (process.env.NODE_ENV === 'development') {
  console.log('🤖 AI Configuration:');
  console.log(`   Primary Model: ${AI_CONFIG.models.primary}`);
  console.log(`   Fast Model: ${AI_CONFIG.models.fast}`);
  console.log(`   API Key: ${API_CONFIG.apiKey ? '✅ Set' : '❌ Missing'}`);
}
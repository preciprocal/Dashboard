// app/api/test-models/route.ts
import { NextResponse } from 'next/server';

interface ModelInfo {
  name: string;
  displayName: string;
  description?: string;
  inputTokenLimit: number;
  outputTokenLimit: number;
  supportedGenerationMethods?: string[];
}

interface ModelsResponse {
  models: ModelInfo[];
}

interface AvailableModel {
  name: string;
  displayName: string;
  description?: string;
  inputTokenLimit: number;
  outputTokenLimit: number;
}

export async function GET() {
  try {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json({ error: 'API key not found' }, { status: 500 });
    }
    
    // Try to list available models
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models?key=' + apiKey
    );
    
    const data = await response.json() as ModelsResponse;
    
    if (!response.ok) {
      return NextResponse.json({ 
        error: 'Failed to fetch models',
        details: data 
      }, { status: response.status });
    }

    // Filter for models that support generateContent
    const availableModels: AvailableModel[] = data.models
      ?.filter((model: ModelInfo) => 
        model.supportedGenerationMethods?.includes('generateContent')
      )
      .map((model: ModelInfo) => ({
        name: model.name,
        displayName: model.displayName,
        description: model.description,
        inputTokenLimit: model.inputTokenLimit,
        outputTokenLimit: model.outputTokenLimit,
      })) || [];

    return NextResponse.json({
      success: true,
      availableModels,
      totalModels: availableModels.length,
      recommendation: availableModels[0]?.name || 'No models found'
    });

  } catch (error) {
    console.error('Error listing models:', error);
    return NextResponse.json({ 
      error: 'Failed to list models',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
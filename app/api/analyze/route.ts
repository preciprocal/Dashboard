// app/api/analyze/route.ts

import { validatePDFFile } from '@/lib/resume/pdf-parser-server';
import { AnalysisService } from '@/lib/services/analysis-services';
import { NextRequest, NextResponse } from 'next/server';


export const runtime = 'nodejs'; // Explicitly use Node.js runtime
export const maxDuration = 60; // Max 60 seconds

export async function POST(request: NextRequest) {
  try {
    console.log('📥 Received analysis request');

    // Parse form data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const jobTitle = formData.get('jobTitle') as string;
    const jobDescription = formData.get('jobDescription') as string;
    const companyName = formData.get('companyName') as string;
    const analysisType = (formData.get('analysisType') as string) || 'full';

    // Validate file
    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    console.log(`📄 File received: ${file.name} (${file.size} bytes)`);

    const validation = validatePDFFile(file);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Analyze resume
    console.log('🚀 Starting analysis...');
    const startTime = Date.now();

    const feedback = await AnalysisService.analyzeResume(file, {
      jobTitle,
      jobDescription,
      companyName,
      analysisType: analysisType as any,
    });

    const processingTime = Date.now() - startTime;
    console.log(`✅ Analysis completed in ${processingTime}ms`);
    console.log(`   Overall Score: ${feedback.overallScore}`);

    return NextResponse.json({
      success: true,
      feedback,
      processingTime,
    });
  } catch (error) {
    console.error('❌ Analysis API error:', error);

    const errorMessage = error instanceof Error 
      ? error.message 
      : 'An unexpected error occurred during analysis';

    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
// app/api/analyze/route.ts
import { validatePDFFileServer } from '@/lib/resume/pdf-parser-server';
import { AnalysisService } from '@/lib/services/analysis-services';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 60;

const VALID_ANALYSIS_TYPES = ['full', 'quick', 'ats-only'] as const;
type ValidAnalysisType = typeof VALID_ANALYSIS_TYPES[number];

export async function POST(request: NextRequest) {
  try {
    console.log('📥 Received analysis request');

    const formData        = await request.formData();
    const file            = formData.get('file') as File;
    const jobTitle        = formData.get('jobTitle') as string;
    const jobDescription  = formData.get('jobDescription') as string;
    const companyName     = formData.get('companyName') as string;
    const analysisType    = (formData.get('analysisType') as string) || 'full';

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    console.log(`📄 File received: ${file.name} (${file.size} bytes)`);

    const validation = validatePDFFileServer(file);
    if (!validation.valid) {
      return NextResponse.json({ error: validation.error }, { status: 400 });
    }

    // Validate analysis type - return a clear error instead of silently remapping
    if (!VALID_ANALYSIS_TYPES.includes(analysisType as ValidAnalysisType)) {
      return NextResponse.json(
        {
          error: `Invalid analysisType "${analysisType}". Accepted values: ${VALID_ANALYSIS_TYPES.join(', ')}.`,
        },
        { status: 400 }
      );
    }

    const normalizedAnalysisType = analysisType as ValidAnalysisType;

    console.log('🚀 Starting analysis...');
    console.log('   Job Title:', jobTitle || 'Not specified');
    console.log('   Company:', companyName || 'Not specified');
    console.log('   Job Description Length:', jobDescription?.length || 0);
    console.log('   Analysis Type:', normalizedAnalysisType);

    const startTime = Date.now();

    const feedback = await AnalysisService.analyzeResume(file, {
      jobTitle,
      jobDescription,
      companyName,
      analysisType: normalizedAnalysisType,
    });

    const processingTime = Date.now() - startTime;
    console.log(`✅ Analysis completed in ${processingTime}ms`);
    console.log(`   Overall Score: ${feedback.overallScore}`);

    return NextResponse.json({ success: true, feedback, processingTime });
  } catch (error) {
    console.error('❌ Analysis API error:', error);

    const errorMessage = error instanceof Error
      ? error.message
      : 'An unexpected error occurred during analysis';

    return NextResponse.json({ success: false, error: errorMessage }, { status: 500 });
  }
}
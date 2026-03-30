// lib/services/analysis-services.tsx

import { AIService } from '../ai/ai-service';
import type { ResumeFeedback } from '@/types/resume';
import { extractTextFromPDFServer } from '../resume/pdf-parser-server';

export class AnalysisService {
  /**
   * Full resume analysis
   */
  static async analyzeResume(
    file: File,
    options: {
      jobTitle?: string;
      jobDescription?: string;
      companyName?: string;
      analysisType?: 'full' | 'quick' | 'ats-only';
    } = {}
  ): Promise<ResumeFeedback> {
    console.log('📄 Starting resume analysis...');

    try {
      // 1. Extract text from PDF
      console.log('📝 Extracting text from PDF...');
      const resumeText = await extractTextFromPDFServer(file);

      if (!resumeText || resumeText.length < 100) {
        throw new Error(
          'Could not extract sufficient text from PDF. ' +
          'Please ensure your PDF is text-based (not a scanned image) and contains readable content.'
        );
      }

      console.log(`✅ Extracted ${resumeText.length} characters`);

      // 2. Analyze with AI
      console.log('🤖 Analyzing with AI...');
      const feedback = await AIService.analyzeResume(resumeText, options);

      console.log('✅ Analysis complete');
      return feedback;
    } catch (error) {
      console.error('❌ Analysis failed:', error);

      if (error instanceof Error) {
        if (error.message.includes('text-based')) {
          throw new Error(
            'This PDF appears to be a scanned image. Please use a text-based PDF or convert your document to text format.'
          );
        }

        if (error.message.includes('corrupted')) {
          throw new Error(
            'The PDF file appears to be corrupted. Please try re-saving or re-creating the PDF.'
          );
        }
      }

      throw error;
    }
  }

  /**
   * Quick ATS scan
   */
  static async quickScan(file: File, jobDescription?: string) {
    const text = await extractTextFromPDFServer(file);
    return AIService.quickATSScan(text, jobDescription);
  }

  /**
   * Rewrite section
   */
  static async rewriteSection(
    text: string,
    options: {
      role?: string;
      tone?: 'professional' | 'creative' | 'technical' | 'executive';
    }
  ) {
    return AIService.rewriteSection(text, options);
  }

  /**
   * Job matching
   */
  static async matchJob(file: File, jobDescription: string) {
    const text = await extractTextFromPDFServer(file);
    return AIService.matchJobDescription(text, jobDescription);
  }
}
"use server";

import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { db } from "@/firebase/admin";
import { z } from "zod";

// Feedback schema for structured output
const resumeFeedbackSchema = z.object({
  overallScore: z.number().min(0).max(100),
  ATS: z.object({
    score: z.number().min(0).max(100),
    tips: z.array(z.object({
      type: z.enum(["good", "improve"]),
      tip: z.string()
    }))
  }),
  toneAndStyle: z.object({
    score: z.number().min(0).max(100),
    tips: z.array(z.object({
      type: z.enum(["good", "improve"]),
      tip: z.string(),
      explanation: z.string()
    }))
  }),
  content: z.object({
    score: z.number().min(0).max(100),
    tips: z.array(z.object({
      type: z.enum(["good", "improve"]),
      tip: z.string(),
      explanation: z.string()
    }))
  }),
  structure: z.object({
    score: z.number().min(0).max(100),
    tips: z.array(z.object({
      type: z.enum(["good", "improve"]),
      tip: z.string(),
      explanation: z.string()
    }))
  }),
  skills: z.object({
    score: z.number().min(0).max(100),
    tips: z.array(z.object({
      type: z.enum(["good", "improve"]),
      tip: z.string(),
      explanation: z.string()
    }))
  })
});

// Prepare instructions function from your original
const prepareInstructions = ({ jobTitle, jobDescription }: { jobTitle: string; jobDescription: string; }) =>
  `You are an expert in ATS (Applicant Tracking System) and resume analysis.
    Please analyze and rate this resume and suggest how to improve it.
    The rating can be low if the resume is bad.
    Be thorough and detailed. Don't be afraid to point out any mistakes or areas for improvement.
    If there is a lot to improve, don't hesitate to give low scores. This is to help the user to improve their resume.
    If available, use the job description for the job user is applying to to give more detailed feedback.
    If provided, take the job description into consideration.
    The job title is: ${jobTitle}
    The job description is: ${jobDescription}
    
    Analyze the resume and provide scores for:
    - Overall Score (0-100)
    - ATS compatibility (0-100) 
    - Tone & Style (0-100)
    - Content quality (0-100)
    - Structure & formatting (0-100)
    - Skills presentation (0-100)
    
    For each category, provide 2-4 tips with type "good" for strengths and "improve" for areas needing work.
    Be specific and actionable in your feedback.`;

export interface CreateResumeParams {
  userId: string;
  companyName: string;
  jobTitle: string;
  jobDescription: string;
  fileName: string;
  fileSize: number;
  fileUrl: string;
  resumeText: string;
}

export interface AnalyzeResumeParams {
  resumeId: string;
  userId: string;
  jobTitle: string;
  jobDescription: string;
  resumeText: string;
}

// Create resume record
export async function createResumeRecord(params: CreateResumeParams) {
  try {
    const resumeRef = db.collection("resumes").doc();
    const now = new Date().toISOString();
    
    const resume = {
      id: resumeRef.id,
      userId: params.userId,
      companyName: params.companyName,
      jobTitle: params.jobTitle,
      jobDescription: params.jobDescription,
      fileName: params.fileName,
      fileSize: params.fileSize,
      fileUrl: params.fileUrl,
      resumeText: params.resumeText,
      createdAt: now,
      updatedAt: now,
      status: 'analyzing',
      feedback: null,
      score: null
    };

    await resumeRef.set(resume);

    return { success: true, data: resume };
  } catch (error) {
    console.error('Error creating resume:', error);
    return { success: false, error: 'Failed to create resume' };
  }
}

// Analyze resume with AI
export async function analyzeResumeWithAI(params: AnalyzeResumeParams) {
  try {
    const { resumeId, userId, jobTitle, jobDescription, resumeText } = params;

    // Generate AI analysis using your existing Gemini setup
    const { object } = await generateObject({
      model: google("gemini-2.0-flash-001", {
        structuredOutputs: false,
      }),
      schema: resumeFeedbackSchema,
      prompt: `
        Resume Text:
        ${resumeText}
        
        ${prepareInstructions({ jobTitle, jobDescription })}
      `,
      system: "You are a professional resume analyst and ATS expert. Provide detailed, honest feedback to help improve the resume."
    });

    // Update resume with feedback
    const resumeRef = db.collection("resumes").doc(resumeId);
    const updateData = {
      status: 'complete',
      score: object.overallScore,
      feedback: object,
      analyzedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    await resumeRef.update(updateData);

    return { success: true, data: object };
  } catch (error) {
    console.error('Error analyzing resume:', error);
    
    // Mark as failed in database
    try {
      const resumeRef = db.collection("resumes").doc(params.resumeId);
      await resumeRef.update({
        status: 'failed',
        error: 'AI analysis failed',
        updatedAt: new Date().toISOString()
      });
    } catch (updateError) {
      console.error('Error updating failed status:', updateError);
    }

    return { success: false, error: 'Failed to analyze resume' };
  }
}

// Get resume by ID
export async function getResumeById(resumeId: string, userId: string) {
  try {
    const doc = await db.collection('resumes').doc(resumeId).get();
    
    if (!doc.exists) {
      return { success: false, error: 'Resume not found' };
    }

    const resume = doc.data();
    
    // Verify user owns this resume
    if (resume?.userId !== userId) {
      return { success: false, error: 'Access denied' };
    }

    return { success: true, data: resume };
  } catch (error) {
    console.error('Error fetching resume:', error);
    return { success: false, error: 'Failed to fetch resume' };
  }
}

// Get all resumes for user
export async function getResumesByUserId(userId: string) {
  try {
    const snapshot = await db
      .collection('resumes')
      .where('userId', '==', userId)
      .get();

    const resumes: any[] = [];
    snapshot.forEach(doc => {
      resumes.push({ id: doc.id, ...doc.data() });
    });

    // Sort by creation date, newest first
    const sortedResumes = resumes.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return { success: true, data: sortedResumes };
  } catch (error) {
    console.error('Error fetching resumes:', error);
    return { success: false, error: 'Failed to fetch resumes' };
  }
}

// app/api/feedback/batch/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getFeedbackByInterviewId } from "@/lib/actions/general.action";

// Define interfaces
interface Interview {
  id: string;
  [key: string]: unknown;
}

interface InterviewWithFeedback extends Interview {
  feedback?: FeedbackData | null;
  score: number;
}

interface BatchFeedbackRequest {
  interviews: Interview[];
  userId: string;
}

interface FeedbackData {
  id: string;
  interviewId: string;
  userId: string;
  totalScore: number;
  categoryScores: Record<string, number>;
  strengths: string[];
  areasForImprovement: string[];
  finalAssessment: string;
  createdAt: string;
  updatedAt?: string;
  technicalAccuracy?: number;
  communication?: number;
  problemSolving?: number;
  confidence?: number;
  overallRating?: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as BatchFeedbackRequest;
    const { interviews, userId } = body;

    if (!interviews || !userId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Fetch feedback for all interviews
    const feedbackPromises = interviews.map(async (interview: Interview): Promise<InterviewWithFeedback> => {
      try {
        const feedback = await getFeedbackByInterviewId({
          interviewId: interview.id,
          userId: userId,
        });
        
        return {
          ...interview,
          feedback: feedback,
          score: feedback?.totalScore || 0,
        };
      } catch (error) {
        console.error(`Error fetching feedback for interview ${interview.id}:`, error);
        return { 
          ...interview, 
          feedback: null,
          score: 0 
        };
      }
    });

    const interviewsWithFeedback = await Promise.all(feedbackPromises);

    return NextResponse.json({ interviews: interviewsWithFeedback });
  } catch (error) {
    console.error("Error fetching batch feedback:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
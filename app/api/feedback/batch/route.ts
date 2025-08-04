// app/api/feedback/batch/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getFeedbackByInterviewId } from "@/lib/actions/general.action";

export async function POST(request: NextRequest) {
  try {
    const { interviews, userId } = await request.json();

    if (!interviews || !userId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Fetch feedback for all interviews
    const feedbackPromises = interviews.map(async (interview: any) => {
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
        return { ...interview, score: 0 };
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

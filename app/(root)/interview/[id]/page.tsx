import { redirect } from "next/navigation";

import {
  getFeedbackByInterviewId,
  getInterviewById,
} from "@/lib/actions/general.action";
import { getCurrentUser } from "@/lib/actions/auth.action";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Server component that fetches data and renders client component
export default async function InterviewDetailsPage({ params }: RouteParams) {
  const { id } = await params;
  const user = await getCurrentUser();
  const interview = await getInterviewById(id);

  if (!interview) redirect("/");

  const feedback = await getFeedbackByInterviewId({
    interviewId: id,
    userId: user?.id ?? "",
  });

  // Import the client component dynamically
  const { default: InterviewDetailsClient } = await import('./InterviewPageClient');

  return (
    <InterviewDetailsClient
      userName={user?.name ?? "User"}
      userId={user?.id ?? ""}
      interviewId={id}
      interview={{
        role: interview.role,
        type: interview.type,
        level: interview.level,
        techstack: interview.techstack,
        questions: interview.questions,
      }}
      feedbackId={feedback?.id}
      type="interview"
    />
  );
}
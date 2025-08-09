import { redirect } from "next/navigation";
import InterviewPageClient from "./InterviewPageClient";
import {
  getFeedbackByInterviewId,
  getInterviewById,
} from "@/lib/actions/general.action";
import { getCurrentUser } from "@/lib/actions/auth.action";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export default async function InterviewPage({ params }: RouteParams) {
  const { id } = await params;
  const user = await getCurrentUser();
  const interview = await getInterviewById(id);

  if (!interview) redirect("/");

  const feedback = await getFeedbackByInterviewId({
    interviewId: id,
    userId: user?.id!,
  });

  return (
    <InterviewPageClient
      interview={interview}
      user={user}
      feedback={feedback}
    />
  );
}
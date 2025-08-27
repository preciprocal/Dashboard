export interface JobDetails {
  jobTitle: string;
  jobDescription: string;
}

export function prepareInstructions({ jobTitle, jobDescription }: JobDetails): string {
  return `
You are an expert resume reviewer and ATS specialist. 
Please analyze the resume for the position of "${jobTitle}" based on this job description:

${jobDescription}

Provide comprehensive analysis with scores and feedback.
`;
}
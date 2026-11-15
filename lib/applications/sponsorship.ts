// lib/applications/sponsorship.ts
//
// The recruiter-screen answer to "Will you need sponsorship now or in the
// future?", by the student's work authorization stage. Written here, not by a
// model, so the facts stay fixed and checkable:
//
//   - OPT is authorized by the student's own EAD; no employer petition. The
//     job must be directly related to the student's major.
//   - The 24-month STEM OPT extension needs an employer enrolled in E-Verify,
//     which signs the Form I-983 training plan.
//   - H-1B needs an employer petition.
//
// Shown with a link to each source and a note that it is not legal advice.

export type AuthStage = 'opt' | 'opt-stem' | 'stem-opt' | 'no-sponsorship';

export const AUTH_STAGES: { id: AuthStage; label: string }[] = [
  { id: 'opt',            label: 'On OPT (or starting it), non-STEM degree' },
  { id: 'opt-stem',       label: 'On OPT (or starting it), STEM degree' },
  { id: 'stem-opt',       label: 'On the STEM OPT extension' },
  { id: 'no-sponsorship', label: 'Authorized without sponsorship (citizen, green card or similar)' },
];

export const SOURCES = {
  opt:   { label: 'USCIS: OPT for F-1 students', url: 'https://www.uscis.gov/working-in-the-united-states/students-and-exchange-visitors/optional-practical-training-opt-for-f-1-students' },
  stem:  { label: 'USCIS: STEM OPT extension', url: 'https://www.uscis.gov/working-in-the-united-states/students-and-exchange-visitors/optional-practical-training-extension-for-stem-students-stem-opt' },
  i983:  { label: 'DHS Study in the States: STEM OPT hub', url: 'https://studyinthestates.dhs.gov/stem-opt-hub' },
  h1b:   { label: 'USCIS: H-1B specialty occupations', url: 'https://www.uscis.gov/working-in-the-united-states/h-1b-specialty-occupations' },
} as const;

export interface SponsorshipAnswer {
  stage: AuthStage;
  /** What to say, ready to use and edit. */
  answer: string;
  /** Facts behind it, each with its source. */
  facts: { text: string; source: keyof typeof SOURCES }[];
  /** Things to check before relying on the answer. */
  checks: string[];
}

export function sponsorshipAnswer(stage: AuthStage): SponsorshipAnswer {
  switch (stage) {
    case 'opt':
      return {
        stage,
        answer: "Not to start. I'm authorized to work on OPT through my own EAD, so there's nothing for you to file now. If I stay on beyond my OPT period, I would need H-1B sponsorship in the future.",
        facts: [
          { text: 'OPT work is authorized by your own Employment Authorization Document (EAD). The employer does not file a petition for it.', source: 'opt' },
          { text: 'OPT employment must be directly related to your major area of study.', source: 'opt' },
          { text: 'Working past OPT on H-1B requires the employer to file a petition for you.', source: 'h1b' },
        ],
        checks: [
          'Confirm this role is directly related to your major.',
          'Application forms often ask "now or in the future". If you will need H-1B later, answer that honestly and explain that OPT covers the start.',
        ],
      };
    case 'opt-stem':
      return {
        stage,
        answer: "Not to start. I'm authorized to work on OPT through my own EAD. My degree is in a STEM field, so I may be able to extend for 24 months under STEM OPT, which needs an employer enrolled in E-Verify that signs my training plan. Longer term I would need H-1B sponsorship.",
        facts: [
          { text: 'OPT work is authorized by your own EAD, with no employer petition.', source: 'opt' },
          { text: 'The 24-month STEM OPT extension requires an employer enrolled in E-Verify.', source: 'stem' },
          { text: 'The employer signs Form I-983, the training plan, for STEM OPT.', source: 'i983' },
          { text: 'H-1B requires an employer petition.', source: 'h1b' },
        ],
        checks: [
          'Confirm this role is directly related to your major.',
          'Check that your degree is on the DHS STEM Designated Degree Program List with your DSO.',
          'Check the E-Verify status for this company below. STEM OPT is only possible with an employer that uses E-Verify.',
        ],
      };
    case 'stem-opt':
      return {
        stage,
        answer: "I'm authorized through the STEM OPT extension. It doesn't involve a petition, but it does need an employer enrolled in E-Verify to sign my Form I-983 training plan. Longer term I would need H-1B sponsorship.",
        facts: [
          { text: 'STEM OPT requires an employer enrolled in E-Verify.', source: 'stem' },
          { text: 'The employer signs Form I-983, the training plan, and agrees to its obligations.', source: 'i983' },
          { text: 'H-1B requires an employer petition.', source: 'h1b' },
        ],
        checks: [
          'Check the E-Verify status for this company below before you rely on this role for STEM OPT.',
          'Ask HR whether the company has signed I-983 training plans before.',
        ],
      };
    case 'no-sponsorship':
      return {
        stage,
        answer: "No. I'm authorized to work in the U.S. without sponsorship.",
        facts: [],
        checks: [],
      };
  }
}

export function isAuthStage(v: unknown): v is AuthStage {
  return AUTH_STAGES.some(s => s.id === v);
}

// lib/glossary.ts
//
// Plain explanations for labels used across the app, shown by
// components/ui/info-tip.tsx. Each says what the label means, what it does
// not mean, and where the data comes from. Keep them factual: no promise
// about sponsorship, hiring or pay.

export const GLOSSARY = {
  everified: {
    title: 'E-Verified employer',
    body: 'The employer is enrolled in E-Verify, the federal system that confirms a new hire can work in the US. A STEM OPT extension is only possible with an employer enrolled in E-Verify.',
    source: 'From the public E-Verify employer list, which employers report themselves.',
  },
  everifyEnded: {
    title: 'E-Verify enrolment ended',
    body: 'This employer was enrolled in E-Verify, but its enrolment has ended. It would need to enrol again before it could employ you on a STEM OPT extension. Ask the employer to confirm.',
    source: 'From the public E-Verify employer list.',
  },
  everifyUnknown: {
    title: 'No E-Verify match',
    body: 'No enrolment was found under this company name. Employers often enrol under a different legal name, so this does not mean they are not enrolled.',
    source: 'Check the official E-Verify employer search to be sure.',
  },
  h1b: {
    title: 'H-1B approvals',
    body: 'How many H-1B workers USCIS approved for this employer in the fiscal year shown, new hires and extensions together, on its first decision. It shows the employer has sponsored before. It is not a promise that it will sponsor you.',
    source: 'From the USCIS H-1B Employer Data Hub.',
  },
  h1bNone: {
    title: 'No H-1B approvals on record',
    body: 'None found under this company name. Petitions are filed under the legal entity, which can have a different name, so the employer may still sponsor.',
    source: 'Check the USCIS H-1B Employer Data Hub to be sure.',
  },
  newPosting: {
    title: 'New',
    body: 'Posted in the last 3 days, by the date the employer\'s job board shows.',
  },
  closedPosting: {
    title: 'Closed',
    body: 'The employer took this posting down after our last check, so it can no longer be applied to.',
  },
  jobsChecked: {
    title: 'When postings were checked',
    body: 'We read every employer\'s own job board on a schedule. A posting is checked again when you press Apply, so a closed one is caught before you spend time on it.',
  },
  autoApply: {
    title: 'Auto-apply',
    body: 'Tailors your default resume to the job, writes the cover letter and opens the application for the Chrome extension to fill. You still review every answer and press Submit on the employer\'s site yourself.',
    source: 'Fill in your Auto-apply details in Settings first, so the extension has your answers.',
  },
  keywordMatch: {
    title: 'Job keywords found',
    body: 'A count of the skills and tools from this job description that appear in your resume text. It does not predict how any applicant tracking system will rank you.',
  },
  factChecks: {
    title: 'Fact checks',
    body: 'Every suggested change is checked against your resume. A change is removed if it adds a number, tool or skill your resume does not already have.',
  },
  percentiles: {
    title: 'Percentiles',
    body: 'The 25th percentile means a quarter of workers in this occupation earn less; the median (50th) is the middle; the 75th means three quarters earn less. These are pay across all experience levels, not an offer for a new graduate.',
    source: 'US Bureau of Labor Statistics, Occupational Employment and Wage Statistics (OEWS).',
  },
} as const satisfies Record<string, { title: string; body: string; source?: string }>;

export type GlossaryTerm = keyof typeof GLOSSARY;

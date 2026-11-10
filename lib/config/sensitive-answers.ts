// lib/config/sensitive-answers.ts
// Profile answers autofill must never assume: demographic (EEO) questions,
// work authorization, sponsorship, age, licence, consent and criminal record.
//
// Until version 2 the job application profile form pre-filled these with
// defaults ("I am not a protected veteran", authorized "Yes", sponsorship
// "No") and saved them whenever the user saved anything. A stored value that
// equals one of those old defaults therefore cannot be told apart from a real
// choice, so it is treated as not set until the user saves the form again,
// where every one of these starts as "Not set" and anything saved is chosen.
//
// Read by app/api/extension/auto-apply/route.ts (what the extension receives)
// and components/profile/JobApplication.tsx (what the form shows). The
// extension then answers only what is set (extension/sensitive-answers.js).

/** Written by the form on save from v2 on; marks every value as chosen. */
export const SENSITIVE_ANSWERS_VERSION = 2;

export const LEGACY_DEFAULTS = {
  workAuthorization: 'Yes',
  requireSponsorship: false,
  over18: true,
  driverLicense: true,
  backgroundCheck: true,
  drugTest: true,
  criminalRecord: false,
  gender: 'Prefer not to say',
  pronouns: 'Prefer not to say',
  race: 'Prefer not to say',
  veteranStatus: 'I am not a protected veteran',
  disabilityStatus: 'I do not have a disability',
} as const;

export type SensitiveKey = keyof typeof LEGACY_DEFAULTS;
export const SENSITIVE_KEYS = Object.keys(LEGACY_DEFAULTS) as SensitiveKey[];

/**
 * The user's real answer, or null when they have not chosen one.
 * Strings come back as strings, booleans as booleans.
 */
export function sensitiveValue(ext: Record<string, unknown>, key: SensitiveKey): string | boolean | null {
  const v = ext[key];
  if (v === undefined || v === null || v === '') return null;
  if (typeof v !== 'string' && typeof v !== 'boolean') return null;
  const confirmed = Number(ext.sensitiveAnswersVersion) >= SENSITIVE_ANSWERS_VERSION;
  if (!confirmed && v === LEGACY_DEFAULTS[key]) return null;
  return v;
}

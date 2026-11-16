// components/apply/types.ts
import type { ApplyPack, TrackedApplication } from '@/lib/applications/pack';

export type ApplyStep = 'resume' | 'letter' | 'save' | 'tracker' | 'prep';

export interface ApplyStepProps {
  application: TrackedApplication;
  pack: ApplyPack;
  /** Replace the pack with the server's latest copy. */
  onPack: (pack: ApplyPack) => void;
  /** PATCH the pack and adopt the result; null when the save failed. */
  update: (patch: Record<string, unknown>) => Promise<ApplyPack | null>;
  goTo: (step: ApplyStep) => void;
}

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
  /**
   * Auto-apply (components/apply/AutoRun) is running the steps. Each step
   * locks its own actions meanwhile, so a click cannot race the run: two
   * tailoring passes, or a letter saved over the one being written.
   */
  autoRunning?: boolean;
}

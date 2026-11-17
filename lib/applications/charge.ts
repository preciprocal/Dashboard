// lib/applications/charge.ts
//
// One job taken through the Apply flow costs one 'applications' unit, however
// many of its steps run: the tailored resume, the cover letter and the prep.
// The unit is taken by the first step that succeeds and recorded on the pack,
// so the other steps for that job are covered. Each step can be run again a
// few times (a new tone, a changed posting), but not without end.
import { NextResponse } from 'next/server';
import { checkUsage, checkAndIncrementUsage } from '@/lib/ai/usage-guard';
import type { ApplyPack } from '@/lib/applications/pack';

export type ApplyStep = 'tailor' | 'prep' | 'letter';

/** Generations allowed per step, per application. */
export const RUNS_PER_STEP = 3;

/** Round reviews (after-round) allowed per application. */
export const ROUNDS_PER_APPLICATION = 5;

const STEP_NAME: Record<ApplyStep, string> = {
  tailor: 'tailored this resume',
  prep: 'made prep for this job',
  letter: 'written this cover letter',
};

/** A response to send when this step may not run, or null when it may. */
export async function gateStep(userId: string, pack: ApplyPack, step: ApplyStep): Promise<NextResponse | null> {
  if ((pack.runs?.[step] ?? 0) >= RUNS_PER_STEP) {
    return NextResponse.json({
      error: `You have ${STEP_NAME[step]} ${RUNS_PER_STEP} times for this application. Edit the last one by hand.`,
      code: 'STEP_LIMIT',
    }, { status: 429 });
  }
  if (pack.chargedAt) return null;
  const usage = await checkUsage(userId, 'applications');
  if (!usage.allowed) {
    return NextResponse.json({ error: usage.message, code: 'USAGE_LIMIT', used: usage.used, limit: usage.limit }, { status: 403 });
  }
  return null;
}

/** Count a successful run on the pack, taking the unit if this job has not used one. The caller saves the pack. */
export async function chargeStep(userId: string, pack: ApplyPack, step: ApplyStep): Promise<void> {
  pack.runs = { ...pack.runs, [step]: (pack.runs?.[step] ?? 0) + 1 };
  if (!pack.chargedAt) {
    await checkAndIncrementUsage(userId, 'applications');
    pack.chargedAt = new Date().toISOString();
  }
}

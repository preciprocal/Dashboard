// scripts/provision-vapi-assistants.ts
// Create or update the 12 saved Vapi assistants that back mock interviews.
//
//   npx tsx --env-file=.env.local scripts/provision-vapi-assistants.ts --dry-run
//   npx tsx --env-file=.env.local scripts/provision-vapi-assistants.ts
//
// Why these live in Vapi rather than in this repo: every call is dialled
// client-side with the public key, so an inline assistant config travels from
// the browser and any cap in it can be edited by a modified client. Referencing
// a saved assistant by id means the browser picks WHICH assistant runs but
// cannot change what that assistant is allowed to do. See
// lib/config/interview-limits.ts.
//
// Why a script rather than the dashboard: twelve assistants x (duration,
// endCallMessage, voice, prompt) is a lot of hand-typed values, and the two
// that matter most - maxDurationSeconds and endCallMessage - are exactly the
// ones a typo makes silently wrong. Here they are DERIVED from
// interview-limits.ts, so the repo and the dashboard cannot disagree at
// creation time. scripts/export-vapi-assistants.ts --check catches drift after.
//
// Idempotent by name: re-running updates in place rather than creating
// duplicates. Existing assistants not in this set are never touched.

import {
  expectedAssistants,
  END_CALL_MESSAGE,
  type InterviewPhase,
} from "../lib/config/interview-limits";
import { technicalInterviewer, behavioralInterviewer } from "../constants";

const API = "https://api.vapi.ai";
const NAME_PREFIX = "preciprocal";

/** Stable, greppable name. Also the idempotency key. */
const assistantName = (tier: string, phase: InterviewPhase) =>
  `${NAME_PREFIX}-${tier}-${phase}`;

/**
 * Which repo-side assistant a phase is based on.
 *
 * The prompts, voices and transcriber settings still live in constants/index.ts
 * and are pushed up from here. Only the duration and the closing line are
 * computed. That keeps prompt edits reviewable in git even though the
 * dashboard is the runtime source of truth.
 */
function baseFor(phase: InterviewPhase) {
  return phase === "behavioural" || phase === "mixed_behavioural"
    ? behavioralInterviewer
    : technicalInterviewer;
}

async function vapi(key: string, path: string, init?: RequestInit) {
  const r = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`${init?.method ?? "GET"} ${path} -> ${r.status} ${JSON.stringify(body)?.slice(0, 300)}`);
  return body;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const key = process.env.VAPI_PRIVATE_KEY;
  if (!key) {
    console.error("VAPI_PRIVATE_KEY is not set.");
    process.exit(1);
  }

  const existing: Array<{ id: string; name?: string }> = await vapi(key, "/assistant");
  const byName = new Map(existing.filter((a) => a.name).map((a) => [a.name!, a.id]));

  const results: Array<{ envVar: string; id: string; action: string; seconds: number }> = [];

  for (const e of expectedAssistants()) {
    const name = assistantName(e.tier, e.phase);
    const base = baseFor(e.phase);

    const payload = {
      ...base,
      name,
      // The two derived fields. Everything else comes from constants/index.ts.
      maxDurationSeconds: e.expectedMaxDurationSeconds,
      endCallMessage: END_CALL_MESSAGE,
      // Both system prompts instruct the model to "leave 5-10 seconds of
      // silence after they stop", which on a per-minute billed call is paid
      // dead air with nothing ending it. 30s is generous for a candidate
      // thinking through a hard question and still bounds the damage.
      silenceTimeoutSeconds: 30,
    };

    const id = byName.get(name);
    const action = id ? "update" : "create";

    if (dryRun) {
      results.push({ envVar: e.envVar, id: id ?? "(would create)", action, seconds: e.expectedMaxDurationSeconds });
      continue;
    }

    const saved = id
      ? await vapi(key, `/assistant/${id}`, { method: "PATCH", body: JSON.stringify(payload) })
      : await vapi(key, "/assistant", { method: "POST", body: JSON.stringify(payload) });

    results.push({ envVar: e.envVar, id: saved.id, action, seconds: e.expectedMaxDurationSeconds });
  }

  console.log(`\n${dryRun ? "DRY RUN - nothing written" : "Provisioned"}: ${results.length} assistants\n`);
  for (const r of results) {
    console.log(`  ${r.action.padEnd(6)} ${String(r.seconds / 60).padStart(4)}min  ${r.envVar}`);
  }

  if (!dryRun) {
    console.log("\nAdd these to .env.local and to your hosting environment:\n");
    for (const r of results) console.log(`${r.envVar}=${r.id}`);
    console.log("\nThen run: npx tsx --env-file=.env.local scripts/export-vapi-assistants.ts");
  }
}

main().catch((err) => {
  console.error("\nFailed:", (err as Error).message);
  process.exit(1);
});

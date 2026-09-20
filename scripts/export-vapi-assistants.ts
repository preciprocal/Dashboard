// scripts/export-vapi-assistants.ts
// Snapshot the live Vapi saved-assistant configs into a checked-in file.
//
//   npx tsx --env-file=.env.local scripts/export-vapi-assistants.ts
//   npx tsx --env-file=.env.local scripts/export-vapi-assistants.ts --check
//
// The Vapi dashboard is the SOURCE OF TRUTH for these assistants - that is the
// price of server-side duration enforcement, since a cap the repo can set is a
// cap a modified client can change. The cost is that prompts, voices and caps
// stop being code-reviewed and stop appearing in git history.
//
// This closes that gap without pretending to fix it. The snapshot is
// write-only documentation: nothing reads it at runtime, editing it changes
// nothing, and the dashboard still wins. What it buys is `git diff` - if a
// system prompt or a duration changes, the next export shows exactly what and
// when.
//
// --check exits non-zero when the live config has drifted from the snapshot or
// from lib/config/interview-limits.ts, which makes it usable in CI.

import { writeFileSync, readFileSync, existsSync } from "fs";
import { resolve } from "path";
import {
  expectedAssistants,
  END_CALL_MESSAGE,
  INTERVIEW_DURATION_SECONDS,
  MIXED_SPLIT,
} from "../lib/config/interview-limits";

const SNAPSHOT = resolve(process.cwd(), "vapi-assistants.snapshot.json");

/** Fields worth diffing. Excludes ids, timestamps and org metadata, which churn. */
interface AssistantSnapshot {
  tier: string;
  phase: string;
  name?: string;
  maxDurationSeconds?: number;
  endCallMessage?: string;
  silenceTimeoutSeconds?: number;
  voice?: { provider?: string; voiceId?: string; speed?: number };
  model?: { provider?: string; model?: string };
  transcriber?: { provider?: string; model?: string };
  firstMessage?: string;
  systemPromptSha256?: string;
  systemPromptChars?: number;
}

async function fetchAssistant(key: string, id: string) {
  const r = await fetch(`https://api.vapi.ai/assistant/${id}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!r.ok) throw new Error(`GET /assistant/${id} -> ${r.status} ${await r.text()}`);
  return r.json();
}

/**
 * Hash the system prompt rather than storing it.
 *
 * The prompts are ~120 lines each and twelve of them would make every
 * unrelated diff unreadable. A hash still answers the question this file
 * exists for - "did the prompt change, and when" - without the noise. Pull the
 * full text from the dashboard when a hash moves and you need to know how.
 */
async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function main() {
  const check = process.argv.includes("--check");
  const key = process.env.VAPI_PRIVATE_KEY;

  if (!key) {
    console.error(
      "VAPI_PRIVATE_KEY is not set.\n" +
        "The public key cannot read assistant configs - only a private key can. " +
        "Without it this snapshot cannot be taken, and the dashboard config stays " +
        "invisible to git.",
    );
    process.exit(1);
  }

  const expected = expectedAssistants();
  const out: AssistantSnapshot[] = [];
  const problems: string[] = [];

  for (const e of expected) {
    const id = process.env[e.envVar];
    if (!id) {
      problems.push(`${e.envVar} is not set - assistant missing for ${e.tier}/${e.phase}`);
      continue;
    }

    let a: Record<string, unknown>;
    try {
      a = await fetchAssistant(key, id);
    } catch (err) {
      problems.push(`${e.tier}/${e.phase}: ${(err as Error).message}`);
      continue;
    }

    const prompt =
      ((a.model as { messages?: Array<{ role: string; content: string }> })?.messages ?? [])
        .filter((m) => m.role === "system")
        .map((m) => m.content)
        .join("\n") || "";

    // The checks that matter. A drifted cap is the failure this whole design
    // exists to prevent, so it is an error rather than a note.
    if (a.maxDurationSeconds !== e.expectedMaxDurationSeconds) {
      problems.push(
        `${e.tier}/${e.phase}: maxDurationSeconds is ${a.maxDurationSeconds}, ` +
          `expected ${e.expectedMaxDurationSeconds} per lib/config/interview-limits.ts`,
      );
    }
    if (a.endCallMessage !== END_CALL_MESSAGE) {
      problems.push(
        `${e.tier}/${e.phase}: endCallMessage does not match END_CALL_MESSAGE - ` +
          `a hard-cap termination will not end on the designed closing line`,
      );
    }

    out.push({
      tier: e.tier,
      phase: e.phase,
      name: a.name as string | undefined,
      maxDurationSeconds: a.maxDurationSeconds as number | undefined,
      endCallMessage: a.endCallMessage as string | undefined,
      silenceTimeoutSeconds: a.silenceTimeoutSeconds as number | undefined,
      voice: a.voice as AssistantSnapshot["voice"],
      model: {
        provider: (a.model as { provider?: string })?.provider,
        model: (a.model as { model?: string })?.model,
      },
      transcriber: a.transcriber as AssistantSnapshot["transcriber"],
      firstMessage: a.firstMessage as string | undefined,
      systemPromptSha256: prompt ? await sha256(prompt) : undefined,
      systemPromptChars: prompt.length || undefined,
    });
  }

  const snapshot = {
    // Not a timestamp: a timestamp makes every export a diff even when nothing
    // changed, which defeats the purpose.
    note: "Generated by scripts/export-vapi-assistants.ts. The Vapi dashboard is the source of truth; this file exists for git history only. Nothing reads it at runtime.",
    expectedDurationsSeconds: INTERVIEW_DURATION_SECONDS,
    mixedSplit: MIXED_SPLIT,
    assistants: out.sort((a, b) => `${a.tier}/${a.phase}`.localeCompare(`${b.tier}/${b.phase}`)),
  };
  const serialised = JSON.stringify(snapshot, null, 2) + "\n";

  if (check) {
    const previous = existsSync(SNAPSHOT) ? readFileSync(SNAPSHOT, "utf8") : "";
    if (previous !== serialised) {
      problems.push("Live config differs from vapi-assistants.snapshot.json - re-run without --check and commit the diff");
    }
    if (problems.length) {
      console.error("Vapi assistant drift:\n" + problems.map((p) => `  - ${p}`).join("\n"));
      process.exit(1);
    }
    console.log(`No drift across ${out.length} assistants.`);
    return;
  }

  writeFileSync(SNAPSHOT, serialised, "utf8");
  console.log(`Wrote ${SNAPSHOT} (${out.length} assistants).`);
  if (problems.length) {
    console.warn("\nProblems found (snapshot still written so the drift is visible in git):");
    for (const p of problems) console.warn(`  - ${p}`);
    process.exit(1);
  }
}

main();

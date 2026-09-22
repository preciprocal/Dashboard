// scripts/verify-mixed-split.ts
//
//   npm run verify:mixed-split
//
// A mixed interview runs as two calls: the behavioural half with the HR
// interviewer, then the technical half with the lead. Which questions go to
// which half decides whether that is a mixed interview or just a technical one
// asked in two voices.
//
// The generator writes a real split into interviews.metadata. toInterview()
// dropped metadata, so the panel fell back to slicing the flat `questions`
// array down the middle - positional, not semantic. A candidate reported
// exactly that symptom: "I ran a mixed interview but it just asked me tech
// ones."
//
// This reads production rows and checks the split now survives the trip from
// the database to the props the panel receives, and that the halves are the
// generator's rather than a coincidence of array order.

import { supabaseAdmin } from "@/supabase/admin";
import { getInterviewById } from "@/lib/actions/general.action";

let pass = 0;
let fail = 0;
const check = (n: string, ok: boolean, d = "") => {
  if (ok) { pass++; console.log("  PASS  " + n); }
  else    { fail++; console.log("  FAIL  " + n + (d ? "  -> " + d : "")); }
};

(async () => {
  const { data: rows } = await supabaseAdmin
    .from("interviews").select("id, type, questions, metadata")
    .eq("type", "mixed").order("created_at", { ascending: false }).limit(5);

  if (!rows?.length) {
    console.log("No mixed interviews in the database - nothing to check.");
    process.exit(0);
  }

  console.log(`Checking ${rows.length} mixed interviews\n`);

  for (const row of rows) {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    const metaTech = meta.technicalQuestions as string[] | undefined;
    const metaBeh  = meta.behavioralQuestions as string[] | undefined;
    const short    = row.id.slice(0, 8);

    if (!Array.isArray(metaTech) || !Array.isArray(metaBeh)) {
      console.log(`  SKIP  ${short} has no split in metadata (older row)`);
      continue;
    }

    // Straight through the real read path, cache included.
    const interview = await getInterviewById(row.id);
    if (!interview) { check(`${short} loads`, false, "getInterviewById returned null"); continue; }

    check(`${short} carries technicalQuestions`, Array.isArray(interview.technicalQuestions),
      String(interview.technicalQuestions));
    check(`${short} carries behavioralQuestions`, Array.isArray(interview.behavioralQuestions),
      String(interview.behavioralQuestions));

    check(`${short} technical half matches the generator`,
      JSON.stringify(interview.technicalQuestions) === JSON.stringify(metaTech));
    check(`${short} behavioural half matches the generator`,
      JSON.stringify(interview.behavioralQuestions) === JSON.stringify(metaBeh));

    // The regression this replaces: a positional halving of the flat list.
    // If the generator's split is uneven, the old behaviour is provably
    // different from the new one, which is the whole point.
    const all   = (row.questions as string[]) ?? [];
    const naive = all.slice(0, Math.ceil(all.length / 2));
    if (metaBeh.length !== naive.length || JSON.stringify(metaBeh) !== JSON.stringify(naive)) {
      check(`${short} semantic split differs from the old positional one`, true);
    } else {
      console.log(`  NOTE  ${short} split happens to equal the positional halving`);
    }
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();

// scripts/verify-quota-ordering.ts
// Every route must charge quota only AFTER the work it is charging for.
//
//   npm run verify:quota-ordering
//
// ─── The invariant ──────────────────────────────────────────────────────────
//
// checkAndIncrementUsage must be the last significant thing a handler does
// before returning a result. If an AI call sits after it, a failure in that
// call bills the user for a response they never receive - silently, because
// the error path returns a 500 and says nothing about quota.
//
// Today all sixteen call sites satisfy this. That is worth locking down rather
// than relying on: the ordering is invisible in review, a new route copied from
// an old one can easily charge up front, and nothing at runtime would notice.
// The failure is only ever discovered by a user counting their remaining
// allowance.
//
// ─── What this does NOT cover ───────────────────────────────────────────────
//
// It checks ordering WITHIN one request. It cannot see a feature that charges
// in one request and delivers in another - which is exactly the mock interview
// shape, where generation bills and the voice call delivers minutes later. That
// gap needs lib/ai/usage-refund.ts instead, and a human noticing the shape.
//
// Static analysis by regex rather than the TypeScript AST, deliberately: the
// question is "does this identifier appear after that one, inside the same
// function", which does not need type information, and a dependency-free check
// is one that still runs in two years.

import * as fs from "fs";
import * as path from "path";

const API_DIR = path.join(process.cwd(), "app", "api");

/** Calls that cost money and must therefore precede the charge. */
const AI_CALL = /\b(?:anthropic!?\.messages\.create|openai\.chat\.completions\.create|generateObject|generateText|callClaude)\s*\(/;

/** Where a new function body begins, used to bound the search. */
const FUNCTION_START = /^\s*(?:export\s+)?(?:async\s+)?function\s+\w+|^(?:export\s+)?const\s+\w+\s*=\s*(?:async\s*)?\(/;

const CHARGE = /checkAndIncrementUsage\s*\(/;

let pass = 0;
let fail = 0;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith(".ts")) out.push(full);
  }
  return out;
}

function check(name: string, ok: boolean, detail = "") {
  if (ok) { pass++; console.log("  PASS  " + name); }
  else    { fail++; console.log("  FAIL  " + name + (detail ? "\n          " + detail : "")); }
}

function main() {
  const files = walk(API_DIR).filter((f) => CHARGE.test(fs.readFileSync(f, "utf8")));
  console.log(`Scanning ${files.length} routes that charge quota\n`);

  for (const file of files) {
    const rel   = path.relative(process.cwd(), file).replace(/\\/g, "/");
    const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);

    lines.forEach((line, i) => {
      // Skip the import and any mention inside a comment.
      if (!CHARGE.test(line)) return;
      if (/^\s*(\/\/|\*|\/\*)/.test(line)) return;
      if (/\bimport\b/.test(line)) return;

      // Search forward to the end of the enclosing function. A new top-level
      // function declaration ends it; so does the end of the file.
      let offending: number | null = null;
      for (let j = i + 1; j < lines.length; j++) {
        if (FUNCTION_START.test(lines[j])) break;
        if (/^\s*(\/\/|\*|\/\*)/.test(lines[j])) continue;
        if (AI_CALL.test(lines[j])) { offending = j + 1; break; }
      }

      check(
        `${rel}:${i + 1}`,
        offending === null,
        offending === null
          ? ""
          : `charges on line ${i + 1} but calls a paid model again on line ${offending}. ` +
            `Move the charge below it, or refund on failure via lib/ai/usage-refund.ts.`,
      );
    });
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  if (fail) {
    console.log(
      "\nA route that charges before its model call bills users for responses\n" +
      "they never receive, and nothing at runtime will report it.",
    );
  }
  process.exit(fail ? 1 : 0);
}

main();

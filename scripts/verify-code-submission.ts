// scripts/verify-code-submission.ts
//
//   npm run verify:code-submission
//
// The interview code editor sends the candidate's code to a live voice call
// and to the feedback prompt. Two failures matter: spamming the call (every
// keystroke becoming a message the interviewer has to absorb), and an
// interview without code behaving differently from before the editor
// existed. Both are rules in lib/interview/code-submission.ts, asserted here
// against the real functions.

import {
  shouldShare, sanitizeCodeSubmission, asCodeReview, codeContextMessage,
  codeFeedbackPromptSection, AUTO_SHARE_INTERVAL_MS, MAX_CODE_CHARS,
  CODE_INTERVIEW_INSTRUCTIONS, CODE_LANGUAGES,
} from "@/lib/interview/code-submission";

let pass = 0;
let fail = 0;
const check = (name: string, ok: boolean, detail = "") => {
  if (ok) { pass++; console.log("  PASS  " + name); }
  else    { fail++; console.log("  FAIL  " + name + (detail ? "  -> " + detail : "")); }
};

console.log("[1] share throttle");
const base = { code: "def f(): pass", lastSentCode: null, lastSentAt: null, now: 100_000 };
check("first explicit share goes", shouldShare({ ...base, explicit: true }));
check("first automatic share goes", shouldShare({ ...base, explicit: false }));
check("blank code never goes", !shouldShare({ ...base, code: "   \n", explicit: true }));
check("unchanged code never goes, even explicitly",
  !shouldShare({ ...base, lastSentCode: base.code, lastSentAt: 0, explicit: true }));
check("automatic share waits out the interval",
  !shouldShare({ ...base, code: "x = 1", lastSentCode: "x", lastSentAt: base.now - AUTO_SHARE_INTERVAL_MS + 1, explicit: false }));
check("automatic share goes once the interval passes",
  shouldShare({ ...base, code: "x = 1", lastSentCode: "x", lastSentAt: base.now - AUTO_SHARE_INTERVAL_MS, explicit: false }));
check("explicit share ignores the interval",
  shouldShare({ ...base, code: "x = 1", lastSentCode: "x", lastSentAt: base.now - 1, explicit: true }));
check("interval is at least 20s", AUTO_SHARE_INTERVAL_MS >= 20_000, String(AUTO_SHARE_INTERVAL_MS));

console.log("\n[2] sanitising what the browser sends");
check("null is no code", sanitizeCodeSubmission(null) === null);
check("blank code is no code", sanitizeCodeSubmission({ language: "python", code: "  " }) === null);
check("unknown language rejected", sanitizeCodeSubmission({ language: "cobol", code: "DISPLAY 1" }) === null);
check("non-string code rejected", sanitizeCodeSubmission({ language: "go", code: 42 }) === null);
const long = sanitizeCodeSubmission({ language: "go", code: "a".repeat(MAX_CODE_CHARS + 500) });
check("oversized code is truncated to the cap", long?.code.length === MAX_CODE_CHARS, String(long?.code.length));
check("all seven required languages present",
  ["javascript", "typescript", "python", "java", "cpp", "go", "sql"].every((l) => CODE_LANGUAGES.some((c) => c.id === l)));

console.log("\n[3] interviews without code are unchanged");
check("no code means an empty prompt section", codeFeedbackPromptSection(null) === "");
const section = codeFeedbackPromptSection({ language: "python", code: "print(1)" });
check("code section asks for codeReview", section.includes("\"codeReview\""));
check("code section grades the discussion too", /answered the interviewer's questions/.test(section));

console.log("\n[4] the interviewer is told to ask, not tell");
const msg = codeContextMessage({ language: "python", code: "def f(): pass" }, true);
check("context message is labelled", msg.startsWith("CANDIDATE CODE"));
check("context message fences the code", msg.includes("```python\ndef f(): pass\n```"));
check("explicit share asks for a follow-up", /follow-up question/.test(msg));
check("automatic update does not interrupt",
  /Do not interrupt/.test(codeContextMessage({ language: "python", code: "x" }, false)));
check("instructions cover complexity and edge cases", /complexity/.test(CODE_INTERVIEW_INSTRUCTIONS) && /edge cases/.test(CODE_INTERVIEW_INSTRUCTIONS));
check("instructions forbid giving the answer away", /Do not give the answer away/.test(CODE_INTERVIEW_INSTRUCTIONS));
check("instructions allow prompting for code", /no code has arrived/.test(CODE_INTERVIEW_INSTRUCTIONS));

console.log("\n[5] stored review is checked, not cast");
const r = asCodeReview({ language: "java", code: "class A {}", score: 140, correctness: " ok " });
check("score clamped to 100", r?.score === 100, String(r?.score));
check("text trimmed", r?.correctness === "ok");
check("missing notes become empty strings", r?.readability === "");
check("garbage is null", asCodeReview("nope") === null);
check("non-numeric score is null", asCodeReview({ language: "go", code: "x", score: "9" })?.score === null);

const prose = [CODE_INTERVIEW_INSTRUCTIONS, msg, section].join("\n");
check("no em or en dashes in copy sent to models", !/[–—]/.test(prose));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

# Follow-ups

Deferred work and known issues that are decided-but-not-done, so they do not
get lost between sessions. Each entry says what it is, why it was deferred, and
what unblocks it.

Not a general backlog. Things land here when they were found during other work
and consciously left alone, rather than being forgotten.

---

## 1. Live billing bug: unknown Stripe price id resolves to two different plans

**Severity: high. Predates the quota work, surfaced by it.**

The same unmapped price id produces opposite results depending on which code
path runs:

- `app/api/webhooks/stripe/route.ts` (`getPlanFromPriceId`) defaults to `free`
- `app/api/subscription/activate/route.ts` (`PRICE_TO_PLAN`) defaults to `pro`

A price id absent from those maps (a new Stripe product, a test price, a
renamed one) silently grants Pro on one path and downgrades to free on the
other. Whichever fires first wins.

There are **five** copies of plan pricing data in total:

| Location | Shape |
| --- | --- |
| `app/api/webhooks/stripe/route.ts` | price id to plan, unknown to `free` |
| `app/api/subscription/activate/route.ts` | price id to plan, unknown to `pro` |
| `app/(root)/pricing/page.tsx` | price ids + hardcoded display strings |
| `components/StripePaymentForm.tsx` | dead code, never imported |
| `lib/config/plan-prices.ts` | plan to amount (added for refund proration) |

**Deferred because** consolidating them touches the live billing path and
deserves its own change with its own review, rather than riding along with
quota or refund work. Owner to schedule.

**Unblocked by** nothing. Can be done any time.

---

## 2. User-facing refund request UI

**Severity: low while checkout is paused.**

`app/api/refund/request` (GET preview, POST submit) and `app/api/refund/policy`
are complete and tested, but nothing in the app calls them. There is no button
anywhere that starts a refund. This was also true before the refund work.

Needs: preview call, amount display, confirm step, the ineligibility
explanation, and the `quote_stale` retry path.

**Deferred because** checkout is paused (`app/(root)/pricing/page.tsx` renders
`PaymentPausedModal` and never mounts the Stripe form), so no one can subscribe
and therefore no one can qualify for a refund. It also needs copy decisions
about presenting a policy that denies zero-usage refunds, which belongs with
whoever owns pricing-page copy.

**Unblocked by** restoring checkout. Build it in that same pass.

---

## 3. `jobTracker` has no server-side metering

**Severity: medium. Blocks a product decision, not a bug.**

`checkAndIncrementUsage(_, 'jobTracker')` is called nowhere. `job_tracker_used`
is permanently 0 and the limit is enforced only by display logic in
`app/(root)/job-tracker/page.tsx`.

The `+20 tracked jobs` grant was removed from the Application Boost pack
because of this, and `assertGrantsAreEnforceable()` in `lib/config/packs.ts`
now throws if anyone re-adds a grant in an unmetered category.

**Needs a product decision first.** `usage_counters` is per-period and resets
every 30 days, but "8 tracked jobs" in the UI and "+20 tracked jobs" in the
pack copy both read as a *total capacity cap*. Those are different products,
and metering before settling it bakes in the wrong one.

When it happens, two write paths need the guard (`app/api/job-tracker/route.ts`
and `app/api/extension/track-job/route.ts`), and the extension's offline retry
queue needs handling for a quota rejection rather than retrying forever.

---

## 4. `app/api/analyze-resume` has no burst rate limiter

**Severity: low.**

It is the primary resume endpoint and the only quota-consuming route with no
`applyRateLimit` call. Every other resume route uses `heavy` or `medium`.

The hourly cap added in `lib/ai/hourly-quota-limit.ts` now covers it on the
quota-abuse axis, so this is about short bursts only. Three-line fix, left out
because it changes a route's behaviour outside the approved scope at the time.

---

## 5. `0029_phone_verification.sql` is unapplied

**Severity: none today. Becomes blocking the moment Twilio is configured.**

Phone verification is fully built but dormant: `PHONE_VERIFICATION_ENABLED` is
derived from Twilio credential presence, and no Twilio vars are set, so
`requirePhoneVerification()` in `lib/ai/usage-guard.ts` returns early and
nothing is gated.

**Ordering matters when Twilio is added.** Apply `0029` FIRST, then set the
credentials. Setting credentials first turns the gate on and sends users to a
verify flow whose success path writes `profiles.verified_phone` - a column that
does not exist until `0029` runs. Since the write fails, `phone_verified` never
becomes true either, so every Free account created in that window is blocked
from consuming any quota with no way to clear it.

Note the blast radius is now smaller than it was. The gate used to live in
`middleware.ts` and blocked the entire app including `/pricing` and checkout;
since `1b854f0` it blocks only quota consumption on Free accounts, so an
affected user can still browse, pay, and manage their account.

---

## 6. `consume_pack_credit(p_field)` is a misleading parameter name

**Severity: cosmetic.**

It takes a `GatedFeature` key (`resumes`), not a `usage_counters` column name
(`resumes_used`). Passing the column name silently returns no credit, which is
how the bug fixed in `cf231d8` happened.

Postgres cannot rename a parameter in place, so correcting it needs a `DROP`
and `CREATE`. Not worth a migration on its own. **Fold it in whenever a later
migration next touches that function for another reason.**

---

## 7. Pricing page quota numbers are a parallel copy

**Severity: medium. Currently stale.**

`app/(root)/pricing/page.tsx` hardcodes every quota string and does not import
`lib/config/usage-limits.ts`, so it still displays the pre-resize numbers.

Task 0 item 4 calls for serving quota data from one place, coordinated with the
landing-page codebase. `app/api/refund/policy` establishes the pattern for that
kind of cross-repo contract.

---

## 8. Session eviction has no backstop if Redis fails (Task 7.1)

**Severity: high for the control it is meant to provide.**

The concurrent-session cap is enforced in exactly one place, and that place has
a single point of failure with nothing behind it.

`middleware.ts` gates the revocation check on `sessionId && redis && !onSignIn
&& isDocumentNavigation(request)`. If Redis is unconfigured or down, **the
`redis &&` short-circuits and revocation is never enforced at all** - silently,
with no error path. `lib/session/registry.ts` only logs a publish failure.

There is a second, independent check that would have covered this, and it is
thrown away. `lib/session/registry.ts:60` computes `{ revoked: true }` from the
database, and `app/api/session/heartbeat/route.ts:64` returns it to the client:

```ts
return NextResponse.json({ ok: true, tracked: true, revoked: result.revoked });
```

But `components/SessionHeartbeat.tsx:24-30` awaits the `fetch` and never reads
the body. The DB-backed signal is computed, transmitted, and discarded.

**So eviction depends entirely on Redis, despite a working database check
already existing and being one `.json()` call away from being usable.** This is
not a cosmetic bug: it is the difference between the device cap having a
backstop and having none.

Two further limits on enforcement, both by design and documented in
`0026_user_sessions.sql:10-15`:

- Revocation is **advisory**. It cannot kill the GoTrue session; middleware
  signs the user out on their next page load.
- Only **document navigations** are checked (`Accept: text/html`). API calls
  and server-action fetches from an evicted session keep working indefinitely,
  so a session that never does a full navigation is never signed out.

Fixing the discarded flag is small: read the response in `SessionHeartbeat.tsx`
and sign out when `revoked` is true. That alone gives the cap a path that works
when Redis does not.

---

## 9. Signup rate limiting is weaker than specified (Task 4.2)

**Severity: medium. Audited, not fixed.**

| Control | Spec | Actual |
| --- | --- | --- |
| Per device | max 1 / 30d | 1 ✓ (`abuse-guard.ts:14`) |
| Per IP | max 1 / 30d | **3** (`abuse-guard.ts:38`) |
| OAuth fingerprint | required | **not passed** (`auth.action.ts:384,412`) |
| Window | last 30 days | fixed from first signup, not sliding |

The IP limit was knowingly raised from 1 to 3, with a documented reason: on the
OAuth path `exchangeCodeForSession` has already created the auth user by the
time the guard runs, so a block *deletes* that account. At 1, a second genuine
student on campus wifi would have their Google account created and destroyed.

The compounding problem is that OAuth passes `null` for the fingerprint both
when checking and when recording, so a Google signup is invisible to the device
limit entirely. **Net effect on the Google path: 3 accounts per IP per 30 days,
with no per-device limit at all.**

The error copy still says "Preciprocal allows one free account per person",
which is shown after the fourth IP attempt and misstates the enforced rule.

Also note `signup-limiter.ts:41` fails open when Redis is absent.

---

## 10. Resume duplicate detection misses its main case (Task 4.3)

**Severity: medium. Audited, not fixed.**

Two gaps against the spec:

**It flags nobody when the counterpart is a paying account.**
`lib/abuse/resume-hash.ts:94-103` filters matches down to Free accounts, then
requires `involved.length >= 2`. If a Free account uploads a resume a Pro or
Premium account already holds, `involved` has length 1 and the function returns
**without flagging either account** - including the Free uploader, which is the
account the rule exists to catch.

**It is exact-match, not near-duplicate.** The spec asks for near-duplicate
detection. After normalisation it is a plain SHA-256 equality test, so one
changed character anywhere defeats it. The author documents this at
`resume-hash.ts:12-17`: real near-duplicate matching needs simhash/minhash and
a similarity threshold.

Minor: `.limit(25)` at `resume-hash.ts:80` silently truncates a large ring, and
uploads with no extracted text or under 400 characters are skipped with no
hash stored.

Correctly log-only with no blocking, and both write paths are covered.

---

## 11. Device-spread check only runs on new-session creation (Task 7.2)

**Severity: low.**

`lib/session/registry.ts:85-86` - both `enforceSessionCap` and
`checkDeviceSpread` run only on the new-session branch. The existing-session
path returns at `registry.ts:69` first. An account that crosses the 3-device or
3-location threshold through activity on already-registered sessions is not
re-evaluated until the next fresh login.

---

## 12. Stored session geolocation is nulled by headerless heartbeats (Task 7.2)

**Severity: low.**

`lib/session/registry.ts:67` updates `geo_country` and `geo_city`
unconditionally on every heartbeat:

```ts
.update({ last_seen_at: now, ip: ctx.ip, geo_country: ctx.geoCountry, geo_city: ctx.geoCity })
```

The values come from Vercel edge headers (`x-vercel-ip-country`,
`x-vercel-ip-city`), which are absent off-Vercel and on local requests. A
session that recorded good geolocation at creation loses it on the first
heartbeat that arrives without those headers, so `checkDeviceSpread`'s location
set degrades toward empty and the geography half of the rule quietly stops
firing. Fix is to only overwrite when the incoming value is non-null.

---

## 13. Task 6 is OPEN: mock interview caps and cost logging are built but not live

**Severity: blocking. Not deployable until the steps below are done.**

The code chain is complete and statically verified - typecheck and lint clean,
12 saved Vapi assistants provisioned and confirmed server-side. **No audio has
ever passed through it.** Do not treat it as working.

### Done

**1. `0033_interview_call_costs.sql` applied.** Table and the
`interview_cost_summary` view both verified present.

**2. `VAPI_WEBHOOK_SECRET` set locally.**

**3. `serverUrl` attached to all 12 assistants.** Verified 12/12, scoped to
`end-of-call-report` only.

Note on verifying the secret: Vapi's `GET /assistant` never returns
`server.secret`. A probe value written and read back came back absent,
confirming it is write-only rather than unset. The readable signal is a
separate boolean, `isServerUrlSecretSet`, which reads true on all 12. Use that
flag, not the absence of `secret`, when checking this in future.

### STILL OPEN

**4. Push env vars to Vercel.** Two sets, both required:

- the 12 `VAPI_ASSISTANT_*` ids. Without them `assistantIdFor()` throws and
  `/api/interview/session` returns 503. That refusal is deliberate: falling
  back to an inline assistant would silently remove the duration cap.
- `VAPI_WEBHOOK_SECRET`, matching the Vapi copy byte-for-byte.

**The second fails quietly and is the dangerous one.** Without it in Vercel,
calls connect, caps hold, the wrap-up fires and interviews work perfectly while
the webhook 401s every report and `interview_call_costs` stays empty. Nothing
visibly breaks; you only find out when you go looking for cost data.

**5. Deploy.** Both `/api/interview/session` and `/api/vapi/webhook` currently
404 in production.

**6. Consider rotating the secret** once the pipeline is confirmed working. The
value was pasted into a chat transcript during setup.

### Verification still owed, by a real end-to-end call

A browser, a microphone, and 8 to 12 minutes of actual speech. Five things to
confirm:

1. `/api/interview/session` returns the assistant matching the caller's plan
2. The wrap-up fires at T-75s and the interviewer winds down in its own voice
3. A call left to run terminates on `endCallMessage`, not silence
4. A row lands in `interview_call_costs` with real duration and cost
5. **A mixed interview produces TWO rows summing to the tier budget**

Point 5 is the real test of the pre-split design. If phase two runs past its
share, the split is wrong and the combined budget does not hold.

### The number to report back

`INTERVIEW_COST_BY_PLAN` in `lib/config/feature-costs.ts` is derived from
`VAPI_COST_PER_MINUTE = 0.15`, back-solved from an unverified "$1.20 for 8
minutes" estimate. It inherits whatever that estimate got wrong.

The first rows in the `interview_cost_summary` view are the first real data.
Compare `avg_cost_usd` against the estimate. If actual cost runs higher, that
is a pricing and quota conversation, not a reason to quietly tighten limits.

### Known weaknesses, accepted

- **The wrap-up is client-side and bypassable.** It is a courtesy, not the cap.
  Stripping it out gets a call that terminates on `endCallMessage` instead of
  winding down gracefully - a worse interview, not a longer one.
- **A Free user who learns a Premium assistant id could use it.** The ids never
  reach the browser (`/api/interview/session` resolves them server-side), so
  this needs the id from somewhere else. Bounded overage: 4 extra minutes.
- **Squads were not used.** One call with two voices and one shared budget
  would be strictly better, but there is an open report that squad calls ignore
  `max_duration_seconds`, and proving otherwise needs a real call running past
  the cap. Worth revisiting if Vapi confirms a fix.

---

## 14. Dead `type: "generate"` workflow branch in the interview panel

**Severity: none today. Unreachable. Logged so it is not capped by mistake, and
not reintroduced by accident.**

`startInterview()` in `app/(root)/interview/[id]/FullScreenInterviewpanel.tsx`
has a branch for `type === "generate"` that calls
`vapi.start(NEXT_PUBLIC_VAPI_WORKFLOW_ID, ...)`. That path does NOT go through
`/api/interview/session`, so it would bypass the tiered duration cap entirely
and run to Vapi's 600s default.

**It cannot be triggered.** Three independent reasons, any one sufficient:

1. `NEXT_PUBLIC_VAPI_ASSISTANT_ID` has **zero code references** anywhere in
   `app/`, `lib/`, `components/` or `constants/`. It exists only in the env
   file.
2. The only render site of `FullScreenInterviewPanel` is
   `app/(root)/interview/[id]/InterviewPageClient.tsx`, and it hardcodes
   `type="interview"`. No caller passes `"generate"`.
3. `NEXT_PUBLIC_VAPI_WORKFLOW_ID` is not set, so the branch would throw before
   dialling anything.

**If that branch is ever revived, it needs a cap before it ships.** Either
route it through `/api/interview/session` like every other call, or provision a
capped assistant for it. Do not simply set `NEXT_PUBLIC_VAPI_WORKFLOW_ID` and
pass `type="generate"` - that produces uncapped calls with no error.

Cleanest resolution is deleting the branch and the two unused env vars, but
that is a behaviour-adjacent edit to a file that was just rewired, so it was
left alone rather than folded into the Vapi work.

---

## 15. 222 dependency vulnerabilities on `main`

**Severity: unknown until triaged. Needs its own pass.**

Reported by GitHub when `main` was pushed at `5f466b0`:

```
222 vulnerabilities: 8 critical, 106 high, 93 moderate, 15 low
```

https://github.com/preciprocal/Dashboard/security/dependabot

Entirely pre-existing and unrelated to the quota, refund or Vapi work - it
became visible because that push was the first change to the default branch in
a while.

Worth knowing before triage: this repo still carries `firebase`,
`firebase-admin`, `firebase-functions`, `firebase-scrypt` and
`react-firebase-hooks` despite the Supabase migration. Exactly one runtime
import of `@/firebase/*` remains (`lib/auth/verify-request.ts`, for the Chrome
extension's legacy Firebase token during the dual-auth grace window), plus
`firebase-scrypt` for legacy password migration. Retiring those once extension
token telemetry shows the Firebase path at zero would likely remove a
meaningful share of the tree in one step, which is a better first move than
bumping individual packages.

Also `nodemailer` and `@types/nodemailer` are installed with zero imports -
dead since the switch to Resend.

---

## 16. Mixed interviews unverified: no interview is ever created with type "mixed"

**Severity: medium. The pre-split duration design is UNTESTED.**

Task 6's combined-budget design splits a mixed interview across two calls with
fixed caps (432s + 288s = 720s on premium). That path has never executed.

An attempt to test it produced one call, technical only:

```
3af318ae   type=technical     techQ=2  behQ=0   <- intended as mixed
2b045828   type=behavioural   techQ=0  behQ=1
a1a93591   type=technical     techQ=5  behQ=0
```

No row in `interviews` has `type = 'mixed'`. The panel resolved
`sessionPhase = "technical"`, requested the premium technical assistant, and
asked technical questions - correct behaviour for the input it received. The
bug is upstream, in whatever creates the interview record.

**What is verified:** the cap, the wrap-up, cost logging, metadata attribution
and assistant resolution all work, proven on real solo calls.

**What is not:** that two calls against one interview sum to the tier budget.
Until a genuine mixed interview runs, treat the combined budget as a design
that compiles rather than one that holds. If phase two overruns its 288s share,
a mixed interview costs more than a solo one on the same quota unit.

### Second, separate issue found alongside it

`interviews.type` stores **`behavioural`** (British), while the panel prop type
is `"technical" | "behavioral" | "mixed" | "system-design"` (American). If
`normalizedType` in `InterviewPageClient.tsx` does not map between them, a
behavioural interview falls through `startInterview()`'s branches to the
default case and gets the technical interviewer.

That would affect solo behavioural interviews too, not only mixed ones, and
would be invisible in the cost data - the call still runs, still gets capped,
still records cost. It just uses the wrong interviewer. Worth checking before
trusting any behavioural interview.

Note the same split exists in the Vapi env var names, which use BEHAVIOURAL
deliberately to match `InterviewPhase`. Any fix should pick one spelling per
layer and document which, rather than adding a third convention.

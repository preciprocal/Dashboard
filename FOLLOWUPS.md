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

## 7. PARTLY RESOLVED - quota numbers on the pricing page

The in-app half is done. `app/(root)/pricing/page.tsx` no longer hardcodes quota
strings; it calls `planFeatureLines()` from `lib/config/plan-features.ts`, which
derives them from `USAGE_LIMITS`. The credit pack cards use `featureLabel()`
from the same file.

**Still open: the landing page is a separate codebase and still has its own
copy.** Task 0 item 4 calls for serving quota data from one place across both.
`app/api/refund/policy` establishes the pattern for that kind of cross-repo
contract.

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

## 13. MOSTLY RESOLVED - mock interview caps and cost logging are live

**Was: built but never deployed, no audio ever through it. Now deployed and
confirmed by real calls.** Two items remain, at the end of this entry.

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

### Also done

**4. Env vars pushed to Vercel and deployed.** `/api/interview/session` and
`/api/vapi/webhook` both serve in production.

**5. Confirmed live by real calls.** `interview_call_costs` holds 3 rows with
real durations and costs, which is only possible if the assistant resolution,
the webhook secret and the report handler all work. The cost table was rebuilt
from that data: `VAPI_COST_PER_MINUTE` is now 0.107, measured, replacing the
0.15 back-solved from an estimate.

### STILL OPEN

**6. Rotate `VAPI_WEBHOOK_SECRET`.** The value was pasted into a chat transcript
during setup.

**7. A mixed interview has still never been checked for TWO cost rows summing
to the tier budget.** Seven interviews now exist with `type = 'mixed'`, so they
are being created - the claim in entry 16 that none were is out of date - but
nobody has confirmed that phase two stays inside its 40% share. If it overruns,
a mixed interview costs more than a solo one on the same quota unit. This is the
real test of the pre-split design and the only part of Task 6 still unproven.

**8. Re-check the cost estimate once there is a spread.** 0.107 is measured from
a single call, and Interview Boost is priced at a 52.9% margin on it with almost
no headroom. Compare `avg_cost_usd` in `interview_cost_summary` once more rows
land. If actual cost runs higher, that is a pricing conversation, not a reason
to quietly tighten limits.

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

## 16. CONFIRMED BUG: every behavioural interview gets the technical interviewer

**Severity: medium. Live, affecting real interviews now.**

This entry previously said no interview was ever created with `type = 'mixed'`
and that the spelling mismatch below was a suspicion worth checking. Both parts
were out of date. The current `interviews` table:

```
technical     14
mixed          7      <- they ARE being created
behavioural    5      <- every one of these ran with the wrong interviewer
```

### The confirmed half

`interviews.type` stores **`behavioural`** (British). The panel prop type is
`"technical" | "behavioral" | "mixed" | "system-design"` (American), and
`InterviewPageClient.tsx:342` bridges them with a **cast, not a map**:

```ts
const normalizedType = interview.type.toLowerCase() as "technical" | "behavioral" | "mixed";
```

`toLowerCase()` leaves `"behavioural"` unchanged, and the cast silences the
compiler. In `startInterview()` it then matches none of the branches and falls
to the `else` at line 357, which assigns the generic/technical interviewer and
leaves `resolvedPhase` null. Two lines later:

```ts
: resolvedPhase === "behavioral" ? "behavioural" : "technical"
```

so `sessionPhase` resolves to `"technical"` and the server hands back the
technical assistant.

**Net effect:** a user who books a behavioural interview is interviewed by the
technical persona, using the technical assistant, with the behavioural question
list. The duration cap still applies at the correct tier, so there is no cost or
safety impact - it is purely the wrong interview. It is invisible in the cost
data, which is why it went unnoticed across 5 sessions.

**Fix:** map rather than cast in `InterviewPageClient.tsx`. Note the Vapi env
var names use `BEHAVIOURAL` deliberately to match `InterviewPhase`, so pick one
spelling per layer and document which, rather than adding a third convention.

### The unverified half

Mixed interviews now exist, so the pre-split design does execute. What is still
unconfirmed is that two calls against one interview sum to the tier budget
(432s + 288s = 720s on premium). See entry 13, item 7.

Separately, the split is **positional, not semantic**: `phaseQuestions` halves
the single `questions` array, since `behavioralQuestions` is always undefined in
practice. If a mixed interview's questions are all technical, phase one asks
technical questions in the HR voice. That matches the symptom reported after the
first mixed run and is a second, independent bug from the spelling one.

---

## 17. RESOLVED - Networking Pack price divergence

Kept as a record of what the guard is for, since it is the only time it has
fired on a real mismatch.

The Networking Pack Stripe Price was $5.99 while `lib/config/packs.ts` said
$4.99. The purchase route's price check caught it before anything shipped and
refused to sell with 503 `PRICE_MISMATCH`, so no one could have been charged
the advertised price plus a dollar.

Resolved by updating the amount in Stripe. The Price id
(`price_1UHs6MQSkS83MGF9w7xmyW0T`) did not change, so no env var moved.
`npm run verify:pack-purchase` is now 31/31.

Worth keeping in mind that this only fires at purchase time. A divergence
introduced after a pack goes on sale is caught on the next attempted purchase,
not proactively - running the verify script in CI would close that gap.

## 18. RESOLVED - the UI can now buy a pack

`components/pricing/CreditPacks.tsx` renders the four packs on the pricing page,
POSTs the pack key to `app/api/packs/purchase` and follows the returned Checkout
URL. The page handles the `?pack=&status=` return from Stripe.

Still gated: `PACKS_CHECKOUT_ENABLED` is unset, so the route answers 503 and the
section shows a notice. See 21 for what else has to be true before flipping it.

## 19. Packs have no refund path

`pack_refund_eligible(p_pack_id, p_window_days)` exists in migration 0030 and
has zero callers. `app/api/refund/request` is subscription-only and never looks
at `credit_packs`.

The ledger is already shaped for it - `first_used_at` stays null until the first
credit is drawn, and FIFO consumption is oldest-first specifically to preserve
refund eligibility on the newest purchase. What is missing is the route that
reads that, calls `stripe.refunds.create`, and stamps `refunded_at`.

Until then a pack refund is a manual Stripe dashboard action, and whoever does
it must also set `refunded_at` by hand, or the credits stay spendable after the
money is returned.

## 20. The Stripe webhook still has no event-level idempotency

Adding `checkout.session.completed` did not change this, but it is worth
recording where the protection actually comes from.

Pack grants are safe: `credit_packs_payment_intent_key` is a unique index, so a
redelivered event hits a 23505 and returns `duplicate`. That is enforced by the
database.

The five subscription handlers are not protected that way. They are written to
be naturally idempotent - read, then write the same fields - which holds for
redelivery of the SAME event but not for out-of-order delivery of two different
ones. Stripe does not guarantee ordering. A `stripe_events` table keyed on
`event.id` would close it properly.

## 21. The Stripe webhook endpoint is not subscribed to the checkout events

This is the one thing that would break a real purchase in production, and it is
configuration rather than code.

The only endpoint on the account is:

```
https://app.preciprocal.com/api/webhooks/stripe   (enabled)
  customer.subscription.created
  customer.subscription.deleted
  customer.subscription.updated
  invoice.payment_failed
  invoice.payment_succeeded
```

`checkout.session.completed` and `checkout.session.async_payment_succeeded` are
both absent. The handler for them exists and is tested, but Stripe would never
deliver them, so a customer would pay and receive nothing, with no error on
either side. Nothing in the app can detect this: from our side a purchase that
is never reported is indistinguishable from one that never happened.

Add both events to the endpoint before setting `PACKS_CHECKOUT_ENABLED=true`.
The checked list at the time of writing is test mode; live mode needs its own
endpoint, its own `STRIPE_WEBHOOK_SECRET`, and its own Products and Prices,
since none of the ids in `.env.local` exist in live mode.

## 22. No pack purchase has ever been paid for with a real card

Three suites cover this path and all pass:

```
npm run verify:pack-purchase    31/31   config, grant, idempotency, consume
npm run verify:pack-webhook     22/22   signed events at the real route
npm run verify:pack-checkout    35/35   authenticated route, both switch states
```

`verify:pack-webhook` signs its events with the real `STRIPE_WEBHOOK_SECRET` via
`stripe.webhooks.generateTestHeaderString`, so `constructEvent` validates them
exactly as it would a genuine delivery. Nothing is stubbed.

What that still does not prove: that Stripe's hosted Checkout page, an actual
card charge, and Stripe's own delivery infrastructure produce an event shaped
the way the harness assumes. The event bodies are hand-built from the API
documentation, so a field that differs in practice would pass here and fail in
production.

Closing it needs one test-mode purchase with card 4242 4242 4242 4242 against a
publicly reachable webhook URL, then confirming a `credit_packs` row appears.
That is the last unverified link.
## 23. `components/Agent.tsx` is dead code

Nothing imports it. The live interview UI is
`app/(root)/interview/[id]/FullScreenInterviewpanel.tsx`.

It mattered because it held a third copy of the interview panel-name logic, and
that copy had already drifted ("Sarah Mitchell" where the other two said
"Savannah Mitchell") while still carrying the two-Jennifers collision. It now
reads `panelFor()` from `lib/config/interview-personas.ts` like the other two,
so it cannot drift further or be revived with the bug in it.

That is a holding action. It should be deleted, which needs a check that no
route renders it dynamically and that nothing in the feedback flow
(`createFeedback`) depends on it being the caller. Left alone because deleting a
file is not something to fold into an unrelated fix.

## 24. The avatar videos referenced by the interview panel do not exist

`videoSources` in the panel points at `/videos/hr-female-avatar.mp4`,
`/videos/junior-<role>-avatar.mp4` and similar. `public/` contains no video
files at all, so every one of those is a 404 and the tiles fall back to initials
on a gradient.

Harmless today, and arguably better than a looping stock video. Worth knowing
because the fallback is what every candidate actually sees, so the initials in
`interview-personas.ts` are the real avatar and not a rarely-used backup.

If videos are ever added, they have to match the personas: the names are Indian
and gendered to match the Azure en-IN voices, so a generic stock face would
reintroduce the mismatch that entry was written to fix.

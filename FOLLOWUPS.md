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
`markPhoneVerificationRequired()` returns early and the middleware gate never
fires.

**Ordering matters when Twilio is added.** Apply `0029` FIRST, then set the
credentials. Setting credentials first flips the flag on, starts stamping new
signups with the `phone_verification_required` claim, and sends them to a
verify flow whose success path writes `profiles.verified_phone` - a column that
does not exist until `0029` runs. Every account created in that window is
locked out.

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

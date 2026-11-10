// components/pricing/BillingPromises.tsx
// What we promise about money, stated plainly on the pricing page.
//
// Billing is the top complaint in competitors' one-star reviews: refunds
// refused, charges after cancelling, surprise annual renewals, support that
// only answers through a bot. Each of those is something this app already
// does differently, so the page says so.
//
// Every line here is enforced in code. If you change one, check its source:
//   Cancel in Settings     components/billing/BillingPanel.tsx (setCancel)
//   Refunds, instant       lib/config/refund.ts, lib/refund/first-payment.ts,
//                          lib/refund/unused-credits.ts
//   Renewal heads-up       app/api/webhooks/stripe/route.ts (invoice.upcoming,
//                          customer.subscription.trial_will_end)
//   Auto pay is optional   app/api/subscription/auto-pay, AutoPayPanel.tsx
//   Monthly only           lib/config/stripe-prices.ts (annual was removed)
//   Tax included           lib/stripe/tax.ts
//   People answer support  app/(root)/help (ticket replies from the team)
// A promise that the code stops keeping is worse than no promise at all.

import Link from "next/link";
import { FIRST_REFUND_WINDOW_DAYS } from "@/lib/config/refund";

interface BillingPromise {
  title: string;
  body: string;
  href?: string;
  linkText?: string;
}

const PROMISES: BillingPromise[] = [
  {
    title: "Cancel yourself, any time",
    body: "Settings, Plan & Billing, Cancel. No call, no email, no retention maze. You keep what you paid for until the period ends.",
    href: "/settings?section=billing",
    linkText: "See where",
  },
  {
    title: "Refunds you can take yourself",
    body: `Barely used it? Your first payment back within ${FIRST_REFUND_WINDOW_DAYS} days. After that, the unused part of this month back at any point, and the plan ends. Processed on the spot, minus card fees.`,
    href: "/settings?section=billing",
    linkText: "Refund rules",
  },
  {
    title: "A heads-up before every charge",
    body: "We email you before each renewal and before a free trial converts, with the date and the exact amount.",
  },
  {
    title: "No surprise annual plans",
    body: "Every plan is monthly. Turn auto pay off and we send an invoice instead of charging your card.",
  },
  {
    title: "The price is the price",
    body: "Prices include sales tax or VAT. What you see at checkout is what leaves your account.",
  },
  {
    title: "A person reads your ticket",
    body: "Support replies come from our team, not a bot, and you can follow every reply in Help.",
    href: "/help",
    linkText: "Open Help",
  },
];

export default function BillingPromises() {
  return (
    <section className="mt-12 pt-8 border-t border-white/[0.06]" aria-labelledby="billing-promises">
      <div className="text-center mb-6">
        <h2 id="billing-promises" className="text-lg font-semibold text-white">
          How we handle your money
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          The rules other career tools hide in the fine print.
        </p>
      </div>

      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PROMISES.map(p => (
          <li
            key={p.title}
            className="rounded-xl p-4 bg-white/[0.02] border border-white/[0.06]"
          >
            <p className="text-sm font-semibold text-white">{p.title}</p>
            <p className="text-xs text-slate-400 leading-relaxed mt-1.5">{p.body}</p>
            {p.href && (
              <Link
                href={p.href}
                className="inline-block mt-2 text-xs text-indigo-300 hover:text-white transition-colors"
              >
                {p.linkText}
              </Link>
            )}
          </li>
        ))}
      </ul>

      <p className="text-center text-xs text-slate-400 mt-6">
        Free plan, no card required. Your data is never sold.
      </p>
    </section>
  );
}

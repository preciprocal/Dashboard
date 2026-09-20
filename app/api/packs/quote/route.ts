// app/api/packs/quote/route.ts
// Price a build-your-own credit basket. Reads only; creates nothing, charges
// nothing. A UI calls this on every quantity change to show a live total.
//
// Pricing lives server-side rather than in the client for the obvious reason:
// a browser-computed price is a price the browser can change. When the
// purchase route lands it must re-quote from the same function rather than
// trusting a total posted by the client.
import { NextRequest, NextResponse } from 'next/server';
import { getAuthedUser } from '@/lib/auth/verify-request';
import {
  quoteCustomPack,
  UNIT_PRICE_USD,
  MAX_QUANTITY,
  CUSTOM_PACK_MIN_USD,
  CUSTOM_PACK_MIN_MARGIN,
} from '@/lib/config/custom-pack';
import { PACKS, purchasablePacks } from '@/lib/config/packs';
import { FEATURE_NAMES, type FeatureType } from '@/lib/config/usage-limits';
import { z } from 'zod';

export const runtime = 'nodejs';

// Quantities only. The client never sends prices - see the header note.
const schema = z.object({
  grants: z.record(z.string(), z.number().int().nonnegative()),
});

/** GET: what can be bought, at what unit price, up to what quantity. */
export async function GET(req: NextRequest) {
  const authedUser = await getAuthedUser(req);
  if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const options = (Object.keys(UNIT_PRICE_USD) as FeatureType[]).map((f) => ({
    feature: f,
    label: FEATURE_NAMES[f],
    unitUsd: UNIT_PRICE_USD[f],
    maxQuantity: MAX_QUANTITY[f] ?? 0,
  }));

  return NextResponse.json({
    options,
    minimumUsd: CUSTOM_PACK_MIN_USD,
    // Surfaced so a UI can explain a total that exceeds the line items,
    // rather than showing a number that looks like an error.
    minimumNote:
      `Minimum charge is $${CUSTOM_PACK_MIN_USD.toFixed(2)} - card processing costs a flat ` +
      `fee per purchase, so smaller baskets are rounded up to it.`,
    // The curated packs, for a "or pick a ready-made one" panel. Only those
    // with a configured Stripe price are sellable.
    fixedPacks: purchasablePacks().map((p) => ({
      key: p.key, name: p.name, priceUsd: p.priceUsd,
      description: p.description, grants: p.grants,
    })),
    fixedPacksConfigured: purchasablePacks().length,
    fixedPacksTotal: Object.keys(PACKS).length,
  });
}

/** POST: price a specific basket. */
export async function POST(req: NextRequest) {
  try {
    const authedUser = await getAuthedUser(req);
    if (!authedUser) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const parsed = schema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Send { grants: { feature: quantity } }' }, { status: 400 });
    }

    const quote = quoteCustomPack(parsed.data.grants as never);

    // Deliberately 200 with valid:false rather than 4xx. This runs on every
    // keystroke in a quantity field; a half-finished basket is a normal state,
    // not a client error, and a 400 would fill the console with noise for
    // something the user is in the middle of doing.
    return NextResponse.json({
      valid: quote.valid,
      errors: quote.errors,
      lines: quote.lines.map((l) => ({ ...l, label: FEATURE_NAMES[l.feature] })),
      subtotalUsd: quote.subtotalUsd,
      totalUsd: quote.totalUsd,
      minimumApplied: quote.minimumApplied,
      minimumUsd: CUSTOM_PACK_MIN_USD,
      // Margin and cost are NOT returned. They are internal, and a customer
      // seeing "we make 56% on this" mid-purchase is its own problem. The
      // floor is enforced server-side; the client only needs to know whether
      // the basket is sellable.
    });
  } catch (err) {
    console.error('❌ pack quote error:', err);
    return NextResponse.json({ error: 'Could not price that basket.' }, { status: 500 });
  }
}

// Referenced so the margin floor constant is visibly part of this route's
// contract even though the value is never sent to the client.
void CUSTOM_PACK_MIN_MARGIN;

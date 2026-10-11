// lib/stripe/client.ts
// Browser-side Stripe for the in-app billing screens (card update, invoice
// payment). Same appearance as checkout so card entry looks the same
// everywhere it appears.
'use client';

import { loadStripe } from '@stripe/stripe-js';

export const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

export const stripeAppearance = {
  theme: 'night' as const,
  variables: {
    colorPrimary: '#6366f1',
    colorBackground: '#0d1117',
    colorText: '#e2e8f0',
    colorTextSecondary: '#94a3b8',
    colorDanger: '#f87171',
    fontFamily: "'Inter', system-ui, sans-serif",
    borderRadius: '10px',
    spacingUnit: '4px',
  },
};

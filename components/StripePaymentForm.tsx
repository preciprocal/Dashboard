"use client";

import { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";

// ─── Price IDs ────────────────────────────────────────────────────────────────
export const PRICE_IDS = {
  free:    "price_1TFjvAQSkS83MGF9XlLXgu5H",  // Free $0
  pro: {
    monthly: "price_1TFjwCQSkS83MGF9xH1bdc1o", // Pro $9.99/mo
    annual:  "price_1TFjykQSkS83MGF9oczwiyNo",  // Pro $95.88/yr
  },
  premium: {
    monthly: "price_1TFjzWQSkS83MGF9YCP7CBk3", // Premium $24.99/mo
    annual:  "price_1TFk0EQSkS83MGF9pPfRehCO",  // Premium $239.88/yr
  },
} as const;

interface StripeFormProps {
  planId:       string;
  billingCycle: "monthly" | "yearly";
  user: { name: string; email: string; id?: string };
  onSuccess: () => void;
  onError:   (error: string) => void;
}

interface SubscriptionResponse {
  clientSecret?: string;
  error?: string;
}

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

function StripeFormInner({ planId, billingCycle, user, onSuccess, onError }: StripeFormProps) {
  const stripe   = useStripe();
  const elements = useElements();
  const [loading, setLoading]     = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [mounted, setMounted]     = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Resolve the correct priceId from planId + billingCycle
  const resolvePriceId = (): string => {
    const cycle = billingCycle === "yearly" ? "annual" : "monthly";
    if (planId === "pro")     return PRICE_IDS.pro[cycle];
    if (planId === "premium") return PRICE_IDS.premium[cycle];
    return PRICE_IDS.free;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements) { setCardError("Payment system not ready. Please try again."); return; }

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) { setCardError("Card element not found. Please refresh the page."); return; }

    setLoading(true);
    setCardError(null);

    try {
      const priceId  = resolvePriceId();
      const response = await fetch("/api/subscription/create-subscription", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ priceId, billingCycle }),
      });

      const responseData = await response.json() as SubscriptionResponse;

      if (!response.ok) {
        throw new Error(responseData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const { clientSecret, error } = responseData;
      if (error)         throw new Error(error);
      if (!clientSecret) throw new Error("No client secret received from server");

      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card:             cardElement,
          billing_details:  { name: user.name, email: user.email },
        },
      });

      if (stripeError) throw new Error(stripeError.message || "Payment failed");

      if (paymentIntent?.status === "succeeded") {
        onSuccess();
      } else {
        throw new Error(`Payment status: ${paymentIntent?.status}`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : "Payment failed. Please try again.";
      setCardError(msg);
      onError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="px-3.5 py-3 bg-slate-800/50 border border-white/[0.08] rounded-xl transition-all focus-within:ring-1 focus-within:ring-indigo-500/40">
        <CardElement
          options={{
            style: {
              base: {
                fontSize:      "14px",
                color:         "#e2e8f0",
                fontFamily:    "inherit",
                "::placeholder": { color: "#475569" },
              },
              invalid: { color: "#f87171" },
            },
            hidePostalCode: false,
          }}
        />
      </div>

      {cardError && (
        <div className="p-3 bg-red-900/20 border border-red-800/50 rounded-xl">
          <p className="text-xs text-red-400">{cardError}</p>
        </div>
      )}

      <button
        type="submit"
        disabled={loading || !stripe}
        className="w-full py-3 rounded-xl text-sm font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        style={{ background: "linear-gradient(135deg,#6366f1,#a855f7)" }}
      >
        {loading
          ? <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
              Processing…
            </span>
          : "Subscribe"}
      </button>
    </form>
  );
}

export default function StripePaymentForm(props: StripeFormProps) {
  return (
    <Elements stripe={stripePromise}>
      <StripeFormInner {...props} />
    </Elements>
  );
}
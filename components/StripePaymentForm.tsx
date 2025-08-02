// components/StripePaymentForm.tsx
"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";

// Initialize Stripe outside component to avoid re-initialization
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

// The actual Stripe form component
function StripeFormInner({
  planId,
  billingCycle,
  user,
  onSuccess,
  onError,
}: {
  planId: string;
  billingCycle: "monthly" | "yearly";
  user: any;
  onSuccess: () => void;
  onError: (error: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Only render after component mounts (client-side only)
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      setCardError("Payment system not ready. Please try again.");
      return;
    }

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      setCardError("Card element not found. Please refresh the page.");
      return;
    }

    setLoading(true);
    setCardError(null);

    try {
      console.log("🚀 Starting payment process...");

      // Your existing payment logic here
      const response = await fetch("/api/subscription/create-subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          priceId: "price_1QfMOtEBKJQ1EWKjN7XaI7AV", // Replace with your actual Pro price ID
          billingCycle,
        }),
      });

      console.log("📡 API Response status:", response.status);

      const responseData = await response.json();
      console.log("📦 API Response data:", responseData);

      if (!response.ok) {
        throw new Error(
          responseData.error ||
            `HTTP ${response.status}: ${response.statusText}`
        );
      }

      const { clientSecret, error } = responseData;

      if (error) {
        throw new Error(error);
      }

      if (!clientSecret) {
        throw new Error("No client secret received from server");
      }

      console.log("🔐 Client secret received, confirming payment...");

      const { error: stripeError, paymentIntent } =
        await stripe.confirmCardPayment(clientSecret, {
          payment_method: {
            card: cardElement,
            billing_details: {
              name: user.name,
              email: user.email,
            },
          },
        });

      if (stripeError) {
        console.error("💳 Stripe error:", stripeError);
        throw new Error(stripeError.message || "Payment failed");
      }

      if (paymentIntent?.status === "succeeded") {
        console.log("✅ Payment succeeded!");
        onSuccess();
      } else {
        console.log("⚠️ Payment status:", paymentIntent?.status);
        throw new Error(`Payment status: ${paymentIntent?.status}`);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Payment failed";
      setCardError(errorMessage);
      onError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Don't render anything until mounted (prevents SSR issues)
  if (!mounted) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-gray-800 rounded-lg border border-gray-600 animate-pulse">
          <div className="h-10 bg-gray-700 rounded"></div>
        </div>
        <div className="h-12 bg-gray-700 rounded animate-pulse"></div>
      </div>
    );
  }

  // Show loading state if Stripe hasn't loaded
  if (!stripe || !elements) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-gray-800 rounded-lg border border-gray-600">
          <div className="text-center text-gray-400">
            <div className="animate-spin w-6 h-6 border-2 border-gray-400 border-t-transparent rounded-full mx-auto mb-2"></div>
            Loading payment form...
          </div>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-4 bg-gray-800 rounded-lg border border-gray-600">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: "16px",
                color: "#ffffff",
                fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
                fontSmoothing: "antialiased",
                "::placeholder": {
                  color: "#9ca3af",
                },
              },
              invalid: {
                color: "#ef4444",
                iconColor: "#ef4444",
              },
            },
            hidePostalCode: false,
          }}
          onChange={(event) => {
            if (event.error) {
              setCardError(event.error.message);
            } else {
              setCardError(null);
            }
          }}
        />
      </div>

      {cardError && (
        <div className="text-red-400 text-sm p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          {cardError}
        </div>
      )}

      <button
        type="submit"
        disabled={!stripe || loading || !!cardError}
        className="w-full py-4 text-white font-bold rounded-2xl transition-all duration-300 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <div className="flex items-center justify-center space-x-2">
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            <span>Processing...</span>
          </div>
        ) : (
          `Subscribe for $19/month`
        )}
      </button>

      {/* Test card info */}
      <div className="text-xs text-gray-400 text-center">
        <p>Test card: 4242 4242 4242 4242</p>
        <p>Use any future date and CVC</p>
      </div>
    </form>
  );
}

// Wrapper component with Elements provider
function StripePaymentForm(props: any) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="space-y-4">
        <div className="p-4 bg-gray-800 rounded-lg border border-gray-600 animate-pulse">
          <div className="h-10 bg-gray-700 rounded"></div>
        </div>
        <div className="h-12 bg-gray-700 rounded animate-pulse"></div>
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise}>
      <StripeFormInner {...props} />
    </Elements>
  );
}

// Export with no SSR
export default dynamic(() => Promise.resolve(StripePaymentForm), {
  ssr: false,
  loading: () => (
    <div className="space-y-4">
      <div className="p-4 bg-gray-800 rounded-lg border border-gray-600 animate-pulse">
        <div className="h-10 bg-gray-700 rounded"></div>
      </div>
      <div className="h-12 bg-gray-700 rounded animate-pulse"></div>
    </div>
  ),
});

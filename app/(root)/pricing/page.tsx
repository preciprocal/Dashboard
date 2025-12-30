"use client";

import { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
  PaymentRequestButtonElement,
} from "@stripe/react-stripe-js";
import type { PaymentRequest } from "@stripe/stripe-js";

const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
);

// ============ INTERFACES ============

interface UserSubscription {
  plan: "free" | "starter" | "pro";
  status: "active" | "trial" | "expired" | "canceled";
  trialEndsAt?: string;
  subscriptionEndsAt?: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  interviewsUsed: number;
  interviewsLimit: number;
  createdAt: string;
  updatedAt?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  canceledAt?: string;
  lastPaymentAt?: string;
}

interface User {
  id: string;
  name: string;
  email: string;
  subscription: UserSubscription;
}

interface PricingPlan {
  id: string;
  name: string;
  price: number;
  period: string;
  description: string;
  features: string[];
  popular?: boolean;
  stripePriceId: string;
  interviewLimit: number;
}

interface PromoCode {
  code: string;
  discountPercent: number;
  valid: boolean;
  stripeCouponId?: string;
  university?: string;
}

const pricingPlans: PricingPlan[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    period: "month",
    description: "Perfect for getting started",
    features: [
      "1 AI professional interview",
      "Unlimited resume ATS scoring",
      "Unlimited resume optimization",
      "Unlimited cover letter generation",
      "Unlimited interview prep plans",
      "Basic analytics",
    ],
    stripePriceId: "price_free",
    interviewLimit: 1,
  },
  {
    id: "starter",
    name: "Starter",
    price: 25,
    period: "month",
    description: "Best for active job seekers",
    features: [
      "5 AI professional interviews",
      "Everything in Free",
      "Interview recordings & transcripts",
      "Progress tracking dashboard",
      "Unused interviews rollover (1 month)",
      "Email support",
    ],
    popular: true,
    stripePriceId: "price_1RfPo9QSkS83MGF9RMqz523j",
    interviewLimit: 5,
  },
  {
    id: "pro",
    name: "Pro",
    price: 49,
    period: "month",
    description: "For serious professionals",
    features: [
      "12 AI professional interviews",
      "Everything in Starter",
      "Company-specific interview prep (FAANG, etc.)",
      "Advanced analytics & insights",
      "Performance improvement recommendations",
      "Unused interviews rollover (1 month)",
      "Priority support",
    ],
    stripePriceId: "price_1RfPoqQSkS83MGF9ONnCVRl7",
    interviewLimit: 12,
  },
];

// ============ PROMO CODE INPUT COMPONENT ============

function PromoCodeInput({
  onApply,
  appliedPromo,
  isLoading,
}: {
  onApply: (code: string) => Promise<void>;
  appliedPromo: PromoCode | null;
  isLoading: boolean;
}) {
  const [code, setCode] = useState("");
  const [localLoading, setLocalLoading] = useState(false);

  const handleApply = async () => {
    if (!code.trim()) return;
    setLocalLoading(true);
    try {
      await onApply(code.trim().toUpperCase());
    } finally {
      setLocalLoading(false);
    }
  };

  const handleRemove = () => {
    setCode("");
    onApply("");
  };

  return (
    <div className="space-y-2">
      <label className="text-xs sm:text-sm font-medium text-gray-700 dark:text-slate-300">
        Promo Code
      </label>
      {appliedPromo && appliedPromo.valid ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between p-2.5 sm:p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-center space-x-2 min-w-0 flex-1">
              <svg className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 dark:text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="min-w-0">
                <span className="text-green-700 dark:text-green-300 font-medium block text-xs sm:text-sm truncate">
                  {appliedPromo.code} ({appliedPromo.discountPercent}% off)
                </span>
                {appliedPromo.university && (
                  <span className="text-green-600 dark:text-green-400 text-xs truncate block">
                    {appliedPromo.university}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={handleRemove}
              className="text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200 text-xs sm:text-sm font-medium cursor-pointer flex-shrink-0 ml-2"
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <div className="flex space-x-2">
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Enter code"
            disabled={isLoading || localLoading}
            className="flex-1 px-3 sm:px-4 py-2 bg-white dark:bg-white/5 border border-gray-300 dark:border-white/10 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500 disabled:opacity-50 text-xs sm:text-sm"
            onKeyPress={(e) => e.key === "Enter" && handleApply()}
          />
          <button
            onClick={handleApply}
            disabled={!code.trim() || isLoading || localLoading}
            className="px-4 sm:px-6 py-2 bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 text-gray-900 dark:text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-xs sm:text-sm"
          >
            {localLoading ? "..." : "Apply"}
          </button>
        </div>
      )}
    </div>
  );
}

// ============ PAYMENT REQUEST BUTTON COMPONENT ============

function PaymentRequestButton({
  planId,
  billingCycle,
  user,
  promoCode,
  onSuccess,
  onError,
}: {
  planId: string;
  billingCycle: "monthly" | "yearly";
  user: User;
  promoCode: PromoCode | null;
  onSuccess: () => void;
  onError: (error: string) => void;
}) {
  const stripe = useStripe();
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);
  const [canMakePayment, setCanMakePayment] = useState(false);

  const plan = pricingPlans.find((p) => p.id === planId);
  let finalPrice =
    billingCycle === "yearly"
      ? Math.round((plan?.price || 0) * 12 * 0.8)
      : plan?.price || 0;

  if (promoCode && promoCode.valid) {
    finalPrice = Math.round(finalPrice * (1 - promoCode.discountPercent / 100));
  }

  useEffect(() => {
    if (!stripe || !plan) return;

    const pr = stripe.paymentRequest({
      country: "US",
      currency: "usd",
      total: {
        label: `${plan.name} - ${billingCycle}`,
        amount: finalPrice * 100,
      },
      requestPayerName: true,
      requestPayerEmail: true,
    });

    pr.canMakePayment().then((result) => {
      if (result) {
        setCanMakePayment(true);
        setPaymentRequest(pr);
      }
    });

    pr.on("paymentmethod", async (ev) => {
      try {
        const response = await fetch("/api/subscription/create-subscription", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            priceId: plan.stripePriceId,
            customerId: user.subscription.stripeCustomerId,
            customerEmail: user.email,
            customerName: user.name,
            billingCycle,
            userId: user.id,
            paymentMethodId: ev.paymentMethod.id,
            promoCode: promoCode?.valid ? promoCode.code : undefined,
            couponId: promoCode?.stripeCouponId,
          }),
        });

        if (!response.ok) throw new Error("Failed to create subscription");
        const { clientSecret, error: apiError } = await response.json();
        if (apiError) throw new Error(apiError);

        const { error: stripeError } = await stripe.confirmCardPayment(
          clientSecret,
          { payment_method: ev.paymentMethod.id }
        );

        if (stripeError) {
          ev.complete("fail");
          throw new Error(stripeError.message);
        }

        ev.complete("success");
        onSuccess();
      } catch (err) {
        ev.complete("fail");
        onError(err instanceof Error ? err.message : "Payment failed");
      }
    });
  }, [stripe, plan, finalPrice, billingCycle, user, promoCode, onSuccess, onError]);

  if (!canMakePayment || !paymentRequest) return null;

  return (
    <div className="mb-4 sm:mb-6">
      <PaymentRequestButtonElement
        options={{
          paymentRequest,
          style: {
            paymentRequestButton: {
              theme: "dark",
              height: "48px",
              type: "default",
            },
          },
        }}
      />
      <div className="relative my-4 sm:my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200 dark:border-white/10"></div>
        </div>
        <div className="relative flex justify-center text-xs sm:text-sm">
          <span className="px-4 bg-white dark:bg-slate-950 text-gray-600 dark:text-slate-400">
            Or pay with card
          </span>
        </div>
      </div>
    </div>
  );
}

// ============ CHECKOUT FORM COMPONENT ============

function StripeCheckoutForm({
  planId,
  billingCycle,
  user,
  promoCode,
  onSuccess,
  onError,
}: {
  planId: string;
  billingCycle: "monthly" | "yearly";
  user: User;
  promoCode: PromoCode | null;
  onSuccess: () => void;
  onError: (errorMsg: string) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const plan = pricingPlans.find((p) => p.id === planId);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!stripe || !elements || !plan) return;

    setLoading(true);
    try {
      const response = await fetch("/api/subscription/create-subscription", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceId: plan.stripePriceId,
          customerId: user.subscription.stripeCustomerId,
          customerEmail: user.email,
          customerName: user.name,
          billingCycle,
          userId: user.id,
          promoCode: promoCode?.valid ? promoCode.code : undefined,
          couponId: promoCode?.stripeCouponId,
        }),
      });

      if (!response.ok) throw new Error("Failed to create subscription");
      const { clientSecret, error: apiError } = await response.json();
      if (apiError) throw new Error(apiError);

      const cardElement = elements.getElement(CardElement);
      if (!cardElement) throw new Error("Card element not found");

      const { error: stripeError } = await stripe.confirmCardPayment(
        clientSecret,
        {
          payment_method: {
            card: cardElement,
            billing_details: { name: user.name, email: user.email },
          },
        }
      );

      if (stripeError) throw new Error(stripeError.message);
      onSuccess();
    } catch (error) {
      const errorInstance = error instanceof Error ? error : new Error("Payment failed");
      onError(errorInstance.message);
    } finally {
      setLoading(false);
    }
  };

  const handlePayPalClick = () => {
    alert("PayPal payment coming soon! Currently accepting credit/debit cards.");
  };

  let displayPrice = plan?.price || 0;
  if (promoCode && promoCode.valid) {
    displayPrice = Math.round(displayPrice * (1 - promoCode.discountPercent / 100));
  }

  return (
    <div>
      <PaymentRequestButton
        planId={planId}
        billingCycle={billingCycle}
        user={user}
        promoCode={promoCode}
        onSuccess={onSuccess}
        onError={onError}
      />

      <div className="space-y-3 sm:space-y-4">
        <div className="p-3 sm:p-4 bg-gray-100 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/10">
          <CardElement
            options={{
              style: {
                base: {
                  fontSize: "16px",
                  color: "#171717",
                  "::placeholder": { color: "#94a3b8" },
                },
              },
            }}
          />
        </div>

        <button
          onClick={handleSubmit}
          disabled={!stripe || loading}
          className="w-full py-2.5 sm:py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-sm sm:text-base"
        >
          {loading ? (
            <div className="flex items-center justify-center space-x-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              <span>Processing...</span>
            </div>
          ) : (
            `Subscribe - $${displayPrice}/${billingCycle === "yearly" ? "year" : "month"}`
          )}
        </button>

        {/* Divider */}
        <div className="relative my-4 sm:my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-200 dark:border-white/10"></div>
          </div>
          <div className="relative flex justify-center text-xs sm:text-sm">
            <span className="px-4 bg-white dark:bg-slate-950 text-gray-600 dark:text-slate-400">
              Or pay with
            </span>
          </div>
        </div>

        {/* PayPal Button */}
        <button
          onClick={handlePayPalClick}
          className="w-full py-2.5 sm:py-3 bg-[#0070ba] hover:bg-[#005ea6] text-white font-medium rounded-lg transition-all cursor-pointer flex items-center justify-center space-x-2 text-sm sm:text-base"
        >
          <svg className="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M8.32 21.97a.546.546 0 01-.26-.32c-.03-.15-.01-.3.06-.44l2.12-6.43H6.48L8.05 9.2a.51.51 0 01.5-.39h6.19c2.39 0 3.94.48 4.91 1.52.82.87 1.14 2.07 1.01 3.79-.18 2.39-1.18 4.09-3.04 5.2-1.19.71-2.87 1.07-5.01 1.07h-1.59c-.21 0-.41.13-.48.33l-.44 1.33a.55.55 0 01-.52.39h-1.26z"/>
            <path d="M9.07 7.04c.18-1.15.96-2.04 2.37-2.04h5.59c.72 0 1.34.1 1.86.3.52.19.94.48 1.27.85.66.73.92 1.73.79 3.06-.18 1.87-.99 3.23-2.43 4.06-1.02.58-2.42.89-4.17.89h-1.11c-.21 0-.4.13-.47.33l-.63 1.91c-.03.09-.09.18-.17.23-.08.06-.18.09-.28.09H9.91c-.17 0-.32-.11-.38-.28-.06-.16-.03-.34.07-.47l2.13-6.41z"/>
          </svg>
          <span>PayPal (Coming Soon)</span>
        </button>
      </div>
    </div>
  );
}

// ============ GET USER DATA FUNCTION ============

const getUserData = async (): Promise<User | null> => {
  try {
    const response = await fetch("/api/user/profile", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      if (response.status === 401) return null;
      throw new Error("Failed to fetch user data");
    }

    return await response.json();
  } catch {
    return null;
  }
};

// ============ MAIN SUBSCRIPTION PAGE COMPONENT ============

export default function SubscriptionPage() {
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [isLoading, setIsLoading] = useState(true);
  const [showCheckout, setShowCheckout] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [promoCode, setPromoCode] = useState<PromoCode | null>(null);
  const [promoError, setPromoError] = useState<string>("");

  useEffect(() => {
    const loadUserData = async () => {
      setIsLoading(true);
      try {
        const userData = await getUserData();
        if (userData) setUser(userData);
      } catch (error) {
        console.error("Failed to load user data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadUserData();
  }, []);

  const handleApplyPromo = async (code: string) => {
    setPromoError("");
    
    if (!code) {
      setPromoCode(null);
      return;
    }

    try {
      const response = await fetch("/api/subscription/validate-promo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      const data = await response.json();

      if (!response.ok || !data.valid) {
        setPromoError(data.error || "Invalid promo code");
        setPromoCode({ code, discountPercent: 0, valid: false });
        return;
      }

      setPromoCode({
        code: data.code,
        discountPercent: data.discountPercent,
        valid: true,
        stripeCouponId: data.stripeCouponId,
        university: data.university,
      });
    } catch (error) {
      console.error("Promo validation error:", error);
      setPromoError("Failed to validate promo code");
      setPromoCode({ code, discountPercent: 0, valid: false });
    }
  };

  const handlePlanSelect = async (planId: string) => {
    if (!user) {
      alert("Please log in to select a plan");
      return;
    }

    if (planId === "free") {
      if (user.subscription.plan === "free") {
        alert("You're already on the free plan!");
        return;
      }
      return;
    }

    if (planId === user.subscription.plan) {
      alert(`You're already on the ${planId} plan!`);
      return;
    }

    setSelectedPlan(planId);
    setShowCheckout(true);
  };

  const handlePaymentSuccess = async () => {
    if (!selectedPlan || !user) return;
    alert("Successfully subscribed! 🎉");
    
    try {
      const refreshResponse = await fetch("/api/user/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (refreshResponse.ok) {
        const refreshData = await refreshResponse.json();
        if (refreshData.user) setUser(refreshData.user);
        setTimeout(() => {
          window.location.href = "/subscription?success=true";
        }, 2000);
      } else {
        setTimeout(() => window.location.reload(), 2000);
      }
    } catch (error) {
      console.error("Refresh error:", error);
      setTimeout(() => window.location.reload(), 2000);
    }

    setShowCheckout(false);
    setSelectedPlan(null);
    setPromoCode(null);
  };

  const handlePaymentError = (errorMsg: string) => {
    alert(`Payment failed: ${errorMsg}`);
  };

  const handleManageBilling = async () => {
    if (!user?.subscription.stripeCustomerId) {
      alert("No billing information found");
      return;
    }

    try {
      const response = await fetch("/api/subscription/create-portal-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: user.subscription.stripeCustomerId,
          returnUrl: window.location.href,
        }),
      });

      if (!response.ok) throw new Error("Failed to create portal session");
      const { url } = await response.json();
      if (url) window.location.href = url;
      else throw new Error("No portal URL returned");
    } catch (error) {
      console.error("Portal session error:", error);
      alert("Failed to open billing portal");
    }
  };

  const getYearlyPrice = (monthlyPrice: number) => {
    return Math.round(monthlyPrice * 12 * 0.8);
  };

  const calculateFinalPrice = (basePrice: number) => {
    if (!promoCode || !promoCode.valid) return basePrice;
    return Math.round(basePrice * (1 - promoCode.discountPercent / 100));
  };

  const getButtonText = (plan: PricingPlan) => {
    if (!user) return "Get Started";

    if (user.subscription.plan === plan.id) {
      return user.subscription.status === "trial" ? "Current Trial" : "Current Plan";
    }

    if (plan.id === "free") return "Downgrade";
    if (user.subscription.plan === "free") return "Upgrade";
    
    return "Select Plan";
  };

  // ============ LOADING STATE ============
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center px-4" style={{ height: 'calc(100vh - 73px - 3rem)' }}>
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-300 dark:border-white/30 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-gray-900 dark:text-white text-sm sm:text-base">Loading...</div>
        </div>
      </div>
    );
  }

  // ============ NOT AUTHENTICATED STATE ============
  
  if (!user) {
    return (
      <div className="flex items-center justify-center px-4" style={{ height: 'calc(100vh - 73px - 3rem)' }}>
        <div className="text-center max-w-md mx-auto p-4 sm:p-6">
          <div className="text-gray-900 dark:text-white text-lg sm:text-xl mb-3 sm:mb-4">Please Log In</div>
          <div className="text-gray-600 dark:text-slate-400 mb-4 sm:mb-6 text-sm sm:text-base">
            You need to be logged in to view pricing.
          </div>
          <button
            onClick={() => (window.location.href = "/auth/signin")}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-5 sm:px-6 py-2.5 sm:py-3 rounded-lg transition-all cursor-pointer text-sm sm:text-base"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // ============ CHECKOUT VIEW ============
  
  if (showCheckout && selectedPlan) {
    const plan = pricingPlans.find((p) => p.id === selectedPlan);
    const basePrice =
      billingCycle === "yearly" ? getYearlyPrice(plan?.price || 0) : plan?.price || 0;
    const finalPrice = calculateFinalPrice(basePrice);
    const discount = basePrice - finalPrice;

    return (
      <div className="px-4 sm:px-0">
        <div className="max-w-4xl mx-auto">
          {/* Header - Responsive */}
          <div className="flex flex-col xs:flex-row items-start xs:items-center justify-between mb-4 sm:mb-6 gap-3">
            <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">
              Complete Your Subscription
            </h1>
            <button
              onClick={() => {
                setShowCheckout(false);
                setPromoCode(null);
                setPromoError("");
              }}
              className="text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors cursor-pointer text-sm sm:text-base"
            >
              ← Back
            </button>
          </div>

          <div className="grid lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Order Summary - Responsive */}
            <div className="bg-gray-50 dark:bg-white/5 backdrop-blur-xl rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-gray-200 dark:border-white/10 h-fit">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">
                Order Summary
              </h3>

              <div className="space-y-3 sm:space-y-4 mb-4 sm:mb-6">
                <div className="flex justify-between items-center">
                  <span className="text-gray-700 dark:text-slate-300 text-sm sm:text-base">{plan?.name}</span>
                  <span className="text-gray-900 dark:text-white font-medium text-sm sm:text-base">
                    ${basePrice}
                    /{billingCycle === "yearly" ? "year" : "month"}
                  </span>
                </div>

                {billingCycle === "yearly" && (
                  <div className="flex justify-between items-center text-green-600 dark:text-green-400 text-xs sm:text-sm">
                    <span>Annual discount (20% off)</span>
                    <span>-${Math.round((plan?.price || 0) * 12 * 0.2)}/year</span>
                  </div>
                )}

                {promoCode && promoCode.valid && discount > 0 && (
                  <div className="flex justify-between items-center text-purple-600 dark:text-purple-400 text-xs sm:text-sm">
                    <span>Promo code ({promoCode.discountPercent}% off)</span>
                    <span>-${discount}</span>
                  </div>
                )}

                <div className="border-t border-gray-200 dark:border-white/10 pt-3 sm:pt-4">
                  <div className="flex justify-between items-center text-base sm:text-lg font-semibold">
                    <span className="text-gray-900 dark:text-white">Total</span>
                    <span className="text-gray-900 dark:text-white">
                      ${finalPrice}/{billingCycle === "yearly" ? "year" : "month"}
                    </span>
                  </div>
                </div>
              </div>

              {/* Promo Code Input */}
              <div className="mb-4 sm:mb-6">
                <PromoCodeInput
                  onApply={handleApplyPromo}
                  appliedPromo={promoCode}
                  isLoading={false}
                />
                {promoError && (
                  <p className="text-red-600 dark:text-red-400 text-xs sm:text-sm mt-2">{promoError}</p>
                )}
              </div>

              {/* Billing Cycle Toggle */}
              <div className="mb-4 sm:mb-6">
                <div className="flex items-center space-x-2 bg-gray-100 dark:bg-white/5 rounded-lg p-1">
                  <button
                    onClick={() => setBillingCycle("monthly")}
                    className={`flex-1 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md font-medium transition-all cursor-pointer text-xs sm:text-sm ${
                      billingCycle === "monthly"
                        ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white"
                        : "text-gray-700 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                    }`}
                  >
                    Monthly
                  </button>
                  <button
                    onClick={() => setBillingCycle("yearly")}
                    className={`flex-1 px-3 sm:px-4 py-1.5 sm:py-2 rounded-md font-medium transition-all relative cursor-pointer text-xs sm:text-sm ${
                      billingCycle === "yearly"
                        ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white"
                        : "text-gray-700 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                    }`}
                  >
                    Yearly
                    {billingCycle !== "yearly" && (
                      <span className="absolute -top-1 -right-1 bg-green-500 text-xs px-1.5 py-0.5 rounded-full text-white">
                        20%
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* Features */}
              <div>
                <h4 className="text-gray-900 dark:text-white font-medium mb-2 sm:mb-3 text-sm sm:text-base">
                  What&apos;s included:
                </h4>
                <ul className="space-y-1.5 sm:space-y-2">
                  {plan?.features.map((feature, index) => (
                    <li key={index} className="flex items-start text-gray-700 dark:text-slate-300 text-xs sm:text-sm">
                      <span className="w-1.5 h-1.5 bg-green-400 rounded-full mr-2 sm:mr-3 mt-1.5 flex-shrink-0"></span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Payment Form - Responsive */}
            <div className="bg-gray-50 dark:bg-white/5 backdrop-blur-xl rounded-xl sm:rounded-2xl p-4 sm:p-6 border border-gray-200 dark:border-white/10">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-4 sm:mb-6">
                Payment Details
              </h3>
              <Elements stripe={stripePromise}>
                <StripeCheckoutForm
                  planId={selectedPlan}
                  billingCycle={billingCycle}
                  user={user}
                  promoCode={promoCode}
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                />
              </Elements>

              <div className="mt-3 sm:mt-4 flex items-center justify-center space-x-2 text-gray-600 dark:text-slate-400 text-xs">
                <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
                <span>Secured by Stripe • 256-bit SSL encryption</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============ MAIN PRICING VIEW - Responsive ============
  
  return (
    <div className="flex flex-col justify-center px-4 sm:px-0 py-8 sm:py-0" style={{ minHeight: 'calc(100vh - 73px - 3rem)' }}>
      <div className="text-center mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2">
          Choose Your Plan
        </h1>
        <p className="text-sm sm:text-base md:text-lg text-gray-600 dark:text-slate-400">
          Start free, upgrade anytime. All plans include unlimited resume tools.
        </p>
      </div>

      {/* Current Plan Badge */}
      {user.subscription.plan !== "free" && (
        <div className="flex justify-center mb-4 sm:mb-6">
          <div className="inline-flex items-center px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-full text-gray-700 dark:text-slate-300 text-xs sm:text-sm backdrop-blur-xl">
            <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-400 rounded-full mr-2"></span>
            Current Plan: {user.subscription.plan.charAt(0).toUpperCase() + user.subscription.plan.slice(1)}
          </div>
        </div>
      )}

      {/* Pricing Cards - Responsive */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 max-w-6xl mx-auto mb-4 sm:mb-6">
        {pricingPlans.map((plan) => {
          const isCurrentPlan = user.subscription.plan === plan.id;

          return (
            <div
              key={plan.id}
              className={`relative bg-gray-50 dark:bg-white/5 backdrop-blur-xl rounded-xl sm:rounded-2xl p-5 sm:p-6 md:p-8 border transition-all hover:bg-gray-100 dark:hover:bg-white/10 ${
                plan.popular
                  ? "border-purple-500/50 md:scale-105"
                  : isCurrentPlan
                  ? "border-blue-500/50"
                  : "border-gray-200 dark:border-white/10"
              }`}
            >
              {plan.popular && (
                <div className="absolute -top-3 sm:-top-4 left-1/2 transform -translate-x-1/2">
                  <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-3 sm:px-4 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm font-medium">
                    Most Popular
                  </div>
                </div>
              )}

              <div className="text-center">
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-1 sm:mb-2">
                  {plan.name}
                </h3>
                <div className="text-3xl sm:text-4xl font-bold mb-1 sm:mb-2">
                  <span className="text-gray-900 dark:text-white">${plan.price}</span>
                  <span className="text-gray-600 dark:text-slate-400 text-base sm:text-lg">/{plan.period}</span>
                </div>
                <p className="text-gray-600 dark:text-slate-400 mb-4 sm:mb-6 text-sm sm:text-base">{plan.description}</p>

                <ul className="space-y-2 sm:space-y-3 mb-6 sm:mb-8 text-left">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start text-gray-700 dark:text-slate-300 text-xs sm:text-sm">
                      <span className="w-1.5 h-1.5 bg-green-400 rounded-full mr-2 sm:mr-3 mt-1.5 flex-shrink-0"></span>
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handlePlanSelect(plan.id)}
                  disabled={isCurrentPlan && user.subscription.status !== "trial"}
                  className={`w-full py-2.5 sm:py-3 rounded-lg font-medium transition-all cursor-pointer text-sm sm:text-base ${
                    isCurrentPlan && user.subscription.status !== "trial"
                      ? "bg-gray-200 dark:bg-white/10 text-gray-500 dark:text-slate-400 cursor-not-allowed"
                      : plan.popular
                      ? "bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
                      : "bg-gray-200 dark:bg-white/10 hover:bg-gray-300 dark:hover:bg-white/20 text-gray-900 dark:text-white"
                  }`}
                >
                  {getButtonText(plan)}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Manage Billing - Responsive */}
      {user.subscription.plan !== "free" && user.subscription.stripeCustomerId && (
        <div className="text-center">
          <button
            onClick={handleManageBilling}
            className="bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-900 dark:text-white px-5 sm:px-6 py-2.5 sm:py-3 rounded-lg border border-gray-200 dark:border-white/10 transition-all backdrop-blur-xl cursor-pointer text-sm sm:text-base"
          >
            Manage Billing
          </button>
        </div>
      )}
    </div>
  );
}
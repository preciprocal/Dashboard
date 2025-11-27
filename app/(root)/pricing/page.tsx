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
  plan: "starter" | "pro" | "premium";
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
}

const pricingPlans: PricingPlan[] = [
  {
    id: "starter",
    name: "Starter",
    price: 0,
    period: "month",
    description: "Perfect for getting started",
    features: [
      "10 AI interview sessions/month",
      "Basic feedback & scoring",
      "Common questions library",
      "Email support",
    ],
    stripePriceId: "price_1RfPo9QSkS83MGF9RMqz523j",
  },
  {
    id: "pro",
    name: "Pro",
    price: 19,
    period: "month",
    description: "Best for serious job seekers",
    features: [
      "Unlimited AI interviews",
      "Advanced AI feedback & analysis",
      "Video recording & playback",
      "Company-specific prep",
      "Progress analytics",
      "Priority support",
    ],
    popular: true,
    stripePriceId: "price_1RfPoqQSkS83MGF9ONnCVRl7",
  },
  {
    id: "premium",
    name: "Premium",
    price: 39,
    period: "month",
    description: "For professionals seeking excellence",
    features: [
      "Everything in Pro",
      "Expert human feedback",
      "Resume optimization",
      "Salary negotiation training",
      "Career coaching resources",
      "Live chat support",
    ],
    stripePriceId: "price_1RfPpSQSkS83MGF9Gdp0CEBt",
  },
];

// ============ PAYMENT REQUEST BUTTON COMPONENT ============

function PaymentRequestButton({
  planId,
  billingCycle,
  user,
  onSuccess,
  onError,
}: {
  planId: string;
  billingCycle: "monthly" | "yearly";
  user: User;
  onSuccess: () => void;
  onError: (error: string) => void;
}) {
  const stripe = useStripe();
  const [paymentRequest, setPaymentRequest] = useState<PaymentRequest | null>(null);
  const [canMakePayment, setCanMakePayment] = useState(false);

  const plan = pricingPlans.find((p) => p.id === planId);
  const finalPrice =
    billingCycle === "yearly"
      ? Math.floor((plan?.price || 0) * 12 * 0.8)
      : plan?.price || 0;

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
  }, [stripe, plan, finalPrice, billingCycle, user, onSuccess, onError]);

  if (!canMakePayment || !paymentRequest) return null;

  return (
    <div className="mb-6">
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
      <div className="relative my-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-gray-200 dark:border-white/10"></div>
        </div>
        <div className="relative flex justify-center text-sm">
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
  onSuccess,
  onError,
}: {
  planId: string;
  billingCycle: "monthly" | "yearly";
  user: User;
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
    } catch (err) {
      onError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PaymentRequestButton
        planId={planId}
        billingCycle={billingCycle}
        user={user}
        onSuccess={onSuccess}
        onError={onError}
      />

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="p-4 bg-gray-100 dark:bg-white/5 rounded-lg border border-gray-200 dark:border-white/10">
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
          type="submit"
          disabled={!stripe || loading}
          className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-medium rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? (
            <div className="flex items-center justify-center space-x-2">
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              <span>Processing...</span>
            </div>
          ) : (
            `Subscribe - $${plan?.price}/${billingCycle === "yearly" ? "year" : "month"}`
          )}
        </button>
      </form>
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
  } catch (err) {
    console.error("Error fetching user data:", err);
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

  useEffect(() => {
    const loadUserData = async () => {
      setIsLoading(true);
      try {
        const userData = await getUserData();
        if (userData) setUser(userData);
      } catch (err) {
        console.error("Failed to load user data:", err);
      } finally {
        setIsLoading(false);
      }
    };

    loadUserData();
  }, []);

  const handlePlanSelect = async (planId: string) => {
    if (!user) {
      alert("Please log in to select a plan");
      return;
    }

    if (planId === "starter") {
      if (user.subscription.plan === "starter") {
        alert("You're already on the free plan!");
        return;
      }
      // Handle downgrade logic here
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
    } catch (err) {
      setTimeout(() => window.location.reload(), 2000);
    }

    setShowCheckout(false);
    setSelectedPlan(null);
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
    } catch (err) {
      alert("Failed to open billing portal");
    }
  };

  const getYearlyPrice = (monthlyPrice: number) => {
    return Math.floor(monthlyPrice * 12 * 0.8);
  };

  const getButtonText = (plan: PricingPlan) => {
    if (!user) return "Get Started";

    if (user.subscription.plan === plan.id) {
      return user.subscription.status === "trial" ? "Current Trial" : "Current Plan";
    }

    if (plan.id === "starter") return "Downgrade";
    if (user.subscription.plan === "starter") return "Upgrade";
    
    return "Select Plan";
  };

  // ============ LOADING STATE ============
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-gray-300 dark:border-white/30 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
          <div className="text-gray-900 dark:text-white">Loading...</div>
        </div>
      </div>
    );
  }

  // ============ NOT AUTHENTICATED STATE ============
  
  if (!user) {
    return (
      <div className="min-h-screen bg-white dark:bg-slate-950 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-gray-900 dark:text-white text-xl mb-4">Please Log In</div>
          <div className="text-gray-600 dark:text-slate-400 mb-6">
            You need to be logged in to view pricing.
          </div>
          <button
            onClick={() => (window.location.href = "/auth/signin")}
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-6 py-3 rounded-lg transition-all"
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
    const finalPrice =
      billingCycle === "yearly" ? getYearlyPrice(plan?.price || 0) : plan?.price || 0;

    return (
      <div className="min-h-screen bg-white dark:bg-slate-950">
        <div className="container mx-auto px-6 py-8">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
              <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                Complete Your Subscription
              </h1>
              <button
                onClick={() => setShowCheckout(false)}
                className="text-gray-600 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                ← Back
              </button>
            </div>

            <div className="grid lg:grid-cols-2 gap-8">
              {/* Order Summary */}
              <div className="bg-gray-50 dark:bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-gray-200 dark:border-white/10 h-fit">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Order Summary
                </h3>

                <div className="space-y-4 mb-6">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-700 dark:text-slate-300">{plan?.name}</span>
                    <span className="text-gray-900 dark:text-white font-medium">
                      ${billingCycle === "yearly" ? getYearlyPrice(plan?.price || 0) : plan?.price}
                      /{billingCycle === "yearly" ? "year" : "month"}
                    </span>
                  </div>

                  {billingCycle === "yearly" && (
                    <div className="flex justify-between items-center text-green-600 dark:text-green-400 text-sm">
                      <span>Annual discount (20% off)</span>
                      <span>-${(plan?.price || 0) * 12 * 0.2}/year</span>
                    </div>
                  )}

                  <div className="border-t border-gray-200 dark:border-white/10 pt-4">
                    <div className="flex justify-between items-center text-lg font-semibold">
                      <span className="text-gray-900 dark:text-white">Total</span>
                      <span className="text-gray-900 dark:text-white">
                        ${finalPrice}/{billingCycle === "yearly" ? "year" : "month"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Billing Cycle Toggle */}
                <div className="mb-6">
                  <div className="flex items-center space-x-2 bg-gray-100 dark:bg-white/5 rounded-lg p-1">
                    <button
                      onClick={() => setBillingCycle("monthly")}
                      className={`flex-1 px-4 py-2 rounded-md font-medium transition-all ${
                        billingCycle === "monthly"
                          ? "bg-gradient-to-r from-purple-600 to-blue-600 text-white"
                          : "text-gray-700 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
                      }`}
                    >
                      Monthly
                    </button>
                    <button
                      onClick={() => setBillingCycle("yearly")}
                      className={`flex-1 px-4 py-2 rounded-md font-medium transition-all relative ${
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
                  <h4 className="text-gray-900 dark:text-white font-medium mb-3">
                    What&apos;s included:
                  </h4>
                  <ul className="space-y-2">
                    {plan?.features.map((feature, index) => (
                      <li key={index} className="flex items-start text-gray-700 dark:text-slate-300 text-sm">
                        <span className="w-1.5 h-1.5 bg-green-400 rounded-full mr-3 mt-1.5 flex-shrink-0"></span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Payment Form */}
              <div className="bg-gray-50 dark:bg-white/5 backdrop-blur-xl rounded-2xl p-6 border border-gray-200 dark:border-white/10">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                  Payment Details
                </h3>
                <Elements stripe={stripePromise}>
                  <StripeCheckoutForm
                    planId={selectedPlan}
                    billingCycle={billingCycle}
                    user={user}
                    onSuccess={handlePaymentSuccess}
                    onError={handlePaymentError}
                  />
                </Elements>

                <div className="mt-4 flex items-center justify-center space-x-2 text-gray-600 dark:text-slate-400 text-xs">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                  </svg>
                  <span>Secured by Stripe • 256-bit SSL encryption</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============ MAIN PRICING VIEW ============
  
  return (
    <div className="min-h-screen bg-white dark:bg-slate-950">
      {/* Hero Section */}
      <section className="py-20">
        <div className="container mx-auto px-6 text-center">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">
            Choose Your Plan
          </h1>
          <p className="text-xl text-gray-600 dark:text-slate-400 max-w-2xl mx-auto mb-12">
            Simple, transparent pricing. Start free, upgrade anytime.
          </p>

          {/* Current Plan Badge */}
          {user.subscription.plan !== "starter" && (
            <div className="inline-flex items-center px-4 py-2 bg-gray-100 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-full text-gray-700 dark:text-slate-300 text-sm mb-8 backdrop-blur-xl">
              <span className="w-2 h-2 bg-green-400 rounded-full mr-2"></span>
              Current Plan: {user.subscription.plan.charAt(0).toUpperCase() + user.subscription.plan.slice(1)}
            </div>
          )}

          {/* Pricing Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {pricingPlans.map((plan) => {
              const isCurrentPlan = user.subscription.plan === plan.id;

              return (
                <div
                  key={plan.id}
                  className={`relative bg-gray-50 dark:bg-white/5 backdrop-blur-xl rounded-2xl p-8 border transition-all hover:bg-gray-100 dark:hover:bg-white/10 ${
                    plan.popular
                      ? "border-purple-500/50 scale-105"
                      : isCurrentPlan
                      ? "border-blue-500/50"
                      : "border-gray-200 dark:border-white/10"
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                      <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-4 py-1 rounded-full text-sm font-medium">
                        Most Popular
                      </div>
                    </div>
                  )}

                  {isCurrentPlan && (
                    <div className="absolute -top-4 right-4">
                      <div className="bg-blue-500 text-white px-3 py-1 rounded-full text-xs font-medium">
                        Current
                      </div>
                    </div>
                  )}

                  <div className="text-center">
                    <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                      {plan.name}
                    </h3>
                    <div className="text-4xl font-bold mb-2">
                      <span className="text-gray-900 dark:text-white">${plan.price}</span>
                      <span className="text-gray-600 dark:text-slate-400 text-lg">/{plan.period}</span>
                    </div>
                    <p className="text-gray-600 dark:text-slate-400 mb-6">{plan.description}</p>

                    <ul className="space-y-3 mb-8 text-left">
                      {plan.features.map((feature, index) => (
                        <li key={index} className="flex items-start text-gray-700 dark:text-slate-300 text-sm">
                          <span className="w-1.5 h-1.5 bg-green-400 rounded-full mr-3 mt-1.5 flex-shrink-0"></span>
                          {feature}
                        </li>
                      ))}
                    </ul>

                    <button
                      onClick={() => handlePlanSelect(plan.id)}
                      disabled={isCurrentPlan && user.subscription.status !== "trial"}
                      className={`w-full py-3 rounded-lg font-medium transition-all ${
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

          {/* Manage Billing */}
          {user.subscription.plan !== "starter" && user.subscription.stripeCustomerId && (
            <div className="mt-12">
              <button
                onClick={handleManageBilling}
                className="bg-gray-100 dark:bg-white/5 hover:bg-gray-200 dark:hover:bg-white/10 text-gray-900 dark:text-white px-6 py-3 rounded-lg border border-gray-200 dark:border-white/10 transition-all backdrop-blur-xl"
              >
                Manage Billing
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
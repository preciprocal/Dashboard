"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";

// Interfaces
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
  originalPrice: number;
  period: string;
  description: string;
  features: string[];
  buttonText: string;
  buttonStyle: string;
  popular?: boolean;
  color: string;
  stripePriceId: string;
}

const pricingPlans: PricingPlan[] = [
  {
    id: "starter",
    name: "Starter",
    price: 10,
    originalPrice: 15,
    period: "month",
    description: "Perfect for beginners",
    features: [
      "3 AI interviews/mo",
      "Basic feedback",
      "Email support",
    ],
    buttonText: "Current Plan",
    buttonStyle: "bg-slate-700 hover:bg-slate-600",
    color: "blue",
    stripePriceId: "price_starter",
  },
  {
    id: "pro",
    name: "Pro",
    price: 20,
    originalPrice: 30,
    period: "month",
    description: "For serious job seekers",
    features: [
      "7 AI interviews/mo",
      "Personalized tips",
      "Video playback",
      "Priority support",
    ],
    buttonText: "Start Pro",
    buttonStyle: "bg-gradient-to-r from-purple-600 via-pink-600 to-red-500 hover:from-purple-700 hover:via-pink-700 hover:to-red-600",
    popular: true,
    color: "purple",
    stripePriceId: "price_pro",
  },
  {
    id: "premium",
    name: "Elite",
    price: 35,
    originalPrice: 50,
    period: "month",
    description: "Maximum preparation",
    features: [
      "15 AI interviews/mo",
      "Advanced reports",
      "Expert feedback",
      "Resume optimization",
    ],
    buttonText: "Go Elite",
    buttonStyle: "bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600",
    color: "yellow",
    stripePriceId: "price_elite",
  },
];

const SubscriptionPage = () => {
  const [user, setUser] = useState<User | null>({
    id: "1",
    name: "Yash Harale",
    email: "yashvharale@gmail.com",
    subscription: {
      plan: "starter",
      status: "active",
      interviewsUsed: 1,
      interviewsLimit: 10,
      createdAt: new Date().toISOString(),
    },
  });

  const handlePlanSelect = (planId: string) => {
    console.log("Selected plan:", planId);
    alert(`Selected ${planId} plan! This would open checkout.`);
  };

  const getCurrentPlanData = () => {
    if (!user) return null;
    return pricingPlans.find((plan) => plan.id === user.subscription.plan);
  };

  const getButtonText = (plan: PricingPlan) => {
    if (!user) return plan.buttonText;
    if (user.subscription.plan === plan.id) {
      return "Current Plan";
    }
    return plan.buttonText;
  };

  return (
    <div className="min-h-screen bg-[#0a0b0f] text-white">
      {/* Main Content Container */}
      <div className="max-w-7xl mx-auto px-8 py-12">
        {/* Header Section */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-emerald-400 text-sm font-medium mb-6">
            <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></span>
            <span className="text-emerald-500">💎</span>
            <span>Special Launch Pricing — Limited Time!</span>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Get the most realistic{" "}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-cyan-400">
              AI interview experience
            </span>
          </h1>

          <p className="text-slate-400 text-lg mb-6">
            At a fraction of the cost of traditional coaching — choose a plan that fits your goals
          </p>

          {user && (
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500/10 border border-blue-500/30 rounded-full text-blue-400 text-sm">
              <span>⭐</span>
              <span className="font-medium">Starter Plan • 9 interviews remaining</span>
            </div>
          )}
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {/* Starter Plan */}
          <div className="relative bg-[#1a1d29] border-2 border-cyan-500/50 rounded-2xl p-6 hover:border-cyan-400/70 transition-all duration-300">
            <div className="absolute -top-3 left-6">
              <span className="bg-cyan-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                Active
              </span>
            </div>
            
            <div className="text-center">
              <h3 className="text-2xl font-bold mb-2">Starter</h3>
              <div className="mb-4">
                <div className="text-slate-500 line-through text-sm">$15</div>
                <div>
                  <span className="text-5xl font-bold text-cyan-400">$10</span>
                  <span className="text-slate-400">/mo</span>
                </div>
              </div>
              <p className="text-slate-400 text-sm mb-6">Perfect for beginners</p>
              
              <ul className="space-y-3 mb-6 text-left">
                <li className="flex items-start gap-2 text-slate-300">
                  <span className="text-cyan-400 mt-1">•</span>
                  <span>3 AI interviews/mo</span>
                </li>
                <li className="flex items-start gap-2 text-slate-300">
                  <span className="text-cyan-400 mt-1">•</span>
                  <span>Basic feedback</span>
                </li>
                <li className="flex items-start gap-2 text-slate-300">
                  <span className="text-cyan-400 mt-1">•</span>
                  <span>Email support</span>
                </li>
              </ul>

              <button className="w-full bg-slate-700 text-slate-400 py-3 rounded-lg font-medium cursor-not-allowed">
                Current Plan
              </button>
            </div>
          </div>

          {/* Pro Plan - Most Popular */}
          <div className="relative bg-gradient-to-br from-purple-900/30 via-pink-900/30 to-red-900/30 border-2 border-purple-500 rounded-2xl p-6 transform scale-105 shadow-2xl shadow-purple-500/20 hover:scale-[1.07] transition-all duration-300">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2">
              <span className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold px-4 py-1 rounded-full">
                Most Popular
              </span>
            </div>
            
            <div className="text-center">
              <h3 className="text-2xl font-bold mb-2">Pro</h3>
              <div className="mb-4">
                <div className="text-slate-500 line-through text-sm">$30</div>
                <div>
                  <span className="text-5xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">$20</span>
                  <span className="text-slate-400">/mo</span>
                </div>
              </div>
              <p className="text-slate-300 text-sm mb-6">For serious job seekers</p>
              
              <ul className="space-y-3 mb-6 text-left">
                <li className="flex items-start gap-2 text-slate-200">
                  <span className="text-purple-400 mt-1">•</span>
                  <span>7 AI interviews/mo</span>
                </li>
                <li className="flex items-start gap-2 text-slate-200">
                  <span className="text-purple-400 mt-1">•</span>
                  <span>Personalized tips</span>
                </li>
                <li className="flex items-start gap-2 text-slate-200">
                  <span className="text-purple-400 mt-1">•</span>
                  <span>Video playback</span>
                </li>
                <li className="flex items-start gap-2 text-slate-200">
                  <span className="text-purple-400 mt-1">•</span>
                  <span>Priority support</span>
                </li>
              </ul>

              <button 
                onClick={() => handlePlanSelect('pro')}
                className="w-full bg-gradient-to-r from-purple-600 via-pink-600 to-red-500 hover:from-purple-700 hover:via-pink-700 hover:to-red-600 text-white py-3 rounded-lg font-bold transition-all duration-300 transform hover:scale-105"
              >
                Start Pro
              </button>
            </div>
          </div>

          {/* Elite Plan */}
          <div className="relative bg-[#1a1d29] border-2 border-slate-700 rounded-2xl p-6 hover:border-yellow-500/50 transition-all duration-300">
            <div className="text-center">
              <h3 className="text-2xl font-bold mb-2">Elite</h3>
              <div className="mb-4">
                <div className="text-slate-500 line-through text-sm">$50</div>
                <div>
                  <span className="text-5xl font-bold text-yellow-400">$35</span>
                  <span className="text-slate-400">/mo</span>
                </div>
              </div>
              <p className="text-slate-400 text-sm mb-6">Maximum preparation</p>
              
              <ul className="space-y-3 mb-6 text-left">
                <li className="flex items-start gap-2 text-slate-300">
                  <span className="text-yellow-400 mt-1">•</span>
                  <span>15 AI interviews/mo</span>
                </li>
                <li className="flex items-start gap-2 text-slate-300">
                  <span className="text-yellow-400 mt-1">•</span>
                  <span>Advanced reports</span>
                </li>
                <li className="flex items-start gap-2 text-slate-300">
                  <span className="text-yellow-400 mt-1">•</span>
                  <span>Expert feedback</span>
                </li>
                <li className="flex items-start gap-2 text-slate-300">
                  <span className="text-yellow-400 mt-1">•</span>
                  <span>Resume optimization</span>
                </li>
              </ul>

              <button 
                onClick={() => handlePlanSelect('premium')}
                className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white py-3 rounded-lg font-bold transition-all duration-300 transform hover:scale-105"
              >
                Go Elite
              </button>
            </div>
          </div>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-6 text-center backdrop-blur-sm">
            <div className="text-3xl font-bold text-blue-400 mb-2">1,000+</div>
            <div className="text-slate-400 text-sm">Users improved their skills</div>
          </div>
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-6 text-center backdrop-blur-sm">
            <div className="text-3xl font-bold text-emerald-400 mb-2">85%</div>
            <div className="text-slate-400 text-sm">Feel more confident</div>
          </div>
          <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl p-6 text-center backdrop-blur-sm">
            <div className="text-2xl font-bold text-orange-400 mb-2">⏰ Limited Time</div>
            <div className="text-slate-400 text-sm">Don't miss out on this offer!</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionPage;
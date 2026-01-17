"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Shield, Lock, Eye, CheckCircle2, AlertCircle } from "lucide-react";

export default function PrivacyPolicyPage() {
  const [activeSection, setActiveSection] = useState<string | null>(null);

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveSection(id);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Back Button */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Home</span>
        </Link>

        <div className="grid lg:grid-cols-[280px_1fr] gap-8 lg:gap-12">
          {/* Sidebar Navigation */}
          <aside className="lg:sticky lg:top-8 h-fit">
            <div className="bg-slate-800/50 backdrop-blur-xl border border-white/10 rounded-xl p-6">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4">
                Table of Contents
              </h3>
              <nav className="space-y-1">
                {[
                  { id: "intro", label: "Introduction" },
                  { id: "information-collect", label: "Information We Collect" },
                  { id: "information-use", label: "How We Use Information" },
                  { id: "information-share", label: "How We Share Information" },
                  { id: "ai-processing", label: "AI Processing & Data" },
                  { id: "data-security", label: "Data Security" },
                  { id: "data-retention", label: "Data Retention" },
                  { id: "privacy-rights", label: "Your Privacy Rights" },
                  { id: "international", label: "International Transfers" },
                  { id: "children", label: "Children's Privacy" },
                  { id: "cookies", label: "Cookies & Tracking" },
                  { id: "ccpa", label: "California Rights (CCPA)" },
                  { id: "gdpr", label: "European Rights (GDPR)" },
                  { id: "changes", label: "Policy Changes" },
                  { id: "contact", label: "Contact Us" }
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => scrollToSection(item.id)}
                    className={`block w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${
                      activeSection === item.id
                        ? "bg-purple-500/20 text-purple-400 font-medium"
                        : "text-slate-400 hover:text-white hover:bg-slate-700/30"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </nav>
            </div>
          </aside>

          {/* Main Content */}
          <main className="min-w-0">
            {/* Header */}
            <div className="mb-12">
              <div className="flex items-start gap-6 mb-6">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <Shield className="w-10 h-10 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl sm:text-5xl font-bold text-white mb-3">
                    Privacy Policy
                  </h1>
                  <p className="text-slate-400">
                    Effective Date: January 17, 2026
                  </p>
                </div>
              </div>
            </div>

            {/* Trust Highlights */}
            <div id="intro" className="scroll-mt-8 mb-12">
              <div className="bg-slate-800/50 backdrop-blur-xl border border-white/10 rounded-xl p-6 mb-8">
                <p className="text-slate-300 leading-relaxed">
                  Preciprocal is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your personal information when you use our AI-powered career preparation platform.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  { icon: Lock, title: "Bank-Level Encryption", desc: "All data encrypted in transit and at rest" },
                  { icon: Shield, title: "No Data Selling", desc: "We never sell your personal information" },
                  { icon: Eye, title: "Full Transparency", desc: "Clear information about data usage" },
                  { icon: CheckCircle2, title: "Your Control", desc: "Easy access and deletion rights" }
                ].map((item, i) => {
                  const Icon = item.icon;
                  return (
                    <div key={i} className="bg-slate-800/30 backdrop-blur-sm border border-white/5 rounded-xl p-5 text-center">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center mx-auto mb-3">
                        <Icon className="w-6 h-6 text-white" />
                      </div>
                      <h3 className="text-white font-semibold mb-2 text-sm">{item.title}</h3>
                      <p className="text-slate-400 text-xs">{item.desc}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Content Sections */}
            <div className="prose prose-invert prose-slate max-w-none space-y-8">
              {/* Section 1 */}
              <section id="information-collect" className="scroll-mt-8">
                <div className="bg-slate-800/30 backdrop-blur-sm border border-white/5 rounded-xl p-8">
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                    <span className="text-purple-400">1.</span>
                    Information We Collect
                  </h2>
                  <div className="space-y-6 text-slate-300">
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">1.1 Information You Provide Directly</h3>
                      <ul className="space-y-2">
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                          <span><strong className="text-white">Account Information:</strong> Full name, email address, phone number, location, professional profile data</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                          <span><strong className="text-white">Career-Related Content:</strong> Resumes, cover letters, job descriptions, career goals, preferred technologies</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                          <span><strong className="text-white">Interview Data:</strong> Interview responses, voice recordings, transcripts, feedback and scores</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                          <span><strong className="text-white">Payment Information:</strong> Payment details processed through our secure payment processor, billing address, subscription history</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                          <span><strong className="text-white">Communication Data:</strong> Support tickets, feedback submissions, user preferences</span>
                        </li>
                      </ul>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">1.2 Information Collected Automatically</h3>
                      <ul className="space-y-2">
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                          <span><strong className="text-white">Usage Data:</strong> Pages visited, features used, time spent, click patterns, device information, IP address</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                          <span><strong className="text-white">Performance Data:</strong> Error logs, API response times, feature usage statistics</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                          <span><strong className="text-white">Analytics Data:</strong> User engagement metrics, feature adoption rates, conversion data</span>
                        </li>
                      </ul>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">1.3 Information from Third-Party Services</h3>
                      <ul className="space-y-2">
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                          <span><strong className="text-white">Authentication Providers:</strong> Third-party authentication services (name, email, profile picture)</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                          <span><strong className="text-white">AI Service Providers:</strong> AI-processed content for resume analysis and content generation</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                          <span><strong className="text-white">Payment Processors:</strong> Payment status, subscription details, transaction history from our payment provider</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 2 */}
              <section id="information-use" className="scroll-mt-8">
                <div className="bg-slate-800/30 backdrop-blur-sm border border-white/5 rounded-xl p-8">
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                    <span className="text-purple-400">2.</span>
                    How We Use Your Information
                  </h2>
                  <div className="space-y-6 text-slate-300">
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">2.1 Service Delivery</h3>
                      <ul className="space-y-2">
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                          <span>Provide and maintain the Preciprocal platform</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                          <span>Process and analyze resumes using AI</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                          <span>Generate personalized interview questions and cover letters</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                          <span>Develop customized study plans</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                          <span>Enable voice-powered interview simulations</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                          <span>Match resumes with job descriptions</span>
                        </li>
                      </ul>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">2.2 Account Management</h3>
                      <ul className="space-y-2">
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                          <span>Create and manage user accounts</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                          <span>Authenticate users and maintain security</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                          <span>Process subscription payments through secure payment providers</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                          <span>Send transactional emails and notifications</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                          <span>Provide customer support</span>
                        </li>
                      </ul>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">2.3 Service Improvement</h3>
                      <ul className="space-y-2">
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                          <span>Analyze usage patterns to improve features</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                          <span>Develop new features and functionality</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                          <span>Train and improve AI models using anonymized data</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                          <span>Conduct quality assurance testing</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                          <span>Optimize platform performance</span>
                        </li>
                      </ul>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">2.4 Communication</h3>
                      <ul className="space-y-2">
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                          <span>Send service updates and announcements</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                          <span>Provide customer support responses</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                          <span>Request feedback on user experience</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                          <span>Send promotional content with consent</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                          <span>Deliver beta testing invitations</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 3 */}
              <section id="information-share" className="scroll-mt-8">
                <div className="bg-slate-800/30 backdrop-blur-sm border border-white/5 rounded-xl p-8">
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                    <span className="text-purple-400">3.</span>
                    How We Share Your Information
                  </h2>
                  <div className="space-y-6 text-slate-300">
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">3.1 Service Providers</h3>
                      <ul className="space-y-2">
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                          <span><strong className="text-white">Infrastructure:</strong> Cloud hosting providers, database services, authentication services, and file storage providers</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                          <span><strong className="text-white">AI and Analysis:</strong> Third-party AI services for resume analysis, content generation, and voice interview processing</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                          <span><strong className="text-white">Payment Processing:</strong> Secure payment processors that handle all payment card information per PCI-DSS standards</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                          <span><strong className="text-white">Communication:</strong> Professional email service providers and email delivery services</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                          <span><strong className="text-white">Analytics:</strong> Usage analytics and performance monitoring services</span>
                        </li>
                      </ul>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">3.2 Legal Requirements</h3>
                      <ul className="space-y-2">
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                          <span>Comply with legal obligations, court orders, or subpoenas</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                          <span>Enforce our Terms of Service</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                          <span>Protect rights, property, or safety of Preciprocal and users</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                          <span>Respond to government or regulatory requests</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                          <span>Prevent fraud and security issues</span>
                        </li>
                      </ul>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">3.3 Business Transfers</h3>
                      <p>In the event of a merger, acquisition, or sale of assets, your information may be transferred to the acquiring entity. We will notify you via email of any such change in ownership.</p>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">3.4 Aggregated Data</h3>
                      <p>We may share aggregated, de-identified, or anonymized data that cannot reasonably identify you for research, analytics, and demonstration purposes.</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 4 */}
              <section id="ai-processing" className="scroll-mt-8">
                <div className="bg-slate-800/30 backdrop-blur-sm border border-white/5 rounded-xl p-8">
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                    <span className="text-purple-400">4.</span>
                    AI Processing and Data Usage
                  </h2>
                  <div className="space-y-6 text-slate-300">
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">4.1 AI Model Processing</h3>
                      <p>Your content is processed by third-party AI services to analyze resume quality and ATS compatibility, generate interview questions, create cover letters, provide career guidance, simulate recruiter perspectives, and match skills with job requirements.</p>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">4.2 AI Training and Improvement</h3>
                      <ul className="space-y-2">
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                          <span>We may use anonymized, de-identified data to improve AI models</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                          <span>Personal identifiers are removed before any training data use</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                          <span>Individual users cannot be identified from training data</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                          <span>You may opt out by contacting support@preciprocal.com</span>
                        </li>
                      </ul>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">4.3 AI-Generated Content</h3>
                      <p>AI-generated feedback is based on algorithms and may not be perfect. We do not manually review all AI outputs. Users should verify and customize AI-generated content before use.</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 5 */}
              <section id="data-security" className="scroll-mt-8">
                <div className="bg-slate-800/30 backdrop-blur-sm border border-white/5 rounded-xl p-8">
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                    <span className="text-purple-400">5.</span>
                    Data Security
                  </h2>
                  <div className="space-y-6 text-slate-300">
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">5.1 Security Measures</h3>
                      <ul className="space-y-2">
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                          <span>Encryption in transit (HTTPS/TLS)</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                          <span>Encryption at rest for sensitive data</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                          <span>Secure authentication via trusted authentication providers</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                          <span>Regular security audits and updates</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                          <span>Access controls and authentication requirements</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                          <span>Secure file storage with enterprise-grade cloud storage</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                          <span>Regular backups and disaster recovery procedures</span>
                        </li>
                      </ul>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">5.2 Payment Security</h3>
                      <ul className="space-y-2">
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                          <span>All payment information processed by PCI-DSS Level 1 certified payment providers</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                          <span>We do not store credit card numbers or sensitive payment data</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                          <span>Payment processing uses tokenization and encryption</span>
                        </li>
                      </ul>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">5.3 Account Security</h3>
                      <p>Enhance your security by using strong passwords, enabling two-factor authentication when available, keeping credentials confidential, logging out of shared devices, and reporting suspicious activity immediately.</p>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">5.4 Limitations</h3>
                      <p>No security system is impenetrable. While we use reasonable measures to protect your data, we cannot guarantee absolute security. You acknowledge the inherent risks of transmitting information over the internet.</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 6 */}
              <section id="data-retention" className="scroll-mt-8">
                <div className="bg-slate-800/30 backdrop-blur-sm border border-white/5 rounded-xl p-8">
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                    <span className="text-purple-400">6.</span>
                    Data Retention
                  </h2>
                  <div className="space-y-6 text-slate-300">
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">6.1 Active Accounts</h3>
                      <ul className="space-y-2">
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                          <span>Account information: Duration of account plus 90 days</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                          <span>Resume and career content: Duration of account plus 1 year</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                          <span>Interview history: Duration of account plus 1 year</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                          <span>Usage analytics: Anonymized after 2 years</span>
                        </li>
                      </ul>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">6.2 Deleted Accounts</h3>
                      <ul className="space-y-2">
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                          <span>Most personal data deleted within 30 days</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                          <span>Backups may retain data for up to 90 days</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                          <span>Anonymized analytics data may be retained indefinitely</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                          <span>Legal obligations may require longer retention</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 7 */}
              <section id="privacy-rights" className="scroll-mt-8">
                <div className="bg-slate-800/30 backdrop-blur-sm border border-white/5 rounded-xl p-8">
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                    <span className="text-purple-400">7.</span>
                    Your Privacy Rights
                  </h2>
                  <div className="space-y-6 text-slate-300">
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">7.1 Access and Portability</h3>
                      <p>You have the right to access your personal information, request a copy in a portable format, and review data we&apos;ve collected about you.</p>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">7.2 Correction and Update</h3>
                      <p>You may correct inaccurate information, update your profile and preferences, and modify your career information and content.</p>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">7.3 Deletion</h3>
                      <p>You may request deletion of your account and profile, specific content (resumes, cover letters), or interview history and recordings. Some data may be retained as required by law.</p>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">7.4 Opt-Out Rights</h3>
                      <ul className="space-y-2">
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                          <span>Marketing communications (via unsubscribe links)</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                          <span>Non-essential cookies (via browser settings)</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                          <span>Certain data processing for AI training</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                          <span>Analytics tracking (via account settings)</span>
                        </li>
                      </ul>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">7.5 Exercising Your Rights</h3>
                      <p>To exercise privacy rights, email privacy@preciprocal.com or use account settings for self-service options. We will respond within 30 days. Verification of identity may be required.</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 8 */}
              <section id="international" className="scroll-mt-8">
                <div className="bg-slate-800/30 backdrop-blur-sm border border-white/5 rounded-xl p-8">
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                    <span className="text-purple-400">8.</span>
                    International Data Transfers
                  </h2>
                  <div className="space-y-4 text-slate-300">
                    <p>
                      Preciprocal is based in the United States. If you access our services from outside the U.S., your information may be transferred to and stored in the United States. U.S. privacy laws may differ from your home country. We use standard contractual clauses and other safeguards for international transfers. By using our services, you consent to this transfer.
                    </p>
                  </div>
                </div>
              </section>

              {/* Section 9 */}
              <section id="children" className="scroll-mt-8">
                <div className="bg-slate-800/30 backdrop-blur-sm border border-white/5 rounded-xl p-8">
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                    <span className="text-purple-400">9.</span>
                    Children&apos;s Privacy
                  </h2>
                  <div className="space-y-6 text-slate-300">
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">9.1 Age Requirements</h3>
                      <p>Preciprocal is not intended for children under 16. We do not knowingly collect information from children under 16.</p>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">9.2 Parental Discovery</h3>
                      <p>If we discover we have collected information from a child under 16, we will delete it promptly. Parents who believe their child has provided information should contact privacy@preciprocal.com.</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 10 */}
              <section id="cookies" className="scroll-mt-8">
                <div className="bg-slate-800/30 backdrop-blur-sm border border-white/5 rounded-xl p-8">
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                    <span className="text-purple-400">10.</span>
                    Cookies and Tracking
                  </h2>
                  <div className="space-y-6 text-slate-300">
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">10.1 Types of Cookies</h3>
                      <ul className="space-y-2">
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                          <span><strong className="text-white">Essential Cookies:</strong> Session management, authentication, security, service functionality</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                          <span><strong className="text-white">Analytics Cookies:</strong> Usage statistics, performance monitoring, feature adoption</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                          <span><strong className="text-white">Preference Cookies:</strong> User settings, language and region, display preferences</span>
                        </li>
                      </ul>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">10.2 Managing Cookies</h3>
                      <p>You can control cookies through browser settings (block or delete cookies), account preferences, and third-party opt-out tools. Note: Disabling essential cookies may impact service functionality.</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 11 */}
              <section id="ccpa" className="scroll-mt-8">
                <div className="bg-slate-800/30 backdrop-blur-sm border border-white/5 rounded-xl p-8">
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                    <span className="text-purple-400">11.</span>
                    California Privacy Rights (CCPA)
                  </h2>
                  <div className="space-y-6 text-slate-300">
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">Your CCPA Rights</h3>
                      <ul className="space-y-2">
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                          <span><strong className="text-white">Right to Know:</strong> Categories and specific pieces of personal information collected</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                          <span><strong className="text-white">Right to Delete:</strong> Request deletion of personal information (with exceptions)</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                          <span><strong className="text-white">Right to Opt-Out:</strong> Opt out of sale of personal information (Note: We do not sell personal information)</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                          <span><strong className="text-white">Right to Non-Discrimination:</strong> We will not discriminate for exercising CCPA rights</span>
                        </li>
                      </ul>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">Exercising CCPA Rights</h3>
                      <p>Email privacy@preciprocal.com with &quot;CCPA Request&quot; in the subject line. We verify identity before processing requests. You may designate an authorized agent to make requests on your behalf.</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 12 */}
              <section id="gdpr" className="scroll-mt-8">
                <div className="bg-slate-800/30 backdrop-blur-sm border border-white/5 rounded-xl p-8">
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                    <span className="text-purple-400">12.</span>
                    European Privacy Rights (GDPR)
                  </h2>
                  <div className="space-y-6 text-slate-300">
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">12.1 Legal Basis for Processing</h3>
                      <ul className="space-y-2">
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                          <span><strong className="text-white">Consent:</strong> For optional features and marketing</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                          <span><strong className="text-white">Contract:</strong> To provide services you&apos;ve requested</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                          <span><strong className="text-white">Legitimate Interest:</strong> Service improvement and security</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                          <span><strong className="text-white">Legal Obligation:</strong> Compliance with laws</span>
                        </li>
                      </ul>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">12.2 GDPR Rights</h3>
                      <ul className="space-y-2">
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                          <span>Right to access and portability</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                          <span>Right to rectification</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                          <span>Right to erasure (&quot;;right to be forgotten&quot;)</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                          <span>Right to restrict processing</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                          <span>Right to object to processing</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                          <span>Right to withdraw consent</span>
                        </li>
                        <li className="flex items-start gap-3">
                          <CheckCircle2 className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
                          <span>Right to lodge a complaint with supervisory authority</span>
                        </li>
                      </ul>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 13 */}
              <section id="changes" className="scroll-mt-8">
                <div className="bg-slate-800/30 backdrop-blur-sm border border-white/5 rounded-xl p-8">
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                    <span className="text-purple-400">13.</span>
                    Changes to This Privacy Policy
                  </h2>
                  <div className="space-y-6 text-slate-300">
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">13.1 Updates</h3>
                      <p>We may update this Privacy Policy to reflect changes in legal requirements, new features or services, changes in data practices, and user feedback.</p>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">13.2 Notification</h3>
                      <p>We will notify you of material changes via email to your registered address, in-app notifications, and prominent notice on our website.</p>
                    </div>

                    <div>
                      <h3 className="text-lg font-semibold text-white mb-3">13.3 Continued Use</h3>
                      <p>Your continued use of Preciprocal after changes constitutes acceptance of the updated Privacy Policy.</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Data Breach Notice */}
              <div className="bg-red-900/20 backdrop-blur-sm border border-red-500/30 rounded-xl p-8">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-red-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                    <AlertCircle className="w-5 h-5 text-red-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-2">
                      Data Breach Notification
                    </h3>
                    <p className="text-slate-300 leading-relaxed">
                      In the event of a data breach affecting your personal information, we will notify you promptly as required by law. Notification will include the nature of the breach and steps to protect yourself. We will report to relevant authorities as required.
                    </p>
                  </div>
                </div>
              </div>

              {/* Contact Section */}
              <section id="contact" className="scroll-mt-8">
                <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 backdrop-blur-sm border border-purple-500/20 rounded-xl p-8">
                  <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-white mb-3">
                      Privacy Questions?
                    </h2>
                    <p className="text-slate-400 max-w-2xl mx-auto">
                      We&apos;re committed to transparency and protecting your privacy. If you have any questions or concerns, our team is here to help.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <a href="mailto:privacy@preciprocal.com" className="bg-slate-700/30 hover:bg-slate-700/50 p-5 rounded-lg transition-all text-center group">
                      <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                        <Lock className="w-6 h-6 text-blue-400" />
                      </div>
                      <h4 className="text-white font-semibold mb-2 text-sm">Privacy Inquiries</h4>
                      <div className="text-blue-400 group-hover:text-blue-300 text-sm">privacy@preciprocal.com</div>
                    </a>

                    <a href="mailto:dpo@preciprocal.com" className="bg-slate-700/30 hover:bg-slate-700/50 p-5 rounded-lg transition-all text-center group">
                      <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                        <Shield className="w-6 h-6 text-purple-400" />
                      </div>
                      <h4 className="text-white font-semibold mb-2 text-sm">Data Protection Officer</h4>
                      <div className="text-purple-400 group-hover:text-purple-300 text-sm">dpo@preciprocal.com</div>
                    </a>

                    <a href="mailto:support@preciprocal.com" className="bg-slate-700/30 hover:bg-slate-700/50 p-5 rounded-lg transition-all text-center group">
                      <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                        <CheckCircle2 className="w-6 h-6 text-green-400" />
                      </div>
                      <h4 className="text-white font-semibold mb-2 text-sm">General Support</h4>
                      <div className="text-green-400 group-hover:text-green-300 text-sm">support@preciprocal.com</div>
                    </a>
                  </div>

                  <div className="flex justify-center mt-8">
                    <Link
                      href="/terms"
                      className="px-6 py-3 bg-slate-700/50 hover:bg-slate-700/70 border border-white/10 rounded-lg font-medium transition-all text-white"
                    >
                      View Terms of Service
                    </Link>
                  </div>
                </div>
              </section>

              {/* Footer Note */}
              <div className="text-center text-slate-500 text-sm space-y-2 pt-8">
                <p>&copy; 2026 Preciprocal Inc. All rights reserved.</p>
                <p>
                  By using Preciprocal, you acknowledge that you have read and understood this Privacy Policy and agree to its terms.
                </p>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
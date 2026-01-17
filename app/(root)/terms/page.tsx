"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Scale } from "lucide-react";

export default function TermsOfServicePage() {
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
                  { id: "acceptance", label: "Acceptance of Terms" },
                  { id: "definitions", label: "Definitions" },
                  { id: "eligibility", label: "Eligibility & Account" },
                  { id: "services", label: "Services & Features" },
                  { id: "subscription", label: "Subscription & Billing" },
                  { id: "user-content", label: "User Content" },
                  { id: "ai-content", label: "AI-Generated Content" },
                  { id: "privacy", label: "Privacy & Data" },
                  { id: "acceptable-use", label: "Acceptable Use Policy" },
                  { id: "ip-rights", label: "Intellectual Property" },
                  { id: "third-party", label: "Third-Party Services" },
                  { id: "warranties", label: "Warranties & Disclaimers" },
                  { id: "liability", label: "Limitation of Liability" },
                  { id: "indemnification", label: "Indemnification" },
                  { id: "termination", label: "Termination" },
                  { id: "dispute", label: "Dispute Resolution" },
                  { id: "general", label: "General Provisions" },
                  { id: "contact", label: "Contact Information" }
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
                <div className="w-20 h-20 bg-gradient-to-br from-purple-600 to-blue-600 rounded-2xl flex items-center justify-center flex-shrink-0">
                  <Scale className="w-10 h-10 text-white" />
                </div>
                <div>
                  <h1 className="text-4xl sm:text-5xl font-bold text-white mb-3">
                    Terms of Service
                  </h1>
                  <p className="text-slate-400">
                    Effective Date: January 17, 2026
                  </p>
                </div>
              </div>
              
              <div className="bg-slate-800/50 backdrop-blur-xl border border-white/10 rounded-xl p-6">
                <p className="text-slate-300 leading-relaxed">
                  These Terms of Service constitute a legally binding agreement between you and Preciprocal Inc. governing your access to and use of the Preciprocal platform, website, and services. Please read these Terms carefully before using our Service.
                </p>
              </div>
            </div>

            {/* Content Sections */}
            <div className="prose prose-invert prose-slate max-w-none space-y-8">
              {/* Section 1 */}
              <section id="acceptance" className="scroll-mt-8">
                <div className="bg-slate-800/30 backdrop-blur-sm border border-white/5 rounded-xl p-8">
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                    <span className="text-purple-400">1.</span>
                    Acceptance of Terms
                  </h2>
                  <div className="space-y-4 text-slate-300">
                    <p>
                      By accessing or using the Service, you acknowledge that you have read, understood, and agree to be bound by these Terms and our Privacy Policy. If you do not agree to these Terms, you may not access or use the Service.
                    </p>
                    <p>
                      We reserve the right to modify these Terms at any time. We will notify you of material changes by posting the new Terms on the Service and updating the Effective Date above. Your continued use of the Service after such modifications constitutes your acceptance of the updated Terms.
                    </p>
                  </div>
                </div>
              </section>

              {/* Section 2 */}
              <section id="definitions" className="scroll-mt-8">
                <div className="bg-slate-800/30 backdrop-blur-sm border border-white/5 rounded-xl p-8">
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                    <span className="text-purple-400">2.</span>
                    Definitions
                  </h2>
                  <div className="space-y-3 text-slate-300">
                    <p><strong className="text-white">Service</strong> refers to the Preciprocal platform, including all features, tools, content, and functionality.</p>
                    <p><strong className="text-white">User Content</strong> means any data, information, or materials you submit, upload, or transmit through the Service.</p>
                    <p><strong className="text-white">AI-Generated Content</strong> refers to outputs, recommendations, feedback, or materials generated by our artificial intelligence systems.</p>
                    <p><strong className="text-white">Account</strong> means your registered user account on the Service.</p>
                    <p><strong className="text-white">Subscription</strong> refers to paid access plans that provide enhanced features and increased usage limits.</p>
                  </div>
                </div>
              </section>

              {/* Section 3 */}
              <section id="eligibility" className="scroll-mt-8">
                <div className="bg-slate-800/30 backdrop-blur-sm border border-white/5 rounded-xl p-8">
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                    <span className="text-purple-400">3.</span>
                    Eligibility and Account Registration
                  </h2>
                  <div className="space-y-4 text-slate-300">
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-2">3.1 Age Requirement</h3>
                      <p>You must be at least 13 years of age to use the Service. If you are between 13 and 18 years of age (or the age of legal majority in your jurisdiction), you may only use the Service with the consent and supervision of a parent or legal guardian who agrees to be bound by these Terms.</p>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-2">3.2 Account Security</h3>
                      <p>You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your Account. You agree to immediately notify us of any unauthorized access or use of your Account. We are not liable for any loss or damage arising from your failure to protect your account information.</p>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-2">3.3 Account Accuracy</h3>
                      <p>You agree to provide accurate, current, and complete information during registration and to update such information as necessary. We reserve the right to suspend or terminate Accounts that contain inaccurate or fraudulent information.</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 4 */}
              <section id="services" className="scroll-mt-8">
                <div className="bg-slate-800/30 backdrop-blur-sm border border-white/5 rounded-xl p-8">
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                    <span className="text-purple-400">4.</span>
                    Services and Features
                  </h2>
                  <div className="space-y-4 text-slate-300">
                    <p>Preciprocal provides AI-powered career preparation tools and services, including but not limited to:</p>
                    <ul className="list-disc list-inside space-y-2 ml-4">
                      <li>AI-powered interview practice and simulation</li>
                      <li>Resume analysis and optimization</li>
                      <li>Cover letter generation and customization</li>
                      <li>Career guidance and job search recommendations</li>
                      <li>Study plan creation and tracking</li>
                      <li>Company research and insights</li>
                    </ul>
                    <p>
                      We reserve the right to modify, suspend, or discontinue any feature or aspect of the Service at any time without prior notice. We are not liable to you or any third party for any modification, suspension, or discontinuance of the Service.
                    </p>
                  </div>
                </div>
              </section>

              {/* Section 5 */}
              <section id="subscription" className="scroll-mt-8">
                <div className="bg-slate-800/30 backdrop-blur-sm border border-white/5 rounded-xl p-8">
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                    <span className="text-purple-400">5.</span>
                    Subscription Plans and Billing
                  </h2>
                  <div className="space-y-4 text-slate-300">
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-2">5.1 Subscription Tiers</h3>
                      <p>We offer various subscription plans with different features, usage limits, and pricing. Current plan details are available on our website and may be modified at our discretion with reasonable notice to subscribers.</p>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-2">5.2 Billing and Payment</h3>
                      <p>Subscription fees are billed in advance on a monthly or annual basis, depending on your selected plan. All fees are non-refundable except as required by law or as explicitly stated in these Terms. You authorize us to charge your payment method for all fees incurred.</p>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-2">5.3 Automatic Renewal</h3>
                      <p>Your subscription will automatically renew at the end of each billing period unless you cancel prior to the renewal date. You may cancel your subscription at any time through your Account settings.</p>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-2">5.4 Price Changes</h3>
                      <p>We reserve the right to modify subscription prices. We will provide you with at least 30 days&apos; notice of any price increase. Your continued use of the Service after the price increase takes effect constitutes acceptance of the new price.</p>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-2">5.5 Free Tier Limitations</h3>
                      <p>Free tier users are subject to usage limitations as specified on our website. We reserve the right to modify free tier limits at any time.</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 6 */}
              <section id="user-content" className="scroll-mt-8">
                <div className="bg-slate-800/30 backdrop-blur-sm border border-white/5 rounded-xl p-8">
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                    <span className="text-purple-400">6.</span>
                    User Content and Ownership
                  </h2>
                  <div className="space-y-4 text-slate-300">
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-2">6.1 Your Ownership</h3>
                      <p>You retain all ownership rights to your User Content. You are solely responsible for your User Content and the consequences of posting or publishing it.</p>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-2">6.2 License Grant</h3>
                      <p>By submitting User Content, you grant Preciprocal a worldwide, non-exclusive, royalty-free, transferable license to use, reproduce, process, adapt, modify, and analyze your User Content solely for the purpose of providing and improving the Service. This license terminates when you delete your User Content or Account, except where continued storage is required by law.</p>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-2">6.3 Representations and Warranties</h3>
                      <p>You represent and warrant that: (i) you own or have the necessary rights to your User Content, (ii) your User Content does not violate any third-party rights, including intellectual property rights, privacy rights, or publicity rights, and (iii) your User Content complies with these Terms and all applicable laws.</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 7 */}
              <section id="ai-content" className="scroll-mt-8">
                <div className="bg-slate-800/30 backdrop-blur-sm border border-white/5 rounded-xl p-8">
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                    <span className="text-purple-400">7.</span>
                    AI-Generated Content
                  </h2>
                  <div className="space-y-4 text-slate-300">
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-2">7.1 Nature of AI Content</h3>
                      <p>The Service uses artificial intelligence to generate feedback, recommendations, and content. AI-Generated Content is provided for informational and educational purposes only and should not be considered professional career advice, legal advice, or guaranteed outcomes.</p>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-2">7.2 No Guarantees</h3>
                      <p>We do not guarantee the accuracy, completeness, or suitability of AI-Generated Content for any particular purpose. We do not guarantee that use of our Service will result in job offers, interviews, or any specific career outcomes.</p>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-2">7.3 User Responsibility</h3>
                      <p>You are responsible for reviewing, verifying, and determining the appropriateness of all AI-Generated Content before using it. You should not rely solely on AI-Generated Content for important career decisions.</p>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-2">7.4 Ownership of AI Content</h3>
                      <p>Subject to your ownership of User Content used as input, you own the AI-Generated Content produced specifically for you through the Service. However, we retain the right to use aggregated, anonymized data derived from AI interactions to improve our services.</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 8 */}
              <section id="privacy" className="scroll-mt-8">
                <div className="bg-slate-800/30 backdrop-blur-sm border border-white/5 rounded-xl p-8">
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                    <span className="text-purple-400">8.</span>
                    Privacy and Data Protection
                  </h2>
                  <div className="space-y-4 text-slate-300">
                    <p>
                      Your privacy is important to us. Our Privacy Policy, which is incorporated into these Terms by reference, describes how we collect, use, store, and protect your personal information. By using the Service, you consent to our collection and use of your data as described in the Privacy Policy.
                    </p>
                    <p>
                      We implement industry-standard security measures to protect your data. However, no method of transmission over the internet or electronic storage is completely secure, and we cannot guarantee absolute security.
                    </p>
                  </div>
                </div>
              </section>

              {/* Section 9 */}
              <section id="acceptable-use" className="scroll-mt-8">
                <div className="bg-slate-800/30 backdrop-blur-sm border border-white/5 rounded-xl p-8">
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                    <span className="text-purple-400">9.</span>
                    Acceptable Use Policy
                  </h2>
                  <div className="space-y-4 text-slate-300">
                    <p>You agree not to use the Service to:</p>
                    <ul className="list-disc list-inside space-y-2 ml-4">
                      <li>Violate any applicable laws, regulations, or third-party rights</li>
                      <li>Upload or transmit viruses, malware, or other malicious code</li>
                      <li>Harass, abuse, threaten, or intimidate others</li>
                      <li>Impersonate any person or entity or misrepresent your affiliation</li>
                      <li>Interfere with or disrupt the Service or servers or networks connected to the Service</li>
                      <li>Attempt to gain unauthorized access to any portion of the Service</li>
                      <li>Use the Service for any fraudulent or illegal purpose</li>
                      <li>Scrape, data mine, or use automated tools to extract data from the Service</li>
                      <li>Reverse engineer, decompile, or disassemble any aspect of the Service</li>
                      <li>Upload content that infringes intellectual property rights or contains hate speech, discriminatory content, or explicit material</li>
                      <li>Use the Service to distribute spam or unsolicited communications</li>
                      <li>Circumvent usage limits or access restrictions</li>
                    </ul>
                    <p>
                      We reserve the right to investigate and take appropriate action against anyone who violates this Acceptable Use Policy, including removing User Content, suspending or terminating Accounts, and reporting to law enforcement authorities.
                    </p>
                  </div>
                </div>
              </section>

              {/* Section 10 */}
              <section id="ip-rights" className="scroll-mt-8">
                <div className="bg-slate-800/30 backdrop-blur-sm border border-white/5 rounded-xl p-8">
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                    <span className="text-purple-400">10.</span>
                    Intellectual Property Rights
                  </h2>
                  <div className="space-y-4 text-slate-300">
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-2">10.1 Our Property</h3>
                      <p>The Service, including its design, functionality, text, graphics, logos, icons, images, audio clips, software, and other content (excluding User Content), is owned by Preciprocal or our licensors and is protected by copyright, trademark, patent, trade secret, and other intellectual property laws.</p>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-2">10.2 Limited License</h3>
                      <p>Subject to these Terms, we grant you a limited, non-exclusive, non-transferable, revocable license to access and use the Service for your personal, non-commercial use. This license does not include any right to: (i) resell or commercial use of the Service, (ii) distribute, publicly perform, or publicly display any content from the Service, (iii) modify or create derivative works based on the Service, or (iv) use any data mining, robots, or similar data gathering tools.</p>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-2">10.3 Trademarks</h3>
                      <p>Preciprocal, the Preciprocal logo, and other marks are trademarks or registered trademarks of Preciprocal Inc. You may not use these marks without our prior written permission.</p>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-2">10.4 DMCA Compliance</h3>
                      <p>We respect intellectual property rights. If you believe that content on the Service infringes your copyright, please contact us with detailed information, and we will investigate and take appropriate action in accordance with the Digital Millennium Copyright Act (DMCA).</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 11 */}
              <section id="third-party" className="scroll-mt-8">
                <div className="bg-slate-800/30 backdrop-blur-sm border border-white/5 rounded-xl p-8">
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                    <span className="text-purple-400">11.</span>
                    Third-Party Services and Links
                  </h2>
                  <div className="space-y-4 text-slate-300">
                    <p>
                      The Service may integrate with or contain links to third-party websites, applications, or services that are not owned or controlled by Preciprocal. We have no control over, and assume no responsibility for, the content, privacy policies, or practices of any third-party services.
                    </p>
                    <p>
                      You acknowledge and agree that we shall not be responsible or liable, directly or indirectly, for any damage or loss caused or alleged to be caused by or in connection with the use of or reliance on any such third-party content, goods, or services.
                    </p>
                    <p>
                      We strongly advise you to read the terms and conditions and privacy policies of any third-party services that you visit or use.
                    </p>
                  </div>
                </div>
              </section>

              {/* Section 12 */}
              <section id="warranties" className="scroll-mt-8">
                <div className="bg-slate-800/30 backdrop-blur-sm border border-white/5 rounded-xl p-8">
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                    <span className="text-purple-400">12.</span>
                    Warranties and Disclaimers
                  </h2>
                  <div className="space-y-4 text-slate-300">
                    <p className="uppercase font-semibold text-white">
                      THE SERVICE IS PROVIDED ON AN AS IS AND AS AVAILABLE BASIS WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED.
                    </p>
                    <p>
                      TO THE FULLEST EXTENT PERMITTED BY LAW, PRECIPROCAL DISCLAIMS ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, AND TITLE.
                    </p>
                    <p>
                      WE DO NOT WARRANT THAT: (I) THE SERVICE WILL MEET YOUR REQUIREMENTS, (II) THE SERVICE WILL BE UNINTERRUPTED, TIMELY, SECURE, OR ERROR-FREE, (III) THE RESULTS OBTAINED FROM USE OF THE SERVICE WILL BE ACCURATE OR RELIABLE, (IV) ANY ERRORS IN THE SERVICE WILL BE CORRECTED, OR (V) THE SERVICE WILL RESULT IN JOB OFFERS, INTERVIEWS, OR EMPLOYMENT.
                    </p>
                    <p>
                      ANY CONTENT DOWNLOADED OR OTHERWISE OBTAINED THROUGH THE SERVICE IS ACCESSED AT YOUR OWN RISK, AND YOU ARE SOLELY RESPONSIBLE FOR ANY DAMAGE TO YOUR COMPUTER SYSTEM OR LOSS OF DATA.
                    </p>
                  </div>
                </div>
              </section>

              {/* Section 13 */}
              <section id="liability" className="scroll-mt-8">
                <div className="bg-slate-800/30 backdrop-blur-sm border border-white/5 rounded-xl p-8">
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                    <span className="text-purple-400">13.</span>
                    Limitation of Liability
                  </h2>
                  <div className="space-y-4 text-slate-300">
                    <p className="uppercase font-semibold text-white">
                      TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL PRECIPROCAL, ITS AFFILIATES, DIRECTORS, EMPLOYEES, AGENTS, SUPPLIERS, OR LICENSORS BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION, LOSS OF PROFITS, DATA, USE, GOODWILL, OR OTHER INTANGIBLE LOSSES, RESULTING FROM:
                    </p>
                    <ul className="list-disc list-inside space-y-2 ml-4">
                      <li>YOUR ACCESS TO OR USE OF OR INABILITY TO ACCESS OR USE THE SERVICE</li>
                      <li>ANY CONDUCT OR CONTENT OF ANY THIRD PARTY ON THE SERVICE</li>
                      <li>ANY CONTENT OBTAINED FROM THE SERVICE</li>
                      <li>UNAUTHORIZED ACCESS, USE, OR ALTERATION OF YOUR TRANSMISSIONS OR CONTENT</li>
                      <li>EMPLOYMENT DECISIONS MADE BY THIRD PARTIES BASED ON AI-GENERATED CONTENT OR YOUR USE OF THE SERVICE</li>
                    </ul>
                    <p>
                      WHETHER BASED ON WARRANTY, CONTRACT, TORT (INCLUDING NEGLIGENCE), OR ANY OTHER LEGAL THEORY, WHETHER OR NOT WE HAVE BEEN INFORMED OF THE POSSIBILITY OF SUCH DAMAGE, AND EVEN IF A REMEDY SET FORTH HEREIN IS FOUND TO HAVE FAILED OF ITS ESSENTIAL PURPOSE.
                    </p>
                    <p>
                      IN NO EVENT SHALL OUR TOTAL LIABILITY TO YOU FOR ALL CLAIMS RELATED TO THE SERVICE EXCEED THE GREATER OF ONE HUNDRED DOLLARS ($100 USD) OR THE AMOUNT YOU PAID US IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM.
                    </p>
                    <p className="text-sm">
                      Some jurisdictions do not allow the exclusion or limitation of certain warranties or damages, so some of the above limitations may not apply to you. In such jurisdictions, our liability will be limited to the greatest extent permitted by law.
                    </p>
                  </div>
                </div>
              </section>

              {/* Section 14 */}
              <section id="indemnification" className="scroll-mt-8">
                <div className="bg-slate-800/30 backdrop-blur-sm border border-white/5 rounded-xl p-8">
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                    <span className="text-purple-400">14.</span>
                    Indemnification
                  </h2>
                  <div className="space-y-4 text-slate-300">
                    <p>
                      You agree to defend, indemnify, and hold harmless Preciprocal, its affiliates, and their respective directors, officers, employees, agents, contractors, and licensors from and against any claims, liabilities, damages, losses, costs, expenses, or fees (including reasonable attorneys&apos; fees) arising from:
                    </p>
                    <ul className="list-disc list-inside space-y-2 ml-4">
                      <li>Your use of or inability to use the Service</li>
                      <li>Your User Content</li>
                      <li>Your violation of these Terms</li>
                      <li>Your violation of any rights of another person or entity</li>
                      <li>Any claim that your User Content caused damage to a third party</li>
                    </ul>
                    <p>
                      This indemnification obligation will survive the termination of these Terms and your use of the Service. We reserve the right to assume exclusive defense and control of any matter subject to indemnification by you, in which event you will cooperate in asserting any available defenses.
                    </p>
                  </div>
                </div>
              </section>

              {/* Section 15 */}
              <section id="termination" className="scroll-mt-8">
                <div className="bg-slate-800/30 backdrop-blur-sm border border-white/5 rounded-xl p-8">
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                    <span className="text-purple-400">15.</span>
                    Termination
                  </h2>
                  <div className="space-y-4 text-slate-300">
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-2">15.1 Termination by You</h3>
                      <p>You may terminate your Account at any time by contacting us or through your Account settings. Upon termination, your right to use the Service will immediately cease.</p>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-2">15.2 Termination by Us</h3>
                      <p>We may suspend or terminate your Account and access to the Service immediately, without prior notice or liability, for any reason, including but not limited to: (i) breach of these Terms, (ii) violation of applicable laws, (iii) fraudulent, abusive, or illegal activity, (iv) at your request, or (v) extended periods of inactivity.</p>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-2">15.3 Effect of Termination</h3>
                      <p>Upon termination, all licenses and rights granted to you in these Terms will immediately cease. We may delete your User Content and Account data, though some information may be retained as required by law or for legitimate business purposes. Provisions of these Terms that by their nature should survive termination shall survive, including ownership provisions, warranty disclaimers, indemnity obligations, and limitations of liability.</p>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-2">15.4 No Refunds</h3>
                      <p>Unless required by law, termination of your Account does not entitle you to a refund of any fees paid.</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 16 */}
              <section id="dispute" className="scroll-mt-8">
                <div className="bg-slate-800/30 backdrop-blur-sm border border-white/5 rounded-xl p-8">
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                    <span className="text-purple-400">16.</span>
                    Dispute Resolution and Arbitration
                  </h2>
                  <div className="space-y-4 text-slate-300">
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-2">16.1 Informal Resolution</h3>
                      <p>Before initiating arbitration or litigation, you agree to first contact us to attempt to resolve any dispute informally. We will attempt to resolve the dispute informally by contacting you via email. If a dispute is not resolved within 30 days of submission, you or Preciprocal may initiate formal proceedings.</p>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-2">16.2 Binding Arbitration</h3>
                      <p>If informal resolution fails, any dispute arising from or relating to these Terms or the Service shall be resolved by binding arbitration in accordance with the rules of the American Arbitration Association (AAA). The arbitration shall be conducted by a single arbitrator in the English language. The arbitration shall take place in Delaware, United States, unless otherwise agreed by the parties.</p>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-2">16.3 Class Action Waiver</h3>
                      <p className="uppercase font-semibold text-white">
                        YOU AND PRECIPROCAL AGREE THAT EACH MAY BRING CLAIMS AGAINST THE OTHER ONLY IN YOUR OR ITS INDIVIDUAL CAPACITY AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED CLASS OR REPRESENTATIVE PROCEEDING.
                      </p>
                      <p>Unless both you and Preciprocal agree otherwise, the arbitrator may not consolidate more than one person&apos;s claims and may not otherwise preside over any form of a representative or class proceeding.</p>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-2">16.4 Exceptions</h3>
                      <p>Notwithstanding the above, either party may seek injunctive or other equitable relief in any court of competent jurisdiction to prevent the actual or threatened infringement, misappropriation, or violation of intellectual property rights.</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 17 */}
              <section id="general" className="scroll-mt-8">
                <div className="bg-slate-800/30 backdrop-blur-sm border border-white/5 rounded-xl p-8">
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                    <span className="text-purple-400">17.</span>
                    General Provisions
                  </h2>
                  <div className="space-y-4 text-slate-300">
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-2">17.1 Governing Law</h3>
                      <p>These Terms shall be governed by and construed in accordance with the laws of the State of Delaware, United States, without regard to its conflict of law provisions.</p>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-2">17.2 Entire Agreement</h3>
                      <p>These Terms, together with our Privacy Policy and any other legal notices published by us on the Service, constitute the entire agreement between you and Preciprocal concerning the Service and supersede all prior agreements and understandings.</p>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-2">17.3 Severability</h3>
                      <p>If any provision of these Terms is found to be unenforceable or invalid, that provision shall be limited or eliminated to the minimum extent necessary so that these Terms shall otherwise remain in full force and effect.</p>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-2">17.4 Waiver</h3>
                      <p>No waiver of any term of these Terms shall be deemed a further or continuing waiver of such term or any other term. Our failure to assert any right or provision under these Terms shall not constitute a waiver of such right or provision.</p>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-2">17.5 Assignment</h3>
                      <p>You may not assign or transfer these Terms or your rights hereunder, in whole or in part, without our prior written consent. We may assign these Terms at any time without notice to you.</p>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-2">17.6 Force Majeure</h3>
                      <p>We shall not be liable for any failure to perform our obligations where such failure results from circumstances beyond our reasonable control, including but not limited to acts of God, natural disasters, war, terrorism, riots, embargoes, acts of civil or military authorities, fire, floods, accidents, pandemics, strikes, or shortages of transportation, facilities, fuel, energy, labor, or materials.</p>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-2">17.7 Notices</h3>
                      <p>All notices to you relating to these Terms shall be posted on the Service or sent to you via the email address you provide. Any notices to us should be sent to the contact information provided in Section 18.</p>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-2">17.8 Export Control</h3>
                      <p>You may not use, export, or re-export the Service except as authorized by United States law and the laws of the jurisdiction in which the Service was obtained. You represent and warrant that you are not located in a country subject to U.S. embargo or that has been designated by the U.S. as a terrorist supporting country.</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* Section 18 */}
              <section id="contact" className="scroll-mt-8">
                <div className="bg-slate-800/30 backdrop-blur-sm border border-white/5 rounded-xl p-8">
                  <h2 className="text-2xl font-bold text-white mb-4 flex items-center gap-3">
                    <span className="text-purple-400">18.</span>
                    Contact Information
                  </h2>
                  <div className="space-y-4 text-slate-300">
                    <p>If you have any questions, concerns, or complaints about these Terms or the Service, please contact us at:</p>
                    <div className="bg-slate-700/30 rounded-lg p-6 space-y-2">
                      <p className="font-semibold text-white">Preciprocal Inc.</p>
                      <p>Email: <a href="mailto:legal@preciprocal.com" className="text-purple-400 hover:text-purple-300 transition-colors">legal@preciprocal.com</a></p>
                      <p>Support: <a href="mailto:support@preciprocal.com" className="text-purple-400 hover:text-purple-300 transition-colors">support@preciprocal.com</a></p>
                      <p>Website: <a href="https://preciprocal.com" className="text-purple-400 hover:text-purple-300 transition-colors">www.preciprocal.com</a></p>
                    </div>
                    <p className="text-sm">
                      For privacy-related inquiries, please refer to our Privacy Policy or contact our Data Protection Officer at <a href="mailto:privacy@preciprocal.com" className="text-purple-400 hover:text-purple-300 transition-colors">privacy@preciprocal.com</a>.
                    </p>
                  </div>
                </div>
              </section>

              {/* Acknowledgment */}
              <div className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 backdrop-blur-sm border border-purple-500/20 rounded-xl p-8 mt-12">
                <h3 className="text-xl font-bold text-white mb-4">Acknowledgment</h3>
                <p className="text-slate-300 leading-relaxed">
                  BY USING THE SERVICE, YOU ACKNOWLEDGE THAT YOU HAVE READ THESE TERMS OF SERVICE, UNDERSTAND THEM, AND AGREE TO BE BOUND BY THEM. IF YOU DO NOT AGREE TO THESE TERMS, YOU MUST NOT ACCESS OR USE THE SERVICE.
                </p>
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
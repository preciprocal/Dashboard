"use client";

import { useState } from "react";

const InteractiveSolutionsDashboard = () => {
  const [activeSolution, setActiveSolution] = useState("ai-displacement");
  const [activeFramework, setActiveFramework] = useState(0);

  const solutions = {
    "ai-displacement": {
      title: "AI Displacement Defense",
      icon: "🤖",
      color: "blue",
      description: "Position yourself as AI-complementary, not AI-replaceable",
      frameworks: [
        {
          name: "AI-Enhanced Worker Positioning",
          method: "AI Multiplication Approach",
          steps: [
            {
              title: "Script Template",
              content: "I don't compete with AI, I multiply its effectiveness by [specific human skill]",
              example: "Marketing: 'I use ChatGPT for initial concepts, then apply creative judgment and brand knowledge to refine'"
            },
            {
              title: "Evidence Gathering",
              content: "Document how you've used AI tools to increase productivity",
              example: "Increased content output by 150% using AI for research while focusing on strategy and client relationships"
            },
            {
              title: "Industry Examples",
              content: "Tailor your AI collaboration story to your field",
              example: "Finance: 'AI helps me analyze data faster, allowing more time for strategic interpretation and risk assessment'"
            }
          ]
        },
        {
          name: "Human-AI Collaboration Scripts",
          method: "COLLABORATE Framework",
          steps: [
            { title: "Clarify", content: "Explain the AI tool's role in your workflow", example: "I use Claude for initial analysis, then apply domain expertise" },
            { title: "Outline", content: "Your unique human contribution", example: "My 5 years of industry experience guides the strategic direction" },
            { title: "Link", content: "Connect to measurable business outcomes", example: "This approach increased project efficiency by 40%" },
            { title: "List", content: "Provide specific examples from experience", example: "Last quarter, I used this method to deliver 3 major projects ahead of schedule" },
            { title: "Address", content: "Proactively handle concerns", example: "I ensure AI recommendations align with company values and compliance" }
          ]
        },
        {
          name: "Future-Proof Skills Demo",
          method: "AI Can't Replace Categories",
          steps: [
            { title: "Complex Problem-Solving", content: "Multi-variable situations requiring judgment", example: "Navigated budget cuts while maintaining team morale and project quality" },
            { title: "Emotional Intelligence", content: "Reading dynamics, managing conflicts", example: "Resolved cross-departmental tension that was blocking a $2M deal" },
            { title: "Creative Innovation", content: "Original thinking beyond pattern matching", example: "Developed breakthrough campaign concept that AI tools couldn't have generated" },
            { title: "Strategic Thinking", content: "Long-term planning with incomplete information", example: "Created 5-year market expansion plan during unprecedented industry uncertainty" }
          ]
        }
      ]
    },
    "layoff-recovery": {
      title: "Layoff Recovery Specialist",
      icon: "📈",
      color: "emerald",
      description: "Transform setbacks into comeback stories with resilience positioning",
      frameworks: [
        {
          name: "Gap Explanation Mastery",
          method: "BRIDGE Method",
          steps: [
            { title: "Brief", content: "Explain in 2 sentences max", example: "Like many in tech, I was affected by the 2024 restructuring. I used this time to upskill in cloud architecture." },
            { title: "Redirect", content: "Focus on lessons learned", example: "This experience taught me the importance of continuous learning and adaptability" },
            { title: "Impact", content: "Show what you're ready to contribute", example: "I'm now certified in AWS and ready to lead digital transformation projects" },
            { title: "Demonstrate", content: "Prove continued growth during gap", example: "Completed 3 professional certifications and freelance project that saved client $50K" },
            { title: "Ground", content: "Connect to company's specific needs", example: "Your job posting mentions cloud migration - exactly what I've been preparing for" }
          ]
        },
        {
          name: "Resilience Storytelling",
          method: "PHOENIX Structure",
          steps: [
            { title: "Previous Success", content: "Establish your competence first", example: "In my last role, I increased team productivity by 35% and managed a $2M budget" },
            { title: "Challenge Encountered", content: "Brief, factual description", example: "The company restructured and eliminated my entire division in Q4 2023" },
            { title: "Actions Taken", content: "Show your agency and response", example: "I immediately created a learning plan and began networking in growth companies" },
            { title: "Skills Developed", content: "Demonstrate what you gained", example: "Earned PMP certification and learned advanced data analysis techniques" },
            { title: "New Perspective", content: "Show wisdom gained", example: "This experience reinforced my passion for building resilient, adaptable teams" },
            { title: "Stronger Position", content: "Express confidence in current state", example: "I'm now better equipped to help organizations navigate uncertainty and thrive" }
          ]
        },
        {
          name: "Value Pivot Positioning",
          method: "Situation-Specific Scripts",
          steps: [
            { title: "Overqualified Concerns", content: "Reframe as focused expertise", example: "I'm intentionally seeking a role where I can focus on strategy rather than juggling multiple priorities" },
            { title: "Industry Switching", content: "Highlight transferable insights", example: "My retail experience gives me unique insights into consumer behavior that directly applies to B2C marketing" },
            { title: "Level Downshift", content: "Show intentional choice", example: "I'm prioritizing work-life balance right now, which means I can bring senior-level thinking without senior-level politics" }
          ]
        }
      ]
    },
    "remote-mastery": {
      title: "Remote Interview Excellence",
      icon: "💻",
      color: "purple",
      description: "Master virtual presence and demonstrate remote work capabilities",
      frameworks: [
        {
          name: "Technical Setup Optimization",
          method: "STREAM Framework",
          steps: [
            { title: "Space", content: "Neutral background, proper distance", example: "Positioned 3 feet from camera with plain wall background" },
            { title: "Technology", content: "Stable internet, backup plans", example: "Wired connection + mobile hotspot backup, tested 30 min before" },
            { title: "Recording Position", content: "Eye-level camera, good angles", example: "Laptop on stack of books, camera at eye level" },
            { title: "Environment", content: "Quiet space, controlled lighting", example: "Ring light positioned behind laptop, 'Do Not Disturb' signs posted" },
            { title: "Audio Quality", content: "External mic or headphones", example: "Wireless earbuds with noise cancellation for clear audio" }
          ]
        },
        {
          name: "Virtual Presence Training",
          method: "Screen Presence Techniques",
          steps: [
            { title: "Eye Contact", content: "Look at camera lens, not screen", example: "Place small arrow sticker near camera as reminder" },
            { title: "Gestures", content: "Keep hands visible, purposeful movements", example: "Gesture within the camera frame, avoid pointing directly at camera" },
            { title: "Voice Projection", content: "10% more energy than normal", example: "Practice with recording - energy should match in-person enthusiasm" },
            { title: "Engagement", content: "Use name 2-3 times, take notes", example: "Thanks for that insight, Sarah. Let me note that down as it relates to the role." }
          ]
        },
        {
          name: "Remote Work Capability Demo",
          method: "REMOTE Success Stories",
          steps: [
            { title: "Relationships", content: "Built connections across time zones", example: "Managed team across 4 time zones, maintained 95% satisfaction scores" },
            { title: "Communication", content: "Effective async collaboration", example: "Implemented documentation system that reduced meeting time by 40%" },
            { title: "Management", content: "Projects without physical oversight", example: "Delivered $500K project remotely with zero missed deadlines" },
            { title: "Technology", content: "Leveraged tools for productivity", example: "Integrated 5 productivity tools that increased team output by 60%" }
          ]
        }
      ]
    },
    "career-pivot": {
      title: "Career Transition Mastery",
      icon: "🎯",
      color: "orange",
      description: "Successfully navigate industry changes and career pivots",
      frameworks: [
        {
          name: "Transferable Skills Mapping",
          method: "TRANSLATE Method",
          steps: [
            { title: "Task Analysis", content: "Break down previous roles into skills", example: "Sales role = market research + relationship building + negotiation + data analysis" },
            { title: "Relevance ID", content: "Match skills to new industry needs", example: "Market research → User research, Negotiation → Stakeholder management" },
            { title: "Analogy Creation", content: "Create bridges between industries", example: "Teaching curriculum design is like product roadmap planning - both require user needs analysis" },
            { title: "Language Adaptation", content: "Use new industry terminology", example: "Students → Users, Lesson plans → User stories, Assessment → Success metrics" }
          ]
        },
        {
          name: "Industry Bridge Narratives",
          method: "BRIDGE Story Structure",
          steps: [
            { title: "Background", content: "Previous industry achievement", example: "In my marketing role, I increased lead generation by 200% through data-driven campaigns" },
            { title: "Realization", content: "Discovery moment for new field", example: "I realized my passion for UX when I started researching user behavior behind those campaigns" },
            { title: "Investment", content: "Commitment to transition", example: "I've completed a UX bootcamp, designed 3 portfolio projects, and networked with 15 UX professionals" },
            { title: "Direct Application", content: "Skills translation", example: "My marketing analytics background directly applies to user behavior analysis and A/B testing" },
            { title: "Evidence", content: "Proof of commitment", example: "My redesign of our company's checkout process increased conversions by 35%" }
          ]
        },
        {
          name: "Experience Translation",
          method: "Industry-Specific Examples",
          steps: [
            { title: "Marketing → UX", content: "Campaign strategy becomes user journey mapping", example: "Designed customer acquisition funnels → Designed user onboarding flows" },
            { title: "Sales → Product", content: "Customer needs become user stories", example: "Identified client pain points → Created product requirements documents" },
            { title: "Teaching → Corporate", content: "Curriculum becomes learning programs", example: "Developed lesson plans for 30 students → Created training programs for 200 employees" }
          ]
        }
      ]
    },
    "gen-z-professional": {
      title: "Gen Z Professional Success",
      icon: "👨‍💼",
      color: "indigo",
      description: "Bridge the gap from digital native to office professional",
      frameworks: [
        {
          name: "Professional Communication",
          method: "PROFESSIONAL Framework",
          steps: [
            { title: "Pause", content: "Think before speaking", example: "Take 2-second pause before responding to difficult questions" },
            { title: "Respectful", content: "Maintain courtesy even when disagreeing", example: "'I see your point, and I'd like to offer a different perspective...'" },
            { title: "Objective", content: "Facts before opinions", example: "'Based on the data I reviewed...' rather than 'I think...'" },
            { title: "Formal Structure", content: "Organized thoughts", example: "First, let me address the timeline. Second, regarding budget..." },
            { title: "Email Etiquette", content: "Proper greetings and signatures", example: "'Good morning Mr. Johnson' not 'Hey!' with professional signature block" }
          ]
        },
        {
          name: "Digital to Office Translation",
          method: "Communication Adjustments",
          steps: [
            { title: "Slack → Email", content: "Structure over casual", example: "Subject lines, proper greetings, clear action items instead of stream-of-consciousness" },
            { title: "Emoji → Verbal", content: "Express acknowledgment verbally", example: "'That's a great point' instead of thumbs up reaction" },
            { title: "Multi-task → Focus", content: "Full attention during meetings", example: "Close laptop, put phone away, take written notes to show engagement" },
            { title: "Screen → Face", content: "In-person social cues", example: "Read body language, maintain appropriate eye contact, understand personal space" }
          ]
        },
        {
          name: "Salary Negotiation Confidence",
          method: "VALUE Framework",
          steps: [
            { title: "Verify", content: "Research market rates", example: "According to Glassdoor and recent graduates, the range for this role is $55-65K" },
            { title: "Articulate", content: "Specific contributions you'll make", example: "My social media expertise will help modernize your marketing to reach younger demographics" },
            { title: "List", content: "Measurable achievements", example: "Increased Instagram engagement by 400% during internship, managed $5K marketing budget" },
            { title: "Understand", content: "Total compensation package", example: "Could we discuss the complete package including professional development opportunities?" }
          ]
        }
      ]
    },
    "economic-stability": {
      title: "Recession-Proof Positioning",
      icon: "🛡️",
      color: "red",
      description: "Demonstrate essential value during economic uncertainty",
      frameworks: [
        {
          name: "Recession-Resistant Analysis",
          method: "ESSENTIAL Framework",
          steps: [
            { title: "Education", content: "Always-needed sector", example: "EdTech companies growing as learning moves online" },
            { title: "Safety & Security", content: "Critical infrastructure", example: "Cybersecurity roles increase during economic stress" },
            { title: "Supply Chain", content: "Economic backbone", example: "Logistics optimization becomes crucial during tight margins" },
            { title: "Energy & Utilities", content: "Fundamental needs", example: "Green energy transition continues regardless of economic cycles" },
            { title: "Technology Infrastructure", content: "Digital backbone", example: "Cloud services and automation reduce costs for other companies" }
          ]
        },
        {
          name: "Cost-Cutting Value Proposition",
          method: "SAVE Framework",
          steps: [
            { title: "Streamline", content: "Process efficiency improvements", example: "Implemented automated reporting that saved 20 hours/week across the team" },
            { title: "Automate", content: "Technology leverage", example: "Created workflow automation that reduced manual tasks by 60%" },
            { title: "Value Optimization", content: "ROI focus", example: "Restructured vendor contracts, saving $100K annually while improving service quality" },
            { title: "Expense Reduction", content: "Cost consciousness", example: "Identified redundant software licenses, cutting costs by $25K without impacting productivity" }
          ]
        },
        {
          name: "Essential Worker Positioning",
          method: "CRITICAL Impact",
          steps: [
            { title: "Customer Satisfaction", content: "Maintain relationships during stress", example: "Maintained 98% customer retention rate during company's worst quarter" },
            { title: "Revenue Protection", content: "Safeguard income streams", example: "Identified at-risk accounts early, preventing $500K in potential churn" },
            { title: "Infrastructure", content: "Keep systems running", example: "Maintained 99.9% uptime during system migrations and budget cuts" },
            { title: "Adaptability", content: "Navigate uncertainty", example: "Quickly pivoted strategy when market conditions changed, maintaining team productivity" }
          ]
        }
      ]
    }
  };

  const currentSolution = solutions[activeSolution];
  const currentFramework = currentSolution.frameworks[activeFramework];

  return (
    <div className="min-h-screen bg-black">
      {/* Header */}
      <section className="py-12 border-b border-gray-800">
        <div className="container mx-auto px-6">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-indigo-300 text-sm font-medium mb-8">
              <span className="w-2 h-2 bg-indigo-400 rounded-full mr-2 animate-pulse"></span>
              Interactive Solution Framework
            </div>
            <h1 className="text-4xl lg:text-6xl font-bold text-white leading-tight mb-6">
              Detailed{" "}
              <span className="bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                Action Plans
              </span>
            </h1>
            <p className="text-xl text-gray-300 leading-relaxed">
              Step-by-step frameworks, scripts, and examples for each critical job market challenge
            </p>
          </div>
        </div>
      </section>

      {/* Solution Selector */}
      <section className="py-8">
        <div className="container mx-auto px-6">
          <div className="max-w-6xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {Object.entries(solutions).map(([key, solution]) => (
                <button
                  key={key}
                  onClick={() => {
                    setActiveSolution(key);
                    setActiveFramework(0);
                  }}
                  className={`p-4 rounded-xl border transition-all duration-300 ${
                    activeSolution === key
                      ? `bg-${solution.color}-900/30 border-${solution.color}-500/50 text-white`
                      : 'bg-gray-800/50 border-gray-700 text-gray-300 hover:border-gray-600'
                  }`}
                >
                  <div className="text-2xl mb-2">{solution.icon}</div>
                  <div className="text-sm font-medium">{solution.title}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-8">
        <div className="container mx-auto px-6">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-4 gap-8">
              {/* Framework Sidebar */}
              <div className="lg:col-span-1">
                <div className={`bg-gradient-to-br from-${currentSolution.color}-900/20 to-${currentSolution.color}-800/10 rounded-2xl p-6 border border-${currentSolution.color}-500/20 sticky top-6`}>
                  <div className="flex items-center space-x-3 mb-6">
                    <div className={`w-12 h-12 bg-${currentSolution.color}-500/20 rounded-xl flex items-center justify-center`}>
                      <span className="text-2xl">{currentSolution.icon}</span>
                    </div>
                    <div>
                      <h2 className="text-lg font-bold text-white">{currentSolution.title}</h2>
                      <p className="text-gray-300 text-sm">{currentSolution.description}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-white font-semibold mb-3">Choose Framework:</h3>
                    {currentSolution.frameworks.map((framework, index) => (
                      <button
                        key={index}
                        onClick={() => setActiveFramework(index)}
                        className={`w-full p-3 rounded-lg text-left transition-all duration-300 ${
                          activeFramework === index
                            ? `bg-${currentSolution.color}-600/20 border border-${currentSolution.color}-500/50 text-white`
                            : 'bg-gray-800/50 border border-gray-700 text-gray-300 hover:border-gray-600'
                        }`}
                      >
                        <div className="font-medium text-sm">{framework.name}</div>
                        <div className="text-xs text-gray-400 mt-1">{framework.method}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Framework Content */}
              <div className="lg:col-span-3">
                <div className={`bg-gradient-to-br from-${currentSolution.color}-900/20 to-${currentSolution.color}-800/10 rounded-2xl p-8 border border-${currentSolution.color}-500/20`}>
                  <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-2xl font-bold text-white">{currentFramework.name}</h3>
                      <div className={`px-4 py-2 bg-${currentSolution.color}-500/20 text-${currentSolution.color}-300 rounded-full text-sm font-medium`}>
                        {currentFramework.method}
                      </div>
                    </div>
                    <p className="text-gray-300">Follow these actionable steps to master this framework:</p>
                  </div>

                  {/* Steps */}
                  <div className="space-y-6">
                    {currentFramework.steps.map((step, index) => (
                      <div key={index} className="bg-white/5 rounded-xl p-6 backdrop-blur-sm">
                        <div className="flex items-start space-x-4">
                          <div className={`w-8 h-8 bg-${currentSolution.color}-500/20 rounded-lg flex items-center justify-center mt-1 flex-shrink-0`}>
                            <span className={`text-${currentSolution.color}-400 font-bold text-sm`}>{index + 1}</span>
                          </div>
                          <div className="flex-1">
                            <h4 className="text-lg font-semibold text-white mb-2">{step.title}</h4>
                            <p className="text-gray-300 mb-4">{step.content}</p>
                            {step.example && (
                              <div className="bg-gray-900/50 rounded-lg p-4 border-l-4 border-green-500">
                                <div className="flex items-start space-x-2">
                                  <div className="w-6 h-6 bg-green-500/20 rounded-full flex items-center justify-center mt-0.5">
                                    <span className="text-green-400 text-xs">💡</span>
                                  </div>
                                  <div>
                                    <div className="text-green-300 font-medium text-sm mb-1">Example:</div>
                                    <div className="text-gray-300 text-sm italic">"{step.example}"</div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Action Button */}
                  <div className="mt-8 p-6 bg-gradient-to-r from-gray-900/50 to-gray-800/30 rounded-xl border border-gray-700">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="text-white font-semibold mb-1">Ready to Practice?</h4>
                        <p className="text-gray-400 text-sm">Use our AI coach to practice this framework</p>
                      </div>
                      <button className={`px-6 py-3 bg-${currentSolution.color}-600 hover:bg-${currentSolution.color}-700 text-white rounded-lg font-medium transition-colors`}>
                        Start Practice Session
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Quick Reference Card */}
      <section className="py-16 bg-gradient-to-r from-gray-900/50 to-gray-800/30 border-t border-gray-700">
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-4">Framework Quick Reference</h2>
              <p className="text-gray-300">Save these key points for your next interview</p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white/5 rounded-xl p-6">
                <h3 className={`text-${currentSolution.color}-300 font-semibold mb-4`}>Key Method</h3>
                <div className="text-2xl font-bold text-white mb-2">{currentFramework.method}</div>
                <p className="text-gray-300 text-sm">Primary framework for {currentSolution.title.toLowerCase()}</p>
              </div>
              
              <div className="bg-white/5 rounded-xl p-6">
                <h3 className={`text-${currentSolution.color}-300 font-semibold mb-4`}>Total Steps</h3>
                <div className="text-2xl font-bold text-white mb-2">{currentFramework.steps.length} Steps</div>
                <p className="text-gray-300 text-sm">Complete process with examples and scripts</p>
              </div>
            </div>

            <div className="mt-8 text-center">
              <button className={`px-8 py-4 bg-${currentSolution.color}-600 hover:bg-${currentSolution.color}-700 text-white rounded-lg font-semibold transition-colors mr-4`}>
                Download Framework PDF
              </button>
              <button className="px-8 py-4 border border-gray-700 text-gray-300 rounded-lg font-semibold hover:border-gray-600 hover:text-white transition-colors">
                Schedule Coaching Session
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default InteractiveSolutionsDashboard;
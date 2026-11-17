"use client";

import { useState } from "react";
import Link from "next/link";

const InteractiveSolutionsDashboard = () => {
  const [activeSolution, setActiveSolution] = useState("ai-displacement");
  const [activeFramework, setActiveFramework] = useState(0);

  const solutions = {
    "ai-displacement": {
      title: "AI Displacement Defense",
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
            { title: "Voice Projection", content: "A little more energy than feels normal", example: "Practice with recording - energy should match in-person enthusiasm" },
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

  const currentSolution = solutions[activeSolution as keyof typeof solutions];
  const currentFramework = currentSolution.frameworks[activeFramework];

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <header className="px-1">
        <p className="text-[12px] font-medium uppercase tracking-[0.1em] text-[var(--text-4)]">Interview frameworks</p>
        <h1 className="font-display text-[26px] sm:text-[30px] font-semibold tracking-[-0.02em] text-white mt-2">Action plans for hard questions</h1>
        <p className="text-[14px] text-[var(--text-3)] mt-1.5 max-w-2xl">Step by step frameworks, scripts and examples for the situations that come up in a job search.</p>
      </header>

      {/* Solution picker */}
      <div role="tablist" aria-label="Situation" className="flex flex-wrap gap-2">
        {Object.entries(solutions).map(([key, solution]) => {
          const on = activeSolution === key;
          return (
            <button key={key} role="tab" aria-selected={on} onClick={() => { setActiveSolution(key); setActiveFramework(0); }}
              className={`h-9 px-3.5 rounded-lg text-[13px] font-medium transition-colors ring-1 ring-inset ${on ? 'bg-white/[0.08] text-white ring-white/[0.16]' : 'text-[var(--text-3)] ring-white/[0.07] hover:text-white hover:bg-white/[0.04]'}`}>
              {solution.title}
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] gap-6">
        {/* Framework list */}
        <aside className="glass-card p-5 self-start lg:sticky lg:top-[88px]">
          <h2 className="font-display text-[15px] font-semibold text-white">{currentSolution.title}</h2>
          <p className="text-[12.5px] text-[var(--text-4)] mt-1">{currentSolution.description}</p>
          <p className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--text-5)] mt-5 mb-2">Frameworks</p>
          <div className="space-y-1.5">
            {currentSolution.frameworks.map((framework, index) => {
              const on = activeFramework === index;
              return (
                <button key={index} onClick={() => setActiveFramework(index)}
                  className={`w-full px-3 py-2.5 rounded-lg text-left transition-colors ${on ? 'bg-white/[0.07] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.12)]' : 'hover:bg-white/[0.04]'}`}>
                  <span className={`block text-[13px] font-medium ${on ? 'text-white' : 'text-[var(--text-2)]'}`}>{framework.name}</span>
                  <span className="block text-[11.5px] text-[var(--text-4)] mt-0.5">{framework.method}</span>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Framework steps */}
        <section className="glass-card p-5 sm:p-7 min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="font-display text-[19px] font-semibold tracking-[-0.01em] text-white">{currentFramework.name}</h3>
            <span className="inline-flex items-center h-7 px-2.5 rounded-lg text-[12px] font-medium text-[var(--text-2)] bg-white/[0.05] ring-1 ring-inset ring-white/[0.08]">{currentFramework.method}</span>
          </div>
          <ol className="mt-6 space-y-3">
            {currentFramework.steps.map((step, index) => (
              <li key={index} className="flex items-start gap-4 rounded-xl p-4 ring-1 ring-inset ring-white/[0.06] bg-white/[0.015]">
                <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-white/[0.06] text-[12px] font-semibold text-[var(--text-2)] tabular-nums">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <h4 className="text-[14px] font-semibold text-white">{step.title}</h4>
                  <p className="text-[13px] text-[var(--text-3)] mt-1 leading-relaxed">{step.content}</p>
                  {step.example && (
                    <p className="mt-3 text-[12.5px] text-[var(--text-2)] leading-relaxed border-l-2 border-white/[0.14] pl-3">
                      <span className="text-[var(--text-4)]">Example: </span>&ldquo;{step.example}&rdquo;
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl p-4 ring-1 ring-inset ring-white/[0.06]">
            <div>
              <p className="text-[13.5px] font-medium text-white">Practice it out loud</p>
              <p className="text-[12.5px] text-[var(--text-4)] mt-0.5">Run a mock interview and use this framework in your answers.</p>
            </div>
            <Link href="/interview/create" className="btn-primary justify-center">Start a mock interview</Link>
          </div>
        </section>
      </div>
    </div>
  );
};

export default InteractiveSolutionsDashboard;
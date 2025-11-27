// lib/ai/ai-recommendations-engine.ts
/**
 * Dynamic AI Recommendations Engine
 * Analyzes interview performance and resume data to generate personalized recommendations
 */

export interface AIRecommendation {
  category: "technical" | "behavioral" | "system-design" | "coding" | "communication" | "resume" | "career";
  title: string;
  description: string;
  priority: "high" | "medium" | "low";
  estimatedTime: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  impact: string;
  confidence: number;
  resources: {
    title: string;
    url: string;
    type: "article" | "video" | "course" | "book" | "practice";
    rating?: number;
    users?: string;
  }[];
}

interface InterviewFeedback {
  categoryScores?: Record<string, number>;
  totalScore?: number;
}

interface Interview {
  feedback?: InterviewFeedback;
  score?: number;
}

interface ResumeFeedbackTip {
  type: string;
  message?: string;
}

interface ResumeFeedbackSection {
  score?: number;
  tips?: ResumeFeedbackTip[];
}

interface ResumeFeedback {
  overallScore?: number;
  [key: string]: number | ResumeFeedbackSection | undefined;
}

interface Resume {
  feedback?: ResumeFeedback;
}

interface InterviewAnalysis {
  weakestCategory: string;
  weakestScore: number;
  strongestCategory: string;
  strongestScore: number;
  averageScore: number;
  totalInterviews: number;
  recentTrend: 'improving' | 'declining' | 'stable';
  categoryScores: Record<string, number[]>;
}

interface ResumeAnalysis {
  averageScore: number;
  weakestSection: string;
  weakestScore: number;
  totalResumes: number;
  commonIssues: string[];
  improvementAreas: string[];
}

interface CategoryRecommendation {
  title: string;
  description: string;
  resources: Array<{
    title: string;
    url: string;
    type: "article" | "video" | "course" | "book" | "practice";
    rating?: number;
    users?: string;
  }>;
}

type RecommendationCategory = "technical" | "behavioral" | "system-design" | "coding" | "communication" | "resume" | "career";

/**
 * Analyze interview performance patterns
 */
export function analyzeInterviewPerformance(interviews: Interview[]): InterviewAnalysis {
  if (!interviews || interviews.length === 0) {
    return {
      weakestCategory: 'communication',
      weakestScore: 0,
      strongestCategory: 'communication',
      strongestScore: 0,
      averageScore: 0,
      totalInterviews: 0,
      recentTrend: 'stable',
      categoryScores: {}
    };
  }

  const categoryScores: Record<string, number[]> = {
    communication: [],
    technical: [],
    problemSolving: [],
    cultural: [],
    confidence: []
  };

  let totalScore = 0;

  // Collect all category scores from interviews
  interviews.forEach(interview => {
    if (interview.feedback?.categoryScores) {
      Object.entries(interview.feedback.categoryScores).forEach(([category, score]) => {
        const normalizedCategory = category.toLowerCase().replace(/[^a-z]/g, '');
        
        // Map various category names to standard categories
        if (normalizedCategory.includes('communication')) {
          categoryScores.communication.push(score);
        } else if (normalizedCategory.includes('technical') || normalizedCategory.includes('knowledge')) {
          categoryScores.technical.push(score);
        } else if (normalizedCategory.includes('problem') || normalizedCategory.includes('solving')) {
          categoryScores.problemSolving.push(score);
        } else if (normalizedCategory.includes('cultural') || normalizedCategory.includes('fit')) {
          categoryScores.cultural.push(score);
        } else if (normalizedCategory.includes('confidence') || normalizedCategory.includes('clarity')) {
          categoryScores.confidence.push(score);
        }
      });
    }

    if (interview.feedback?.totalScore) {
      totalScore += interview.feedback.totalScore;
    } else if (interview.score) {
      totalScore += interview.score;
    }
  });

  // Calculate average scores per category
  const categoryAverages: Record<string, number> = {};
  Object.entries(categoryScores).forEach(([category, scores]) => {
    if (scores.length > 0) {
      categoryAverages[category] = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    }
  });

  // Find weakest and strongest categories
  let weakestCategory = 'communication';
  let weakestScore = 100;
  let strongestCategory = 'communication';
  let strongestScore = 0;

  Object.entries(categoryAverages).forEach(([category, avgScore]) => {
    if (avgScore < weakestScore) {
      weakestScore = avgScore;
      weakestCategory = category;
    }
    if (avgScore > strongestScore) {
      strongestScore = avgScore;
      strongestCategory = category;
    }
  });

  // Determine trend from recent interviews
  const recentCount = Math.min(5, interviews.length);
  const recentInterviews = interviews.slice(0, recentCount);
  const olderInterviews = interviews.slice(recentCount);

  let recentTrend: 'improving' | 'declining' | 'stable' = 'stable';
  
  if (olderInterviews.length > 0) {
    const recentAvg = recentInterviews.reduce((sum, i) => 
      sum + (i.feedback?.totalScore || i.score || 0), 0) / recentCount;
    const olderAvg = olderInterviews.reduce((sum, i) => 
      sum + (i.feedback?.totalScore || i.score || 0), 0) / olderInterviews.length;
    
    if (recentAvg > olderAvg + 5) recentTrend = 'improving';
    else if (recentAvg < olderAvg - 5) recentTrend = 'declining';
  }

  return {
    weakestCategory,
    weakestScore: Math.round(weakestScore),
    strongestCategory,
    strongestScore: Math.round(strongestScore),
    averageScore: Math.round(totalScore / interviews.length),
    totalInterviews: interviews.length,
    recentTrend,
    categoryScores
  };
}

/**
 * Analyze resume data patterns
 */
export function analyzeResumeData(resumes: Resume[]): ResumeAnalysis {
  if (!resumes || resumes.length === 0) {
    return {
      averageScore: 0,
      weakestSection: 'ATS',
      weakestScore: 0,
      totalResumes: 0,
      commonIssues: [],
      improvementAreas: []
    };
  }

  const sectionScores: Record<string, number[]> = {
    ATS: [],
    content: [],
    structure: [],
    skills: [],
    toneAndStyle: []
  };

  const allIssues: string[] = [];

  // Collect section scores and issues
  resumes.forEach(resume => {
    if (resume.feedback) {
      Object.entries(resume.feedback).forEach(([section, data]) => {
        if (section === 'overallScore') return;
        
        // Type guard to check if data is a section object with score
        if (data && typeof data === 'object' && 'score' in data) {
          const sectionData = data as ResumeFeedbackSection;
          if (sectionData.score !== undefined && sectionScores[section]) {
            sectionScores[section].push(sectionData.score);
          }

          // Collect improvement tips
          if (sectionData.tips && Array.isArray(sectionData.tips)) {
            sectionData.tips.forEach((tip: ResumeFeedbackTip) => {
              if (tip.type === 'improve' && tip.message) {
                allIssues.push(tip.message);
              }
            });
          }
        }
      });
    }
  });

  // Calculate section averages
  const sectionAverages: Record<string, number> = {};
  Object.entries(sectionScores).forEach(([section, scores]) => {
    if (scores.length > 0) {
      sectionAverages[section] = scores.reduce((sum, score) => sum + score, 0) / scores.length;
    }
  });

  // Find weakest section
  let weakestSection = 'ATS';
  let weakestScore = 100;

  Object.entries(sectionAverages).forEach(([section, avgScore]) => {
    if (avgScore < weakestScore) {
      weakestScore = avgScore;
      weakestSection = section;
    }
  });

  // Find common issues (issues appearing in multiple resumes)
  const issueFrequency: Record<string, number> = {};
  allIssues.forEach(issue => {
    const normalized = issue.toLowerCase().trim();
    issueFrequency[normalized] = (issueFrequency[normalized] || 0) + 1;
  });

  const commonIssues = Object.entries(issueFrequency)
    .filter(([, count]) => count >= 2 || resumes.length === 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([issue]) => issue);

  // Determine improvement areas
  const improvementAreas: string[] = [];
  Object.entries(sectionAverages).forEach(([section, score]) => {
    if (score < 70) {
      improvementAreas.push(section);
    }
  });

  const avgScore = resumes.reduce((sum, r) => 
    sum + (r.feedback?.overallScore || 0), 0) / resumes.length;

  return {
    averageScore: Math.round(avgScore),
    weakestSection,
    weakestScore: Math.round(weakestScore),
    totalResumes: resumes.length,
    commonIssues,
    improvementAreas
  };
}

/**
 * Generate dynamic AI recommendations based on data analysis
 */
export function generateDynamicAIRecommendations(
  interviews: Interview[],
  resumes: Resume[]
): AIRecommendation[] {
  const recommendations: AIRecommendation[] = [];
  
  // Analyze interview and resume data
  const interviewAnalysis = analyzeInterviewPerformance(interviews);
  const resumeAnalysis = analyzeResumeData(resumes);

  // INTERVIEW-BASED RECOMMENDATIONS
  if (interviews.length > 0) {
    
    // 1. Address weakest interview category
    if (interviewAnalysis.weakestScore < 70) {
      const categoryMap: Record<string, CategoryRecommendation> = {
        communication: {
          title: "Improve Communication Skills",
          description: `Your communication scores average ${interviewAnalysis.weakestScore}/100. Focus on structured responses using the STAR method (Situation, Task, Action, Result) to articulate your thoughts more clearly.`,
          resources: [
            {
              title: "STAR Method Interview Guide",
              url: "https://www.indeed.com/career-advice/interviewing/how-to-use-the-star-interview-response-technique",
              type: "article",
              rating: 4.7,
              users: "12K readers"
            },
            {
              title: "Effective Communication for Interviews",
              url: "https://www.coursera.org/learn/professional-interview-skills",
              type: "course",
              rating: 4.5,
              users: "45K students"
            }
          ]
        },
        technical: {
          title: "Strengthen Technical Knowledge",
          description: `Technical scores averaging ${interviewAnalysis.weakestScore}/100 suggest knowledge gaps. Review fundamental concepts and practice explaining technical topics clearly.`,
          resources: [
            {
              title: "System Design Interview Book",
              url: "https://www.amazon.com/System-Design-Interview-insiders-Second/dp/B08CMF2CQF",
              type: "book",
              rating: 4.8,
              users: "8K reviews"
            },
            {
              title: "LeetCode - Technical Interview Prep",
              url: "https://leetcode.com/",
              type: "practice",
              rating: 4.6,
              users: "1M+ users"
            }
          ]
        },
        problemSolving: {
          title: "Enhance Problem-Solving Abilities",
          description: `Problem-solving scores at ${interviewAnalysis.weakestScore}/100. Practice breaking down complex problems and explaining your thought process step-by-step.`,
          resources: [
            {
              title: "Cracking the Coding Interview",
              url: "https://www.crackingthecodinginterview.com/",
              type: "book",
              rating: 4.6,
              users: "45K reviews"
            },
            {
              title: "HackerRank Problem Solving",
              url: "https://www.hackerrank.com/domains/algorithms",
              type: "practice",
              rating: 4.5,
              users: "500K+ users"
            }
          ]
        },
        confidence: {
          title: "Build Interview Confidence",
          description: `Confidence scores at ${interviewAnalysis.weakestScore}/100. Practice mock interviews regularly and work on maintaining composure under pressure.`,
          resources: [
            {
              title: "Interview Confidence Building Course",
              url: "https://www.udemy.com/course/interview-confidence/",
              type: "course",
              rating: 4.4,
              users: "15K students"
            },
            {
              title: "Pramp - Free Mock Interviews",
              url: "https://www.pramp.com/",
              type: "practice",
              rating: 4.6,
              users: "200K+ users"
            }
          ]
        },
        cultural: {
          title: "Improve Cultural Fit Responses",
          description: `Cultural fit scores at ${interviewAnalysis.weakestScore}/100. Research company values and prepare stories that demonstrate alignment with organizational culture.`,
          resources: [
            {
              title: "Behavioral Interview Mastery",
              url: "https://www.themuse.com/advice/behavioral-interview-questions-answers-examples",
              type: "article",
              rating: 4.5,
              users: "50K readers"
            }
          ]
        }
      };

      const recommendation = categoryMap[interviewAnalysis.weakestCategory];
      if (recommendation) {
        recommendations.push({
          category: interviewAnalysis.weakestCategory as RecommendationCategory,
          title: recommendation.title,
          description: recommendation.description,
          priority: "high",
          estimatedTime: "2-3 weeks",
          difficulty: interviewAnalysis.weakestScore < 50 ? "beginner" : "intermediate",
          impact: "High - Will significantly improve interview performance",
          confidence: 90,
          resources: recommendation.resources
        });
      }
    }

    // 2. Trend-based recommendation
    if (interviewAnalysis.recentTrend === 'declining') {
      recommendations.push({
        category: "behavioral",
        title: "Reverse Performance Decline",
        description: "Your recent interview scores show a declining trend. Take a break, review your past successful interviews, and identify what changed.",
        priority: "high",
        estimatedTime: "1 week",
        difficulty: "intermediate",
        impact: "High - Prevent further performance drops",
        confidence: 85,
        resources: [
          {
            title: "Interview Performance Analysis",
            url: "https://www.themuse.com/advice/what-to-do-when-interviews-arent-going-well",
            type: "article",
            rating: 4.4,
            users: "8K readers"
          }
        ]
      });
    }

    // 3. Build on strengths
    if (interviewAnalysis.strongestScore >= 75 && interviewAnalysis.totalInterviews >= 3) {
      recommendations.push({
        category: interviewAnalysis.strongestCategory as RecommendationCategory,
        title: `Leverage Your ${interviewAnalysis.strongestCategory} Strength`,
        description: `Your ${interviewAnalysis.strongestCategory} skills score ${interviewAnalysis.strongestScore}/100! Use this as your foundation and lead with these strengths in interviews.`,
        priority: "low",
        estimatedTime: "Ongoing",
        difficulty: "advanced",
        impact: "Medium - Maximize your competitive advantage",
        confidence: 80,
        resources: [
          {
            title: "Showcasing Your Strengths in Interviews",
            url: "https://www.indeed.com/career-advice/interviewing/strengths-and-weaknesses",
            type: "article",
            rating: 4.5,
            users: "20K readers"
          }
        ]
      });
    }
  }

  // RESUME-BASED RECOMMENDATIONS
  if (resumes.length > 0) {
    
    // 4. Address weakest resume section
    if (resumeAnalysis.weakestScore < 75) {
      const sectionMap: Record<string, CategoryRecommendation> = {
        ATS: {
          title: "Optimize for ATS Systems",
          description: `Your ATS compatibility scores ${resumeAnalysis.weakestScore}/100. Use relevant keywords, proper formatting, and avoid graphics/tables that ATS systems can't parse.`,
          resources: [
            {
              title: "ATS-Friendly Resume Guide",
              url: "https://www.jobscan.co/blog/ats-resume/",
              type: "article",
              rating: 4.7,
              users: "50K readers"
            }
          ]
        },
        content: {
          title: "Enhance Resume Content Quality",
          description: `Content scores at ${resumeAnalysis.weakestScore}/100. Add quantifiable achievements, use action verbs, and tailor content to target roles.`,
          resources: [
            {
              title: "Writing Powerful Resume Bullets",
              url: "https://www.themuse.com/advice/185-powerful-verbs-that-will-make-your-resume-awesome",
              type: "article",
              rating: 4.6,
              users: "100K readers"
            }
          ]
        },
        structure: {
          title: "Improve Resume Structure",
          description: `Structure scores at ${resumeAnalysis.weakestScore}/100. Reorganize sections for better flow and ensure consistent formatting throughout.`,
          resources: [
            {
              title: "Resume Structure Best Practices",
              url: "https://www.indeed.com/career-advice/resumes-cover-letters/resume-format",
              type: "article",
              rating: 4.5,
              users: "75K readers"
            }
          ]
        },
        skills: {
          title: "Optimize Skills Section",
          description: `Skills scores at ${resumeAnalysis.weakestScore}/100. Add industry-relevant technical and soft skills with proficiency levels.`,
          resources: [
            {
              title: "Skills Section Guide",
              url: "https://www.indeed.com/career-advice/resumes-cover-letters/skills-to-put-on-resume",
              type: "article",
              rating: 4.6,
              users: "90K readers"
            }
          ]
        },
        toneAndStyle: {
          title: "Refine Professional Tone",
          description: `Tone scores at ${resumeAnalysis.weakestScore}/100. Maintain professional language, eliminate jargon, and ensure consistency.`,
          resources: [
            {
              title: "Professional Writing for Resumes",
              url: "https://www.grammarly.com/business/learn/resume-writing-tips/",
              type: "article",
              rating: 4.5,
              users: "60K readers"
            }
          ]
        }
      };

      const recommendation = sectionMap[resumeAnalysis.weakestSection];
      if (recommendation) {
        recommendations.push({
          category: "resume",
          title: recommendation.title,
          description: recommendation.description,
          priority: "high",
          estimatedTime: "3-5 days",
          difficulty: "intermediate",
          impact: "High - Dramatically improve application success rate",
          confidence: 88,
          resources: recommendation.resources
        });
      }
    }

    // 5. Common issues recommendation
    if (resumeAnalysis.commonIssues.length > 0) {
      recommendations.push({
        category: "resume",
        title: "Fix Recurring Resume Issues",
        description: `You have ${resumeAnalysis.commonIssues.length} recurring issues across resumes: ${resumeAnalysis.commonIssues.slice(0, 2).join('; ')}. Address these for consistency.`,
        priority: "medium",
        estimatedTime: "1-2 days",
        difficulty: "beginner",
        impact: "Medium - Ensure all resumes meet professional standards",
        confidence: 82,
        resources: [
          {
            title: "Common Resume Mistakes to Avoid",
            url: "https://www.themuse.com/advice/43-resume-tips-that-will-help-you-get-hired",
            type: "article",
            rating: 4.7,
            users: "120K readers"
          }
        ]
      });
    }

    // 6. Resume refresh if average score is good
    if (resumeAnalysis.averageScore >= 80 && resumeAnalysis.totalResumes >= 2) {
      recommendations.push({
        category: "resume",
        title: "Maintain Resume Excellence",
        description: `Great work! Your resume scores average ${resumeAnalysis.averageScore}/100. Keep updating with new achievements every 3-6 months.`,
        priority: "low",
        estimatedTime: "Quarterly",
        difficulty: "intermediate",
        impact: "Medium - Stay competitive in the job market",
        confidence: 75,
        resources: [
          {
            title: "Resume Maintenance Guide",
            url: "https://www.indeed.com/career-advice/resumes-cover-letters/how-often-to-update-resume",
            type: "article",
            rating: 4.4,
            users: "25K readers"
          }
        ]
      });
    }
  }

  // CAREER DEVELOPMENT RECOMMENDATIONS
  
  // 7. If both interviews and resumes exist
  if (interviews.length > 0 && resumes.length > 0) {
    const combinedScore = (interviewAnalysis.averageScore + resumeAnalysis.averageScore) / 2;
    
    if (combinedScore >= 75) {
      recommendations.push({
        category: "career",
        title: "Start Applying to Target Companies",
        description: `With interview scores at ${interviewAnalysis.averageScore}/100 and resume at ${resumeAnalysis.averageScore}/100, you're ready for applications. Focus on companies matching your profile.`,
        priority: "high",
        estimatedTime: "Ongoing",
        difficulty: "advanced",
        impact: "Very High - Begin your job search journey",
        confidence: 92,
        resources: [
          {
            title: "Strategic Job Search Guide",
            url: "https://www.linkedin.com/business/talent/blog/talent-acquisition/strategic-job-search",
            type: "article",
            rating: 4.6,
            users: "80K readers"
          },
          {
            title: "LinkedIn Job Search Optimization",
            url: "https://www.linkedin.com/help/linkedin/answer/a507508",
            type: "article",
            rating: 4.5,
            users: "100K readers"
          }
        ]
      });
    }
  }

  // 8. If no data yet
  if (interviews.length === 0 && resumes.length === 0) {
    recommendations.push({
      category: "career",
      title: "Start with Resume Upload",
      description: "Upload your resume first to get comprehensive AI feedback on ATS compatibility, content quality, and structure before starting interview practice.",
      priority: "high",
      estimatedTime: "30 minutes",
      difficulty: "beginner",
      impact: "High - Foundation for job search success",
      confidence: 95,
      resources: [
        {
          title: "Resume Writing Guide",
          url: "https://www.indeed.com/career-advice/resumes-cover-letters/how-to-make-a-resume",
          type: "article",
          rating: 4.7,
          users: "200K readers"
        }
      ]
    });
  }

  // Sort by priority and limit to top 5
  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
  return recommendations
    .sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority])
    .slice(0, 5);
}
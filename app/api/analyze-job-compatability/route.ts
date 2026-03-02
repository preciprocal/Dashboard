interface ExperienceItem {
  title?: string;
  company?: string;
  startDate?: string;
  endDate?: string;
  current?: boolean;
}

interface UserData {
  resume: ResumeData | null;
  skills: string[];
  experience: ExperienceItem[];
}

interface ResumeData {
  skills?: string[];
  experience?: ExperienceItem[];
  [key: string]: unknown;
}// app/api/analyze-job-compatibility/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { auth, db } from '@/firebase/admin';

interface JobData {
  title: string;
  company: string;
  location?: string;
  description?: string;
  requirements?: string[];
  skills?: string[];
}

interface CompatibilityMetrics {
  overallScore: number;
  skillsMatch: number;
  experienceLevel: number;
  cultureFit: number;
  requirementsMatch: number;
  breakdown?: {
    matchedSkills: string[];
    missingSkills: string[];
    recommendations: string[];
  };
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized - No token provided' },
        { status: 401 }
      );
    }

    const token = authHeader.split('Bearer ')[1];
    
    let decodedToken;
    try {
      decodedToken = await auth.verifyIdToken(token);
    } catch (error) {
      console.error('Token verification failed:', error);
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      );
    }

    const userId = decodedToken.uid;

    // Parse request body
    const body = await request.json();
    const { jobData } = body as { jobData: JobData };

    if (!jobData || !jobData.title || !jobData.company) {
      return NextResponse.json(
        { error: 'Invalid job data - missing required fields' },
        { status: 400 }
      );
    }

    // Fetch user's resume/profile data
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 404 }
      );
    }

    const userData = userDoc.data();
    const userResume = userData?.resumeData || null;
    const userSkills = (userData?.skills || []) as string[];
    const userExperience = (userData?.experience || []) as ExperienceItem[];

    // Calculate compatibility metrics
    const metrics = await calculateCompatibility(jobData, {
      resume: userResume,
      skills: userSkills,
      experience: userExperience
    });

    // Log the analysis for analytics
    await db.collection('job_analyses').add({
      userId,
      jobTitle: jobData.title,
      jobCompany: jobData.company,
      overallScore: metrics.overallScore,
      timestamp: new Date(),
      source: 'extension'
    });

    return NextResponse.json(metrics, { status: 200 });

  } catch (error) {
    console.error('Error analyzing job compatibility:', error);
    return NextResponse.json(
      { error: 'Failed to analyze job compatibility' },
      { status: 500 }
    );
  }
}

async function calculateCompatibility(
  jobData: JobData,
  userData: UserData
): Promise<CompatibilityMetrics> {
  
  // If no user data, return default low scores
  if (!userData.resume && userData.skills.length === 0) {
    return {
      overallScore: 0,
      skillsMatch: 0,
      experienceLevel: 0,
      cultureFit: 0,
      requirementsMatch: 0
    };
  }

  // Extract job requirements and skills
  const jobSkills = extractSkillsFromJob(jobData);
  const jobRequirements = jobData.requirements || [];

  // Calculate skills match
  const skillsMatch = calculateSkillsMatch(userData.skills, jobSkills);

  // Calculate experience level match
  const experienceLevel = calculateExperienceMatch(userData.experience, jobData);

  // Calculate requirements match
  const requirementsMatch = calculateRequirementsMatch(userData.resume, jobRequirements);

  // Calculate culture fit (simplified - could be enhanced with AI)
  const cultureFit = calculateCultureFit(userData.resume, jobData);

  // Calculate overall score (weighted average)
  const overallScore = Math.round(
    skillsMatch * 0.35 +
    experienceLevel * 0.25 +
    requirementsMatch * 0.25 +
    cultureFit * 0.15
  );

  // Generate breakdown
  const matchedSkills = userData.skills.filter(skill =>
    jobSkills.some(jobSkill =>
      jobSkill.toLowerCase().includes(skill.toLowerCase()) ||
      skill.toLowerCase().includes(jobSkill.toLowerCase())
    )
  );

  const missingSkills = jobSkills.filter(jobSkill =>
    !userData.skills.some(userSkill =>
      userSkill.toLowerCase().includes(jobSkill.toLowerCase()) ||
      jobSkill.toLowerCase().includes(userSkill.toLowerCase())
    )
  ).slice(0, 5); // Top 5 missing skills

  const recommendations = generateRecommendations(
    overallScore,
    skillsMatch,
    missingSkills
  );

  return {
    overallScore,
    skillsMatch: Math.round(skillsMatch),
    experienceLevel: Math.round(experienceLevel),
    cultureFit: Math.round(cultureFit),
    requirementsMatch: Math.round(requirementsMatch),
    breakdown: {
      matchedSkills,
      missingSkills,
      recommendations
    }
  };
}

function extractSkillsFromJob(jobData: JobData): string[] {
  const skills: string[] = [];
  
  if (jobData.skills) {
    skills.push(...jobData.skills);
  }

  // Extract from description
  if (jobData.description) {
    const commonSkills = [
      'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'React', 'Node.js',
      'SQL', 'AWS', 'Docker', 'Kubernetes', 'Git', 'Agile', 'REST API',
      'Machine Learning', 'Data Analysis', 'Excel', 'PowerPoint', 'Leadership'
    ];

    commonSkills.forEach(skill => {
      if (jobData.description!.toLowerCase().includes(skill.toLowerCase())) {
        skills.push(skill);
      }
    });
  }

  return [...new Set(skills)]; // Remove duplicates
}

function calculateSkillsMatch(userSkills: string[], jobSkills: string[]): number {
  if (jobSkills.length === 0) return 75; // Default if no skills specified

  const matchCount = userSkills.filter(userSkill =>
    jobSkills.some(jobSkill =>
      jobSkill.toLowerCase().includes(userSkill.toLowerCase()) ||
      userSkill.toLowerCase().includes(jobSkill.toLowerCase())
    )
  ).length;

  return Math.min((matchCount / jobSkills.length) * 100, 100);
}

function calculateExperienceMatch(experience: ExperienceItem[], jobData: JobData): number {
  if (!experience || experience.length === 0) return 50;

  // Calculate total years of experience
  const totalYears = experience.reduce((acc, exp) => {
    const start = exp.startDate ? new Date(exp.startDate) : new Date();
    const end = exp.endDate ? new Date(exp.endDate) : new Date();
    const years = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 365);
    return acc + years;
  }, 0);

  // Estimate required experience from job title
  const title = jobData.title.toLowerCase();
  let requiredYears = 0;

  if (title.includes('senior') || title.includes('lead')) {
    requiredYears = 5;
  } else if (title.includes('mid') || title.includes('intermediate')) {
    requiredYears = 3;
  } else if (title.includes('junior') || title.includes('entry')) {
    requiredYears = 1;
  } else {
    requiredYears = 2; // Default
  }

  // Calculate match
  if (totalYears >= requiredYears) {
    return Math.min(100, 80 + (totalYears - requiredYears) * 5);
  } else {
    return (totalYears / requiredYears) * 70;
  }
}

function calculateRequirementsMatch(resume: ResumeData | null, requirements: string[]): number {
  if (!resume || requirements.length === 0) return 70;

  const resumeText = JSON.stringify(resume).toLowerCase();
  
  const matchCount = requirements.filter(req =>
    resumeText.includes(req.toLowerCase())
  ).length;

  return Math.min((matchCount / requirements.length) * 100, 100);
}

function calculateCultureFit(resume: ResumeData | null, jobData: JobData): number {
  // Simplified culture fit - could be enhanced with AI analysis
  // For now, return a reasonable default based on company size indicators
  
  const description = (jobData.description || '').toLowerCase();
  let score = 70; // Base score

  // Positive indicators
  if (description.includes('collaborative') || description.includes('team')) {
    score += 5;
  }
  if (description.includes('innovative') || description.includes('creative')) {
    score += 5;
  }
  if (description.includes('growth') || description.includes('learning')) {
    score += 5;
  }

  return Math.min(score, 95); // Cap at 95
}

function generateRecommendations(
  overallScore: number,
  skillsMatch: number,
  missingSkills: string[]
): string[] {
  const recommendations: string[] = [];

  if (overallScore >= 80) {
    recommendations.push("Excellent match! Apply with confidence.");
  } else if (overallScore >= 60) {
    recommendations.push("Good match. Highlight your relevant experience.");
  } else {
    recommendations.push("Consider strengthening your application.");
  }

  if (skillsMatch < 70 && missingSkills.length > 0) {
    recommendations.push(`Consider learning: ${missingSkills.slice(0, 3).join(', ')}`);
  }

  if (overallScore < 60) {
    recommendations.push("Use AI interview prep to boost your chances.");
  }

  return recommendations;
}
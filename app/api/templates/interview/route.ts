// app/api/templates/interview/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { auth, db } from '@/firebase/admin';
import { getRandomInterviewCover } from '@/lib/utils';

// Define types for our template structure
interface InterviewTemplate {
  id: string;
  role: string;
  type: 'Technical' | 'Behavioral' | 'Mixed';
  techstack: string[];
  category: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  duration: string;
  questions: number;
  description: string;
  rating: number;
  completions: number;
  tags: string[];
}

interface InterviewData {
  role: string;
  type: string;
  level: string;
  techstack: string[];
  questions: string[];
  technicalQuestions: string[];
  behavioralQuestions: string[];
  questionCounts: {
    total: number;
    technical: number;
    behavioral: number;
  };
  userId: string;
  finalized: boolean;
  coverImage: string;
  createdAt: string;
  templateId: string;
  templateName: string;
  category: string;
  duration: string;
  difficulty: string;
  rating: number;
  completions: number;
  tags: string[];
  fromTemplate: boolean;
}

export async function POST(request: NextRequest) {
  try {
    console.log('🎯 Starting interview from template');

    // Authentication
    const cookieStore = await cookies();
    const session = cookieStore.get('session');

    if (!session) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const decodedClaims = await auth.verifySessionCookie(session.value, true);
    const userId = decodedClaims.uid;

    // Get template ID from request
    const body = await request.json();
    const { templateId } = body as { templateId: string };

    if (!templateId) {
      return NextResponse.json(
        { error: 'Template ID required' },
        { status: 400 }
      );
    }

    console.log('📋 Template ID:', templateId);

    // Import templates
    const { interviewTemplates } = await import('@/app/data/interviewTemplates');
    
    // Find the template
    const template = interviewTemplates.find(t => t.id === templateId);

    if (!template) {
      return NextResponse.json(
        { error: 'Template not found' },
        { status: 404 }
      );
    }

    console.log('✅ Template found:', template.role);

    // Generate questions based on template
    const technicalQuestions: string[] = [];
    const behavioralQuestions: string[] = [];

    // Generate technical questions if needed
    if (template.type === 'Technical' || template.type === 'Mixed') {
      const techCount = template.type === 'Mixed' 
        ? Math.floor(template.questions * 0.6) 
        : template.questions;
      
      technicalQuestions.push(
        ...generateTechnicalQuestions(template, techCount)
      );
    }

    // Generate behavioral questions if needed
    if (template.type === 'Behavioral' || template.type === 'Mixed') {
      const behavioralCount = template.type === 'Mixed'
        ? Math.ceil(template.questions * 0.4)
        : template.questions;
      
      behavioralQuestions.push(
        ...generateBehavioralQuestions(template, behavioralCount)
      );
    }

    // Combine all questions
    const allQuestions = [...behavioralQuestions, ...technicalQuestions];

    console.log('📝 Generated questions:', {
      total: allQuestions.length,
      technical: technicalQuestions.length,
      behavioral: behavioralQuestions.length
    });

    // Create interview object
    const interview: InterviewData = {
      role: template.role,
      type: template.type.toLowerCase(),
      level: template.difficulty.toLowerCase(),
      techstack: template.techstack,
      questions: allQuestions,
      technicalQuestions: technicalQuestions,
      behavioralQuestions: behavioralQuestions,
      questionCounts: {
        total: allQuestions.length,
        technical: technicalQuestions.length,
        behavioral: behavioralQuestions.length,
      },
      userId: userId,
      finalized: true,
      coverImage: getRandomInterviewCover(),
      createdAt: new Date().toISOString(),
      templateId: templateId,
      templateName: template.role,
      category: template.category,
      duration: template.duration,
      difficulty: template.difficulty,
      rating: template.rating,
      completions: template.completions,
      tags: template.tags || [],
      fromTemplate: true,
    };

    // Save to Firebase
    const docRef = await db.collection('interviews').add(interview);
    
    console.log('✅ Interview created:', docRef.id);

    return NextResponse.json({
      success: true,
      interviewId: docRef.id,
      interview: {
        ...interview,
        id: docRef.id
      },
      message: `Successfully created ${template.type} interview for ${template.role}`
    });

  } catch (error) {
    console.error('❌ Error creating interview from template:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { 
        error: 'Failed to create interview',
        details: errorMessage
      },
      { status: 500 }
    );
  }
}

// Helper function to generate technical questions based on template
function generateTechnicalQuestions(template: InterviewTemplate, count: number): string[] {
  const questions: string[] = [];
  const techStack = template.techstack.join(', ');
  const primaryTech = template.techstack[0];
  
  // Difficulty-based question complexity
  const difficultyLevel = template.difficulty;
  
  // Build comprehensive question pool
  const techQuestionPool: string[] = [
    // Architecture & Design
    `Explain the core architecture of ${primaryTech} and how it handles data flow.`,
    `How would you design a scalable ${template.role} system using ${techStack}?`,
    `Walk me through your approach to building a production-ready application with ${primaryTech}.`,
    `Describe the internal workings of ${primaryTech} and its key components.`,
    
    // Performance & Optimization
    `What are your strategies for optimizing performance in ${primaryTech} applications?`,
    `How do you identify and resolve performance bottlenecks in ${techStack}?`,
    `Explain your approach to caching and optimization in ${primaryTech}.`,
    `How would you handle high-traffic scenarios using ${primaryTech}?`,
    
    // Best Practices & Code Quality
    `What are the best practices for ${primaryTech} in production environments?`,
    `How do you ensure code quality and maintainability when working with ${techStack}?`,
    `Describe your testing strategy for ${primaryTech} applications.`,
    `How do you implement error handling and logging in ${techStack}?`,
    
    // Problem Solving
    `Describe a challenging bug you've encountered with ${primaryTech} and how you resolved it.`,
    `Walk me through debugging a complex issue in a ${primaryTech} application.`,
    `How would you troubleshoot a production outage in ${primaryTech}?`,
    
    // Integration & Implementation
    `How would you implement authentication and authorization in ${primaryTech}?`,
    `Explain your approach to database design for ${primaryTech} applications.`,
    `How do you handle state management in ${primaryTech}?`,
    `Describe your API design strategy when working with ${techStack}.`,
    
    // Security & Compliance
    `What security considerations are important when developing with ${primaryTech}?`,
    `How do you implement secure data handling in ${techStack}?`,
    `Explain your approach to API security in ${primaryTech}.`,
    
    // Advanced Topics (for intermediate/advanced)
    `How would you implement microservices architecture using ${techStack}?`,
    `Explain your approach to CI/CD for ${primaryTech} applications.`,
    `How do you handle concurrency and race conditions in ${primaryTech}?`,
    `Describe your experience with ${primaryTech} in cloud environments.`,
    
    // Technology Comparison
    `Compare ${primaryTech} with similar technologies you've used - what are the trade-offs?`,
    `When would you choose ${primaryTech} over alternatives?`,
    
    // Real-world Scenarios
    `How would you migrate a legacy system to ${primaryTech}?`,
    `Describe how you'd implement real-time features using ${techStack}.`,
    `Walk me through building a ${template.role} feature from scratch.`,
  ];

  // Add difficulty-specific questions
  if (difficultyLevel === 'Advanced') {
    techQuestionPool.push(
      `Explain the internals of ${primaryTech}'s runtime/engine and its optimization techniques.`,
      `How would you architect a distributed system using ${techStack}?`,
      `Describe your experience with performance profiling and optimization in ${primaryTech}.`,
      `How do you handle database sharding and partitioning in ${techStack}?`,
      `Explain your approach to building fault-tolerant systems with ${primaryTech}.`
    );
  } else if (difficultyLevel === 'Beginner') {
    techQuestionPool.push(
      `What is ${primaryTech} and when would you use it?`,
      `Explain the basic concepts of ${primaryTech}.`,
      `What are the main features of ${primaryTech}?`,
      `How did you learn ${primaryTech} and what resources did you use?`,
      `Describe a simple project you've built with ${primaryTech}.`
    );
  }

  // Category-specific questions
  if (template.category === 'Technology') {
    techQuestionPool.push(
      `How do you stay updated with the latest changes in ${primaryTech}?`,
      `What developer tools do you use when working with ${techStack}?`,
      `Describe your development workflow with ${primaryTech}.`
    );
  }

  // Shuffle and select questions
  const shuffled = techQuestionPool.sort(() => 0.5 - Math.random());
  questions.push(...shuffled.slice(0, count));

  return questions;
}

// Helper function to generate behavioral questions
function generateBehavioralQuestions(template: InterviewTemplate, count: number): string[] {
  const questions: string[] = [];
  
  const behavioralQuestionPool: string[] = [
    // Warm-up & Introduction (always include first)
    `Hi! Tell me about yourself and what brought you to ${template.role}.`,
    `It's great to meet you! What interests you most about this ${template.role} position?`,
    `Welcome! Walk me through your background and how you got into ${template.category}.`,
    
    // Motivation & Interest
    `Why are you interested in this ${template.role} role specifically?`,
    `What excites you most about working in ${template.category}?`,
    `What motivates you in your day-to-day work as a ${template.role}?`,
    `Where do you see yourself in your ${template.role} career in the next few years?`,
    
    // Experience & Achievement
    `Tell me about a project you're particularly proud of and why.`,
    `Describe your most challenging ${template.role} project and how you approached it.`,
    `What's the most impactful contribution you've made in your current or previous role?`,
    `Walk me through a successful project delivery you led or contributed to.`,
    
    // Teamwork & Collaboration
    `Describe a time when you had to work with a difficult team member. How did you handle it?`,
    `Tell me about a situation where you had to collaborate with cross-functional teams.`,
    `How do you handle disagreements with teammates or colleagues?`,
    `Describe your ideal team environment and why.`,
    
    // Problem Solving & Learning
    `Tell me about a time you had to learn something completely new quickly.`,
    `Describe a situation where you faced a major obstacle and how you overcame it.`,
    `How do you approach problems you've never encountered before?`,
    `Tell me about a mistake you made and what you learned from it.`,
    
    // Pressure & Deadlines
    `How do you handle tight deadlines and high-pressure situations?`,
    `Describe a time when you had to prioritize multiple urgent tasks.`,
    `Tell me about a situation where you had to make a decision with incomplete information.`,
    
    // Leadership & Initiative
    `Tell me about a time you showed leadership or took initiative.`,
    `Describe a situation where you influenced others without having formal authority.`,
    `Have you ever had to take ownership of something outside your job description?`,
    
    // Communication & Feedback
    `How do you communicate complex technical concepts to non-technical stakeholders?`,
    `Describe a time when you had to give difficult feedback to someone.`,
    `Tell me about a situation where effective communication solved a problem.`,
    
    // Professional Development
    `How do you stay updated with trends and developments in ${template.category}?`,
    `What professional development activities have you pursued recently?`,
    `What skills are you currently working on improving?`,
    
    // Closing & Vision
    `Why should we hire you for this ${template.role} role?`,
    `What would you do in your first 90 days if you got this position?`,
    `What questions do you have for us about the role or company?`,
    `How do you think your experience aligns with what we're looking for?`,
  ];

  // Ensure we start with greeting questions
  const greetingQuestions = behavioralQuestionPool.slice(0, 3);
  const otherQuestions = behavioralQuestionPool.slice(3);
  
  // Shuffle other questions
  const shuffled = otherQuestions.sort(() => 0.5 - Math.random());
  
  // Combine: always start with at least one greeting
  if (count >= 3) {
    questions.push(greetingQuestions[0]); // Always include first greeting
    questions.push(...shuffled.slice(0, count - 1));
  } else {
    questions.push(...greetingQuestions.slice(0, count));
  }

  return questions;
}

// GET endpoint for testing
export async function GET() {
  return NextResponse.json({
    success: true,
    message: 'Template Interview API is working!',
    endpoint: '/api/templates/interview',
    method: 'POST',
    requiredParams: {
      templateId: 'string'
    },
    features: [
      'Create interview from template',
      'Generate role-specific questions',
      'Support Technical, Behavioral, and Mixed interviews',
      'Difficulty-based question complexity',
      'Save to Firebase with metadata',
      'Track template usage'
    ]
  });
}
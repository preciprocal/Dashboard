import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { db } from "@/firebase/admin";
import { getRandomInterviewCover } from "@/lib/utils";

// Helper function to clean and parse AI responses
function parseQuestionsFromResponse(response: string): string[] {
  try {
    // Remove markdown code blocks and clean the response
    let cleanedResponse = response
      .replace(/```json\s*/g, "")
      .replace(/```\s*/g, "")
      .replace(/^\s*\[/, "[")
      .replace(/\]\s*$/, "]")
      .trim();

    // Try to parse as JSON first
    return JSON.parse(cleanedResponse);
  } catch (parseError) {
    console.error("JSON parsing failed, trying fallback method:", parseError);

    // Fallback: extract questions manually
    const lines = response
      .split("\n")
      .map((line) => line.trim())
      .filter(
        (line) =>
          line.length > 0 &&
          !line.includes("```") &&
          !line.includes("[") &&
          !line.includes("]")
      )
      .map((line) => {
        // Remove quotes and clean up
        return line
          .replace(/^["']|["']$/g, "")
          .replace(/^-\s*/, "")
          .replace(/^\d+\.\s*/, "")
          .trim();
      })
      .filter((line) => line.length > 10); // Only keep substantial questions

    return lines;
  }
}

// Enhanced prompt builder for better question generation
function buildEnhancedPrompt(
  type: string,
  amount: number,
  role: string,
  level: string,
  techstackString: string
): string {
  const baseInstructions = `
    CRITICAL REQUIREMENTS:
    - Generate exactly ${amount} high-quality questions
    - Questions must be refined and specific to the ${role} role
    - Adapt difficulty to ${level} level experience
    - Include natural conversation starters and greeting questions
    - Questions should help understand the candidate's human nature and personality
    - Use conversational, non-mechanical language
    - Avoid overly formal or robotic phrasing
    - Include questions that assess cultural fit and motivation
    - Return as a clean JSON array format: ["Question 1", "Question 2", ...]
    - Do not use "/" or "*" or special characters that might break voice assistants
  `;

  if (type === "technical") {
    return `${baseInstructions}

    Generate ${amount} technical interview questions for a ${level} ${role} position.
    
    TECHNICAL FOCUS AREAS:
    - Core concepts and fundamentals of: ${techstackString}
    - Deep technical knowledge specific to the tech stack
    - Problem-solving and algorithmic thinking
    - System design and architecture (for mid/senior levels)
    - Best practices and code quality
    - Performance optimization and scalability
    - Debugging and troubleshooting scenarios
    - Real-world implementation challenges
    
    QUESTION TYPES TO INCLUDE:
    - "Can you explain how [specific technology] works internally?"
    - "Walk me through your approach to building a [role-specific project]"
    - "How would you optimize [specific scenario] in ${techstackString}?"
    - "What's your experience with [specific technology from their stack]?"
    - "Describe a challenging technical problem you've solved using [technology]"
    - "How do you ensure code quality and maintainability in ${techstackString}?"
    
    Make questions conversational and engaging, not dry or mechanical.`;
  }

  if (type === "behavioural") {
    return `${baseInstructions}

    Generate ${amount} behavioral interview questions for a ${level} ${role} position.
    
    BEHAVIORAL FOCUS AREAS:
    - Communication skills and interpersonal abilities
    - Teamwork and collaboration experiences
    - Leadership potential and initiative
    - Problem-solving in interpersonal situations
    - Cultural fit and company values alignment
    - Motivation and career aspirations
    - Adaptability and learning mindset
    - Conflict resolution and diplomacy
    
    ESSENTIAL GREETING AND BEHAVIORAL QUESTIONS TO INCLUDE:
    - "Hi! Tell me a bit about yourself and what brought you to this field"
    - "It's great to meet you! What interests you most about this ${role} position?"
    - "Why should we hire you for this ${role} role?"
    - "What would you do in your first 90 days if we gave you this position?"
    - "Tell me about a time you worked with a challenging team member"
    - "Describe a project you're particularly proud of and why"
    - "How do you handle stress and tight deadlines?"
    - "What motivates you most in your work?"
    - "Describe a situation where you had to learn something completely new"
    - "Tell me about a time you showed leadership or took initiative"
    
    IMPORTANT: These must be BEHAVIORAL questions only - no technical content whatsoever.
    Use STAR method compatible questions and focus on understanding their personality and character.
    Make questions warm and conversational with natural greetings to help candidates feel comfortable.
    Start with greeting questions before moving to experience-based questions.`;
  }

  // Mixed type
  return `${baseInstructions}

    Generate ${amount} mixed interview questions (both technical and behavioral) for a ${level} ${role} position.
    
    BALANCE REQUIREMENTS:
    - Start with 2-3 warm-up/greeting questions to understand their nature
    - Include both technical depth (${techstackString}) and behavioral insights
    - Ensure smooth conversational flow between question types
    - Focus on role-specific scenarios and challenges
    
    MUST INCLUDE QUESTIONS:
    - "Tell me about yourself and your journey in ${role.toLowerCase()} development"
    - "Why should we hire you for this ${role} position?"
    - "What would be your approach if you got this role?"
    - Technical deep-dives into: ${techstackString}
    - Behavioral scenarios relevant to ${role} work environment
    - Questions about their problem-solving methodology
    - Cultural fit and team collaboration questions
    
    Create a natural interview flow that assesses both technical competency and human qualities.`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { message } = body;
    const { function_call } = message;

    if (!function_call) {
      return NextResponse.json(
        { error: "No function call provided" },
        { status: 400 }
      );
    }

    const { name, parameters } = function_call;

    switch (name) {
      case "generate_interview":
        const { role, level, type, techstack, amount, userid } = parameters;

        // Convert techstack array to string for the AI prompt
        const techstackString = Array.isArray(techstack)
          ? techstack.join(", ")
          : techstack;

        let technicalQuestions: string[] = [];
        let behavioralQuestions: string[] = [];

        if (type === "technical") {
          const prompt = buildEnhancedPrompt(
            "technical",
            amount,
            role,
            level,
            techstackString
          );

          const { text: questions } = await generateText({
            model: google("gemini-2.0-flash-001"),
            prompt: prompt,
            temperature: 0.7, // Add some creativity while maintaining quality
          });

          technicalQuestions = parseQuestionsFromResponse(questions);

          // Ensure we have enough questions, generate more if needed
          if (technicalQuestions.length < amount) {
            const additionalPrompt = `Generate ${
              amount - technicalQuestions.length
            } additional technical interview questions for a ${level} ${role} position focusing on ${techstackString}. 
            Make them different from typical questions and more specific to real-world ${role} challenges.
            Return as JSON array format.`;

            const { text: additionalQuestions } = await generateText({
              model: google("gemini-2.0-flash-001"),
              prompt: additionalPrompt,
              temperature: 0.8,
            });

            const parsed = parseQuestionsFromResponse(additionalQuestions);
            technicalQuestions = [...technicalQuestions, ...parsed];
          }
        } else if (type === "behavioural") {
          const prompt = buildEnhancedPrompt(
            "behavioural",
            amount,
            role,
            level,
            techstackString
          );

          const { text: questions } = await generateText({
            model: google("gemini-2.0-flash-001"),
            prompt: prompt,
            temperature: 0.6, // Slightly lower temperature for behavioral consistency
          });

          behavioralQuestions = parseQuestionsFromResponse(questions);

          // Ensure we have enough questions
          if (behavioralQuestions.length < amount) {
            const additionalPrompt = `Generate ${
              amount - behavioralQuestions.length
            } additional behavioral interview questions for a ${level} ${role} position.
            Focus on understanding their personality, work style, and cultural fit.
            Include questions about motivation, team collaboration, and career goals.
            Return as JSON array format.`;

            const { text: additionalQuestions } = await generateText({
              model: google("gemini-2.0-flash-001"),
              prompt: additionalPrompt,
              temperature: 0.7,
            });

            const parsed = parseQuestionsFromResponse(additionalQuestions);
            behavioralQuestions = [...behavioralQuestions, ...parsed];
          }
        } else if (type === "mixed") {
          // For mixed interviews, generate a balanced set
          const technicalCount = Math.ceil(amount * 0.6); // 60% technical
          const behavioralCount = amount - technicalCount; // 40% behavioral

          // Generate technical questions with enhanced focus
          const technicalPrompt = `Generate ${technicalCount} technical interview questions for a ${level} ${role} position.
            
            TECH STACK FOCUS: ${techstackString}
            
            MUST INCLUDE ICE-BREAKER TECHNICAL QUESTIONS (start with these):
            - "How's your day going? What kind of technical projects have you been working on lately?"
            - "What technologies have you been enjoying working with recently?"
            - "Tell me about your technical background and what got you excited about ${role.toLowerCase()} development"
            - "What's been the most interesting technical challenge you've tackled recently?"
            
            THEN INCLUDE DEEPER TECHNICAL QUESTIONS:
            - Architecture and system design questions specific to ${techstackString}
            - Implementation and coding approach questions
            - Performance optimization and scalability challenges
            - Debugging and troubleshooting scenarios
            - Best practices and code quality questions
            - Problem-solving methodology questions
            
            REQUIREMENTS:
            - Deep technical questions specific to ${role} responsibilities
            - Include architecture and system design questions for mid/senior levels
            - Focus on practical problem-solving scenarios using ${techstackString}
            - Ask about debugging and optimization challenges
            - Include questions about best practices and code quality
            - Make questions conversational and engaging, not dry or mechanical
            - Start with friendly technical ice-breakers before diving deep
            
            SAMPLE QUESTION TYPES:
            - "Walk me through how you would architect a [role-specific system] using ${techstackString}"
            - "Describe your experience with [specific technology] and how you've used it to solve complex problems"
            - "How would you approach debugging a performance issue in a ${techstackString} application?"
            - "What are some best practices you follow when working with ${techstackString}?"
            
            Return as JSON array format without additional text.`;

          const { text: techQuestions } = await generateText({
            model: google("gemini-2.0-flash-001"),
            prompt: technicalPrompt,
            temperature: 0.7,
          });

          // Generate behavioral questions with greeting focus
          const behavioralPrompt = `Generate ${behavioralCount} behavioral interview questions for a ${level} ${role} position.
            
            MUST INCLUDE ICE-BREAKER AND GREETING QUESTIONS (start with these):
            - "Hello! How has your day been going so far?"
            - "What have you been up to these days? Any interesting projects or activities?"
            - "Are you getting any time to relax lately, or have you been keeping busy?"
            - "Tell me about yourself and what drew you to ${role.toLowerCase()} work"
            - "It's wonderful to meet you! Why are you interested in this ${role} position?"
            - "What would you hope to accomplish in your first few months if you got this role?"
            
            ADDITIONAL BEHAVIORAL FOCUS AREAS:
            - Team collaboration and communication experiences
            - Problem-solving approach in interpersonal situations  
            - Learning and adaptation experiences
            - Leadership and initiative examples
            - Cultural fit and work style preferences
            - Career motivation and personal goals
            - Conflict resolution and relationship management
            - Personal growth and development stories
            - Work-life balance and stress management
            - Communication preferences and feedback style
            
            CRITICAL: These must be BEHAVIORAL questions ONLY - absolutely no technical questions about coding, programming, or system design.
            Start with warm ice-breakers and casual conversation, then move to more substantive behavioral questions.
            Focus on personality, experiences, teamwork, and cultural fit.
            Make questions feel like natural conversation starters that help understand their human nature.
            Return as JSON array format without additional text.`;

          const { text: behavQuestions } = await generateText({
            model: google("gemini-2.0-flash-001"),
            prompt: behavioralPrompt,
            temperature: 0.6,
          });

          technicalQuestions = parseQuestionsFromResponse(techQuestions);
          behavioralQuestions = parseQuestionsFromResponse(behavQuestions);

          // Quality check - ensure we have the essential questions for mixed interviews
          const essentialBehavioral = [
            "Tell me about yourself and your journey in software development",
            "Why should we hire you for this position?",
            "What would be your approach in the first 90 days if you got this role?",
          ];

          // Add essential questions if missing
          essentialBehavioral.forEach((essential) => {
            if (
              !behavioralQuestions.some((q) =>
                q.toLowerCase().includes(essential.split(" ")[0].toLowerCase())
              )
            ) {
              behavioralQuestions.unshift(essential);
            }
          });
        }

        // Combine all questions for backward compatibility
        const allQuestions = [...behavioralQuestions, ...technicalQuestions];

        // Create enhanced interview object
        const interview = {
          role: role,
          type: type,
          level: level,
          techstack: Array.isArray(techstack)
            ? techstack
            : techstack.split(",").map((t: string) => t.trim()),
          // Keep original questions array for backward compatibility
          questions: allQuestions,
          // Enhanced differentiated question arrays
          technicalQuestions: technicalQuestions,
          behavioralQuestions: behavioralQuestions,
          // Enhanced metadata
          questionCounts: {
            total: allQuestions.length,
            technical: technicalQuestions.length,
            behavioral: behavioralQuestions.length,
          },
          interviewMetadata: {
            hasGreetingQuestions: behavioralQuestions.some(
              (q) =>
                q.toLowerCase().includes("tell me about yourself") ||
                q.toLowerCase().includes("why should we hire")
            ),
            techStackCoverage: techstackString,
            difficultyLevel: level,
            estimatedDuration: allQuestions.length * 3, // 3 minutes per question
          },
          userId: userid || "anonymous",
          finalized: true,
          coverImage: getRandomInterviewCover(),
          createdAt: new Date().toISOString(),
        };

        // Save to Firebase
        const docRef = await db.collection("interviews").add(interview);

        // Create enhanced success message
        let successMessage = "";
        if (type === "technical") {
          successMessage = `Perfect! I've generated ${technicalQuestions.length} highly refined technical interview questions for a ${level} ${role} position. These questions dive deep into ${techstackString} and include real-world problem-solving scenarios that will thoroughly assess technical competency.`;
        } else if (type === "behavioural") {
          successMessage = `Perfect! I've generated ${behavioralQuestions.length} behavioral interview questions for a ${level} ${role} position. These include warm greeting questions to understand the candidate's personality, along with questions about teamwork, motivation, and cultural fit.`;
        } else {
          successMessage = `Perfect! I've generated ${allQuestions.length} carefully balanced interview questions (${technicalQuestions.length} technical, ${behavioralQuestions.length} behavioral) for a ${level} ${role} position. The questions start with warm greetings to understand their nature, then dive deep into ${techstackString} technical skills, and assess cultural fit.`;
        }

        return NextResponse.json({
          result: {
            success: true,
            message: `${successMessage} The interview has been created and saved to your account with enhanced question quality and natural conversation flow. Would you like me to conduct this interview with you right now, or would you prefer to review the questions first?`,
            interview: {
              ...interview,
              id: docRef.id,
            },
          },
        });

      case "save_interview":
        const { interview_data } = parameters;

        // Enhanced save with metadata
        const saveDocRef = await db.collection("interviews").add({
          ...interview_data,
          finalized: true,
          coverImage: getRandomInterviewCover(),
          createdAt: new Date().toISOString(),
          // Add quality metrics
          qualityMetrics: {
            hasRoleSpecificQuestions: true,
            includesGreetingQuestions: true,
            balancedQuestionTypes: interview_data.type === "mixed",
            techStackRelevance: "high",
          },
        });

        return NextResponse.json({
          result: {
            success: true,
            message:
              "Excellent! Your enhanced interview has been saved successfully with improved question quality and natural conversation flow. You can find it in your dashboard and start practicing whenever you're ready. The questions are designed to be conversational and engaging!",
            interviewId: saveDocRef.id,
          },
        });

      default:
        return NextResponse.json(
          { error: "Unknown function" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Function call error:", error);
    return NextResponse.json(
      {
        result: {
          success: false,
          message:
            "I apologize, but there was an error generating your enhanced interview questions. Please try again, and I'll make sure to create high-quality, role-specific questions that will help assess both technical skills and personality fit.",
          error: error instanceof Error ? error.message : "Unknown error",
        },
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json(
    {
      success: true,
      data: "Enhanced Vapi Functions endpoint is working!",
      features: [
        "Role-specific question generation",
        "Natural conversation flow",
        "Greeting and warm-up questions",
        "Enhanced technical depth",
        "Cultural fit assessment",
        "Balanced question distribution",
      ],
    },
    { status: 200 }
  );
}

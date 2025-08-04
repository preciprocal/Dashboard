// app/api/gemini/analyze-job/route.ts
import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

interface GeminiAnalysis {
  role: string;
  level: "entry" | "mid" | "senior";
  type: "behavioural" | "technical" | "mixed";
  techstack: string[];
  confidence: number;
  reasoning: string;
}

export async function POST(request: NextRequest) {
  try {
    const { jobDescription } = await request.json();

    if (!jobDescription || typeof jobDescription !== "string") {
      return NextResponse.json(
        { error: "Job description is required" },
        { status: 400 }
      );
    }

    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "Gemini API key not configured" },
        { status: 500 }
      );
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
Analyze the following job description and extract key information for interview preparation. 
Return a JSON response with the following structure:

{
  "role": "specific job title/role",
  "level": "entry" | "mid" | "senior",
  "type": "behavioural" | "technical" | "mixed",
  "techstack": ["array", "of", "technologies"],
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation of analysis"
}

Guidelines:
- Role: Extract the most specific job title mentioned or infer from responsibilities
- Level: 
  * entry: 0-2 years, junior, graduate, intern, entry-level
  * mid: 2-5 years, mid-level, some experience required
  * senior: 5+ years, senior, lead, principal, architect, expert level
- Type:
  * technical: Focus on coding, system design, technical skills
  * behavioural: Focus on soft skills, culture fit, leadership
  * mixed: Combination of both technical and behavioral aspects
- Techstack: Extract specific technologies, programming languages, frameworks, tools, platforms
- Confidence: How confident you are in the analysis (0.0-1.0)
- Reasoning: Brief explanation of key factors that influenced the analysis

Job Description:
${jobDescription}

Return only valid JSON, no additional text or formatting.
`;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    try {
      // Clean the response text to extract JSON
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error("No JSON found in response");
      }

      const analysis: GeminiAnalysis = JSON.parse(jsonMatch[0]);

      // Validate the response structure
      if (
        !analysis.role ||
        !analysis.level ||
        !analysis.type ||
        !Array.isArray(analysis.techstack)
      ) {
        throw new Error("Invalid response structure");
      }

      // Ensure level is valid
      if (!["entry", "mid", "senior"].includes(analysis.level)) {
        analysis.level = "mid"; // default fallback
      }

      // Ensure type is valid
      if (!["behavioural", "technical", "mixed"].includes(analysis.type)) {
        analysis.type = "technical"; // default fallback
      }

      // Ensure confidence is a number between 0 and 1
      if (
        typeof analysis.confidence !== "number" ||
        analysis.confidence < 0 ||
        analysis.confidence > 1
      ) {
        analysis.confidence = 0.8; // default confidence
      }

      // Limit techstack to reasonable size
      if (analysis.techstack.length > 20) {
        analysis.techstack = analysis.techstack.slice(0, 20);
      }

      return NextResponse.json(analysis);
    } catch (parseError) {
      console.error("JSON parsing error:", parseError);
      console.error("Raw response:", text);

      // Return a fallback analysis if JSON parsing fails
      return NextResponse.json({
        role: extractBasicRole(jobDescription),
        level: extractBasicLevel(jobDescription),
        type: extractBasicType(jobDescription),
        techstack: extractBasicTechStack(jobDescription),
        confidence: 0.6,
        reasoning: "Fallback analysis due to AI response parsing error",
      });
    }
  } catch (error) {
    console.error("Gemini API error:", error);

    // Return fallback analysis
    const { jobDescription } = await request.json();
    return NextResponse.json({
      role: extractBasicRole(jobDescription),
      level: extractBasicLevel(jobDescription),
      type: extractBasicType(jobDescription),
      techstack: extractBasicTechStack(jobDescription),
      confidence: 0.5,
      reasoning: "Fallback pattern matching due to AI service unavailability",
    });
  }
}

// Fallback functions for basic pattern matching
function extractBasicRole(text: string): string {
  const lowerText = text.toLowerCase();

  const rolePatterns = [
    {
      pattern: /(frontend|front-end|front end).*(developer|engineer)/i,
      role: "Frontend Developer",
    },
    {
      pattern: /(backend|back-end|back end).*(developer|engineer)/i,
      role: "Backend Developer",
    },
    {
      pattern: /(fullstack|full-stack|full stack).*(developer|engineer)/i,
      role: "Full Stack Developer",
    },
    {
      pattern: /(react|reactjs).*(developer|engineer)/i,
      role: "React Developer",
    },
    {
      pattern: /(node|nodejs).*(developer|engineer)/i,
      role: "Node.js Developer",
    },
    {
      pattern: /(ui\/ux|ux\/ui|user experience|user interface).*(designer)/i,
      role: "UX/UI Designer",
    },
    { pattern: /(data scientist)/i, role: "Data Scientist" },
    { pattern: /(devops|dev ops).*(engineer)/i, role: "DevOps Engineer" },
    {
      pattern: /(software|web).*(developer|engineer)/i,
      role: "Software Developer",
    },
  ];

  for (const { pattern, role } of rolePatterns) {
    if (pattern.test(text)) {
      return role;
    }
  }

  return "Software Developer";
}

function extractBasicLevel(text: string): "entry" | "mid" | "senior" {
  const lowerText = text.toLowerCase();

  if (/(senior|lead|principal|staff|architect|expert|8\+|10\+)/i.test(text)) {
    return "senior";
  } else if (/(junior|entry|graduate|intern|0-2|entry.level)/i.test(text)) {
    return "entry";
  }

  return "mid";
}

function extractBasicType(text: string): "behavioural" | "technical" | "mixed" {
  const lowerText = text.toLowerCase();

  const behavioralKeywords =
    /(behavioral|behaviour|culture|team|leadership|communication|collaboration)/i;
  const technicalKeywords =
    /(technical|coding|programming|algorithm|system design|architecture)/i;

  const hasBehavioral = behavioralKeywords.test(text);
  const hasTechnical = technicalKeywords.test(text);

  if (hasBehavioral && hasTechnical) {
    return "mixed";
  } else if (hasBehavioral) {
    return "behavioural";
  }

  return "technical";
}

function extractBasicTechStack(text: string): string[] {
  const lowerText = text.toLowerCase();

  const techPatterns = [
    "react",
    "vue",
    "angular",
    "javascript",
    "typescript",
    "node.js",
    "nodejs",
    "python",
    "java",
    "c#",
    "csharp",
    "php",
    "ruby",
    "go",
    "rust",
    "swift",
    "kotlin",
    "html",
    "css",
    "sass",
    "scss",
    "tailwind",
    "bootstrap",
    "jquery",
    "express",
    "fastapi",
    "django",
    "flask",
    "spring",
    "laravel",
    "rails",
    "mongodb",
    "mysql",
    "postgresql",
    "postgres",
    "redis",
    "elasticsearch",
    "aws",
    "azure",
    "gcp",
    "google cloud",
    "docker",
    "kubernetes",
    "jenkins",
    "git",
    "github",
    "gitlab",
    "jira",
    "figma",
    "sketch",
    "webpack",
    "vite",
  ];

  return techPatterns.filter((tech) => lowerText.includes(tech.toLowerCase()));
}

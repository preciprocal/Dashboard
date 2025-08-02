// lib/question-processor.ts
import { CategorizedQuestion } from "@/constants";

export interface QuestionAnalytics {
  technical: number;
  behavioral: number;
  total: number;
  distribution: {
    technicalPercentage: number;
    behavioralPercentage: number;
  };
}

export interface ProcessedInterview {
  questions: CategorizedQuestion[];
  analytics: QuestionAnalytics;
  formattedForVAPI: string;
  voiceInstructions: string;
}

// Enhanced question type detection with more sophisticated analysis
export const detectQuestionType = (
  question: string
): "technical" | "behavioral" => {
  const questionLower = question.toLowerCase();

  // Strong technical indicators
  const strongTechnicalKeywords = [
    "implement",
    "algorithm",
    "data structure",
    "api",
    "database",
    "sql",
    "framework",
    "library",
    "code",
    "programming",
    "debugging",
    "architecture",
    "system design",
    "performance",
    "optimization",
    "security",
    "scalability",
    "rest",
    "graphql",
    "microservices",
    "deployment",
    "testing",
    "ci/cd",
  ];

  // Strong behavioral indicators
  const strongBehavioralKeywords = [
    "experience",
    "challenge",
    "team",
    "conflict",
    "leadership",
    "communication",
    "motivation",
    "goal",
    "strength",
    "weakness",
    "time management",
    "pressure",
    "deadline",
    "collaboration",
    "feedback",
    "learning",
    "growth",
    "culture",
    "values",
    "difficult situation",
    "disagreement",
    "initiative",
  ];

  // Technology-specific keywords
  const techKeywords = [
    "react",
    "angular",
    "vue",
    "node",
    "python",
    "java",
    "javascript",
    "typescript",
    "css",
    "html",
    "mongodb",
    "postgresql",
    "mysql",
    "redis",
    "docker",
    "kubernetes",
    "aws",
    "azure",
    "gcp",
    "git",
    "webpack",
    "babel",
    "npm",
    "yarn",
  ];

  // Question pattern analysis
  const questionPatterns = {
    technical: [
      /how (would|do) you (implement|build|design|create)/i,
      /what (is|are) the (difference|benefits|advantages)/i,
      /explain (how|what|why).*(works|algorithm|pattern|concept)/i,
      /write (a|an).*(function|method|class|component)/i,
      /design (a|an).*(system|application|database)/i,
    ],
    behavioral: [
      /tell me about (a time|an experience|when)/i,
      /describe (a situation|an instance|a time) when/i,
      /how do you (handle|deal with|manage)/i,
      /what would you do if/i,
      /give me an example of/i,
      /how do you work with/i,
    ],
  };

  // Calculate scores
  let technicalScore = 0;
  let behavioralScore = 0;

  // Strong keyword matching (higher weight)
  technicalScore += strongTechnicalKeywords.reduce(
    (score, keyword) => (questionLower.includes(keyword) ? score + 3 : score),
    0
  );

  behavioralScore += strongBehavioralKeywords.reduce(
    (score, keyword) => (questionLower.includes(keyword) ? score + 3 : score),
    0
  );

  // Technology keyword matching
  technicalScore += techKeywords.reduce(
    (score, keyword) => (questionLower.includes(keyword) ? score + 2 : score),
    0
  );

  // Pattern matching
  questionPatterns.technical.forEach((pattern) => {
    if (pattern.test(question)) technicalScore += 4;
  });

  questionPatterns.behavioral.forEach((pattern) => {
    if (pattern.test(question)) behavioralScore += 4;
  });

  // Contextual analysis
  if (questionLower.includes("previous") || questionLower.includes("past")) {
    behavioralScore += 2;
  }

  if (
    questionLower.includes("technical") ||
    questionLower.includes("development")
  ) {
    technicalScore += 2;
  }

  // Default fallback - if scores are equal, analyze question structure
  if (technicalScore === behavioralScore) {
    // Questions starting with "How would you..." are often behavioral
    if (/^how would you/i.test(question)) {
      behavioralScore += 1;
    }
    // Questions asking about specific implementations are technical
    if (/implement|create|build|design/i.test(question)) {
      technicalScore += 1;
    }
  }

  return technicalScore > behavioralScore ? "technical" : "behavioral";
};

// Process questions and categorize them
export const processQuestions = (
  questions: (string | CategorizedQuestion)[]
): ProcessedInterview => {
  const categorizedQuestions: CategorizedQuestion[] = questions.map(
    (q, index) => {
      if (typeof q === "string") {
        const type = detectQuestionType(q);
        return {
          id: `q_${index + 1}`,
          question: q,
          type,
          category:
            type === "technical"
              ? "Technical Assessment"
              : "Behavioral Assessment",
        };
      }
      return q;
    }
  );

  // Calculate analytics
  const technical = categorizedQuestions.filter(
    (q) => q.type === "technical"
  ).length;
  const behavioral = categorizedQuestions.filter(
    (q) => q.type === "behavioral"
  ).length;
  const total = categorizedQuestions.length;

  const analytics: QuestionAnalytics = {
    technical,
    behavioral,
    total,
    distribution: {
      technicalPercentage:
        total > 0 ? Math.round((technical / total) * 100) : 0,
      behavioralPercentage:
        total > 0 ? Math.round((behavioral / total) * 100) : 0,
    },
  };

  // Format questions for VAPI with clear voice switching instructions
  const formattedForVAPI = categorizedQuestions
    .map((q, index) => {
      const speaker = q.type === "technical" ? "TECHNICAL_LEAD" : "HR_MANAGER";
      const voiceInstruction =
        q.type === "technical" ? "[SWITCH_TO_NEHA]" : "[SWITCH_TO_SARAH]";
      return `${index + 1}. ${voiceInstruction} ${speaker}: ${q.question}`;
    })
    .join("\n");

  // Create voice switching instructions
  const voiceInstructions = `
VOICE SWITCHING PROTOCOL:
- Technical questions (${technical} total): Use Neha voice (Technical Lead)
- Behavioral questions (${behavioral} total): Use Sarah voice (HR Manager)
- Always call switch_voice function before changing question types
- Announce speaker change: "This is [Name] from [Department]"

QUESTION DISTRIBUTION:
- Technical: ${analytics.distribution.technicalPercentage}%
- Behavioral: ${analytics.distribution.behavioralPercentage}%
`;

  return {
    questions: categorizedQuestions,
    analytics,
    formattedForVAPI,
    voiceInstructions,
  };
};

// Generate interview flow with optimized voice switching
export const generateInterviewFlow = (
  categorizedQuestions: CategorizedQuestion[]
): string => {
  let currentVoice: "Neha" | "Sarah" | null = null;
  const flow: string[] = [];

  // Group questions by type for efficient voice switching
  const technicalQuestions = categorizedQuestions.filter(
    (q) => q.type === "technical"
  );
  const behavioralQuestions = categorizedQuestions.filter(
    (q) => q.type === "behavioral"
  );

  // Interleave questions for natural conversation flow
  const maxLength = Math.max(
    technicalQuestions.length,
    behavioralQuestions.length
  );
  const interleavedQuestions: CategorizedQuestion[] = [];

  for (let i = 0; i < maxLength; i++) {
    if (i < technicalQuestions.length) {
      interleavedQuestions.push(technicalQuestions[i]);
    }
    if (i < behavioralQuestions.length) {
      interleavedQuestions.push(behavioralQuestions[i]);
    }
  }

  flow.push("INTERVIEW FLOW WITH VOICE SWITCHING:");
  flow.push("=====================================");

  interleavedQuestions.forEach((question, index) => {
    const requiredVoice = question.type === "technical" ? "Neha" : "Sarah";
    const speaker =
      question.type === "technical" ? "Technical Lead" : "HR Manager";

    if (currentVoice !== requiredVoice) {
      flow.push(
        `\n[VOICE_SWITCH] Call switch_voice function with voiceId: "${requiredVoice}", speaker: "${speaker}"`
      );
      flow.push(
        `[INTRODUCTION] "Hi, this is ${
          requiredVoice === "Neha"
            ? "Neha, the technical lead"
            : "Sarah from HR"
        }"`
      );
      currentVoice = requiredVoice;
    }

    flow.push(
      `\n${index + 1}. [${question.type.toUpperCase()}] ${question.question}`
    );
    flow.push(`   [VOICE: ${requiredVoice}] [SPEAKER: ${speaker}]`);
  });

  return flow.join("\n");
};

// Validate question distribution for balanced interview
export const validateQuestionDistribution = (
  analytics: QuestionAnalytics
): {
  isBalanced: boolean;
  recommendations: string[];
  warnings: string[];
} => {
  const recommendations: string[] = [];
  const warnings: string[] = [];

  const { technicalPercentage, behavioralPercentage } = analytics.distribution;

  // Check for severely unbalanced distribution
  if (technicalPercentage > 80) {
    warnings.push(
      "Interview is heavily technical-focused. Consider adding behavioral questions for cultural fit assessment."
    );
  } else if (behavioralPercentage > 80) {
    warnings.push(
      "Interview is heavily behavioral-focused. Consider adding technical questions for skill assessment."
    );
  }

  // Optimal distribution recommendations
  if (technicalPercentage < 30 && analytics.total > 5) {
    recommendations.push(
      "Consider adding more technical questions to properly assess candidate's skills."
    );
  }

  if (behavioralPercentage < 30 && analytics.total > 5) {
    recommendations.push(
      "Consider adding more behavioral questions to assess cultural fit and soft skills."
    );
  }

  // Voice switching efficiency
  if (analytics.total > 10) {
    recommendations.push(
      "With this many questions, voice switching will create a dynamic interview experience."
    );
  }

  const isBalanced = technicalPercentage >= 30 && behavioralPercentage >= 30;

  return {
    isBalanced,
    recommendations,
    warnings,
  };
};

// Helper function to get voice configuration for a question type
export const getVoiceConfig = (questionType: "technical" | "behavioral") => {
  const configs = {
    technical: {
      voiceId: "Neha",
      speaker: "Technical Lead",
      name: "Neha",
      department: "Engineering",
      color: "blue",
    },
    behavioral: {
      voiceId: "Sarah",
      speaker: "HR Manager",
      name: "Sarah",
      department: "Human Resources",
      color: "pink",
    },
  };

  return configs[questionType];
};

// Create interview summary for display
export const createInterviewSummary = (
  processedInterview: ProcessedInterview
) => {
  const { analytics, questions } = processedInterview;

  return {
    totalQuestions: analytics.total,
    breakdown: {
      technical: {
        count: analytics.technical,
        percentage: analytics.distribution.technicalPercentage,
        voice: "Neha (Technical Lead)",
        questions: questions
          .filter((q) => q.type === "technical")
          .map((q) => q.question),
      },
      behavioral: {
        count: analytics.behavioral,
        percentage: analytics.distribution.behavioralPercentage,
        voice: "Sarah (HR Manager)",
        questions: questions
          .filter((q) => q.type === "behavioral")
          .map((q) => q.question),
      },
    },
    estimatedDuration: `${Math.ceil(analytics.total * 3)} minutes`,
    voiceSwitches: questions.reduce((switches, question, index) => {
      if (index === 0) return 0;
      const prevType = questions[index - 1].type;
      const currentType = question.type;
      return prevType !== currentType ? switches + 1 : switches;
    }, 0),
  };
};

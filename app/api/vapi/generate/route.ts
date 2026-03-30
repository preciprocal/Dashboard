// app/api/vapi/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { db } from "@/firebase/admin";
import { getRandomInterviewCover } from "@/lib/utils";
import { getUserAIContext, buildUserContextPrompt } from "@/lib/ai/user-context";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface FunctionCall { name: string; parameters: GenerateInterviewParams | SaveInterviewParams; }
interface Message { function_call?: FunctionCall; }
interface VapiRequest { message: Message; }
interface GenerateInterviewParams { role: string; level: string; type: 'technical' | 'behavioural' | 'mixed'; techstack: string | string[]; amount: number; userid?: string; jobDescription?: string; }
interface SaveInterviewParams { interview_data: InterviewData; }
interface InterviewData { role: string; type: string; level: string; techstack: string[]; questions: string[]; technicalQuestions?: string[]; behavioralQuestions?: string[]; userId?: string; }

function parseQuestionsFromResponse(response: string): string[] {
  try {
    const cleaned = response.replace(/```json\s*/g, "").replace(/```\s*/g, "").replace(/^\s*\[/, "[").replace(/\]\s*$/, "]").trim();
    return JSON.parse(cleaned) as string[];
  } catch {
    return response.split("\n").map(l => l.trim()).filter(l => l.length > 0 && !l.includes("```") && !l.includes("[") && !l.includes("]"))
      .map(l => l.replace(/^["']|["']$/g, "").replace(/^-\s*/, "").replace(/^\d+\.\s*/, "").trim()).filter(l => l.length > 10);
  }
}

function buildEnhancedPrompt(type: string, amount: number, role: string, level: string, techstackString: string, userContext: string): string {
  const base = `CRITICAL REQUIREMENTS:
- Generate exactly ${amount} high-quality questions
- Adapt difficulty to ${level} level
- Use conversational, non-mechanical language
- Return as a clean JSON array: ["Question 1", "Question 2", ...]
- Do not use "/" or "*" or special characters

${userContext ? `${userContext}\nIMPORTANT: Use the candidate's resume, transcript, and background above to personalise questions. Reference their specific experience, projects, and skills where possible.\n` : ''}`;

  if (type === "technical") {
    return `${base}
Generate ${amount} technical interview questions for a ${level} ${role} position.
FOCUS: Core concepts of ${techstackString}, problem-solving, system design (mid/senior), debugging, real-world challenges.
${userContext ? 'Tailor questions to the specific technologies and projects mentioned in their resume/transcript.' : ''}`;
  }
  if (type === "behavioural") {
    return `${base}
Generate ${amount} behavioral interview questions for a ${level} ${role} position.
FOCUS: Communication, teamwork, leadership, conflict resolution, motivation, adaptability.
Start with warm greeting questions. Use STAR-compatible questions.
${userContext ? 'Reference specific roles, companies, or experiences from their resume when forming questions.' : ''}
IMPORTANT: No technical content — behavioral only.`;
  }
  return `${base}
Generate ${amount} mixed interview questions for a ${level} ${role} position.
Start with 2-3 warm-up questions, then mix technical (${techstackString}) and behavioral.
${userContext ? 'Personalise questions based on their actual experience and academic background.' : ''}`;
}

async function generateQuestions(prompt: string, temperature = 0.7): Promise<string[]> {
  const completion = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    max_tokens: 2048,
    temperature,
    messages: [
      { role: 'system', content: 'You are an expert interview question generator. Return ONLY a valid JSON array of strings. No markdown, no preamble.' },
      { role: 'user', content: prompt },
    ],
  });
  const text = completion.choices[0]?.message?.content?.trim() ?? '[]';
  return parseQuestionsFromResponse(text);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as VapiRequest;
    const { message } = body;
    const { function_call } = message;
    if (!function_call) return NextResponse.json({ error: "No function call provided" }, { status: 400 });

    const { name, parameters } = function_call;

    switch (name) {
      case "generate_interview": {
        const { role, level, type, techstack, amount, userid, jobDescription } = parameters as GenerateInterviewParams;
        const techstackString = Array.isArray(techstack) ? techstack.join(", ") : techstack;

        // ── Fetch user context for personalised questions ──
        let userContextPrompt = '';
        if (userid && userid !== 'anonymous') {
          try {
            const ctx = await getUserAIContext(userid);
            userContextPrompt = buildUserContextPrompt(ctx);
            if (userContextPrompt) console.log(`✅ User context loaded for ${userid} (resume: ${!!ctx.resumeText}, transcript: ${!!ctx.transcriptText})`);
          } catch (err) {
            console.warn('⚠️ Failed to load user context (non-blocking):', err);
          }
        }

        // Add job description to context if provided
        if (jobDescription) {
          userContextPrompt += `\nJOB DESCRIPTION:\n${jobDescription.substring(0, 2000)}\n`;
        }

        let technicalQuestions: string[] = [];
        let behavioralQuestions: string[] = [];

        if (type === "technical") {
          const prompt = buildEnhancedPrompt("technical", amount, role, level, techstackString, userContextPrompt);
          technicalQuestions = await generateQuestions(prompt, 0.7);
          if (technicalQuestions.length < amount) {
            const extra = await generateQuestions(`Generate ${amount - technicalQuestions.length} additional technical questions for ${level} ${role} on ${techstackString}. Return JSON array.`, 0.8);
            technicalQuestions = [...technicalQuestions, ...extra];
          }
        } else if (type === "behavioural") {
          const prompt = buildEnhancedPrompt("behavioural", amount, role, level, techstackString, userContextPrompt);
          behavioralQuestions = await generateQuestions(prompt, 0.6);
          if (behavioralQuestions.length < amount) {
            const extra = await generateQuestions(`Generate ${amount - behavioralQuestions.length} additional behavioral questions for ${level} ${role}. Return JSON array.`, 0.7);
            behavioralQuestions = [...behavioralQuestions, ...extra];
          }
        } else if (type === "mixed") {
          const techCount = Math.ceil(amount * 0.6);
          const behavCount = amount - techCount;
          const [techQ, behavQ] = await Promise.all([
            generateQuestions(buildEnhancedPrompt("technical", techCount, role, level, techstackString, userContextPrompt), 0.7),
            generateQuestions(buildEnhancedPrompt("behavioural", behavCount, role, level, techstackString, userContextPrompt), 0.6),
          ]);
          technicalQuestions = techQ;
          behavioralQuestions = behavQ;

          const essentials = [
            "Tell me about yourself and your journey in software development",
            "Why should we hire you for this position?",
            "What would be your approach in the first 90 days if you got this role?",
          ];
          essentials.forEach(q => {
            if (!behavioralQuestions.some(bq => bq.toLowerCase().includes(q.split(" ")[0].toLowerCase()))) {
              behavioralQuestions.unshift(q);
            }
          });
        }

        const allQuestions = [...behavioralQuestions, ...technicalQuestions];

        const interview = {
          role, type, level,
          techstack: Array.isArray(techstack) ? techstack : techstack.split(",").map((t: string) => t.trim()),
          questions: allQuestions,
          technicalQuestions, behavioralQuestions,
          questionCounts: { total: allQuestions.length, technical: technicalQuestions.length, behavioral: behavioralQuestions.length },
          interviewMetadata: {
            hasGreetingQuestions: behavioralQuestions.some(q => q.toLowerCase().includes("tell me about yourself") || q.toLowerCase().includes("why should we hire")),
            techStackCoverage: techstackString,
            difficultyLevel: level,
            estimatedDuration: allQuestions.length * 3,
            personalisedWithResume: !!userContextPrompt,
          },
          userId: userid || "anonymous",
          finalized: true,
          coverImage: getRandomInterviewCover(),
          createdAt: new Date().toISOString(),
        };

        const docRef = await db.collection("interviews").add(interview);

        let successMessage = "";
        if (type === "technical") successMessage = `Generated ${technicalQuestions.length} technical questions for ${level} ${role} covering ${techstackString}.`;
        else if (type === "behavioural") successMessage = `Generated ${behavioralQuestions.length} behavioral questions for ${level} ${role}.`;
        else successMessage = `Generated ${allQuestions.length} balanced questions (${technicalQuestions.length} technical, ${behavioralQuestions.length} behavioral) for ${level} ${role}.`;

        return NextResponse.json({
          result: {
            success: true,
            message: `${successMessage} The interview has been created and saved.`,
            interview: { ...interview, id: docRef.id },
          },
        });
      }

      case "save_interview": {
        const { interview_data } = parameters as SaveInterviewParams;
        const saveDocRef = await db.collection("interviews").add({
          ...interview_data, finalized: true, coverImage: getRandomInterviewCover(), createdAt: new Date().toISOString(),
        });
        return NextResponse.json({ result: { success: true, message: "Interview saved successfully.", interviewId: saveDocRef.id } });
      }

      default:
        return NextResponse.json({ error: "Unknown function" }, { status: 400 });
    }
  } catch (error) {
    console.error("Function call error:", error);
    return NextResponse.json({ result: { success: false, message: "Error generating interview questions. Please try again.", error: error instanceof Error ? error.message : "Unknown error" } }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ success: true, data: "Interview generation endpoint (OpenAI)" }, { status: 200 });
}
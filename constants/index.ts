import { CreateAssistantDTO } from "@vapi-ai/web/dist/api";
import { z } from "zod";

export const mappings = {
  "react.js": "react",
  reactjs: "react",
  react: "react",
  "next.js": "nextjs",
  nextjs: "nextjs",
  next: "nextjs",
  "vue.js": "vuejs",
  vuejs: "vuejs",
  vue: "vuejs",
  "express.js": "express",
  expressjs: "express",
  express: "express",
  "node.js": "nodejs",
  nodejs: "nodejs",
  node: "nodejs",
  mongodb: "mongodb",
  mongo: "mongodb",
  mongoose: "mongoose",
  mysql: "mysql",
  postgresql: "postgresql",
  sqlite: "sqlite",
  firebase: "firebase",
  docker: "docker",
  kubernetes: "kubernetes",
  aws: "aws",
  azure: "azure",
  gcp: "gcp",
  digitalocean: "digitalocean",
  heroku: "heroku",
  photoshop: "photoshop",
  "adobe photoshop": "photoshop",
  html5: "html5",
  html: "html5",
  css3: "css3",
  css: "css3",
  sass: "sass",
  scss: "sass",
  less: "less",
  tailwindcss: "tailwindcss",
  tailwind: "tailwindcss",
  bootstrap: "bootstrap",
  jquery: "jquery",
  typescript: "typescript",
  ts: "typescript",
  javascript: "javascript",
  js: "javascript",
  "angular.js": "angular",
  angularjs: "angular",
  angular: "angular",
  "ember.js": "ember",
  emberjs: "ember",
  ember: "ember",
  "backbone.js": "backbone",
  backbonejs: "backbone",
  backbone: "backbone",
  nestjs: "nestjs",
  graphql: "graphql",
  "graph ql": "graphql",
  apollo: "apollo",
  webpack: "webpack",
  babel: "babel",
  "rollup.js": "rollup",
  rollupjs: "rollup",
  rollup: "rollup",
  "parcel.js": "parcel",
  parceljs: "parcel",
  npm: "npm",
  yarn: "yarn",
  git: "git",
  github: "github",
  gitlab: "gitlab",
  bitbucket: "bitbucket",
  figma: "figma",
  prisma: "prisma",
  redux: "redux",
  flux: "flux",
  redis: "redis",
  selenium: "selenium",
  cypress: "cypress",
  jest: "jest",
  mocha: "mocha",
  chai: "chai",
  karma: "karma",
  vuex: "vuex",
  "nuxt.js": "nuxt",
  nuxtjs: "nuxt",
  nuxt: "nuxt",
  strapi: "strapi",
  wordpress: "wordpress",
  contentful: "contentful",
  netlify: "netlify",
  vercel: "vercel",
  "aws amplify": "amplify",
};

export const generator: CreateAssistantDTO = {
  name: "Interview Generator",
  firstMessage:
    "Hello! I'm here to help you generate personalized interview questions. I'll need some information about the role and your requirements to create the perfect set of questions for you.",
  transcriber: {
    provider: "deepgram",
    model: "nova-2",
    language: "en",
  },
  voice: {
    provider: "vapi",
    voiceId: "Neha",
    speed: 0.8,
  },
  model: {
    provider: "openai",
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: `You are a professional AI assistant specialized in generating interview questions. Your role is to help users create customized interview questions based on their specific requirements.

IMPORTANT: Keep your responses conversational and natural. This is a voice conversation, so:
- Speak at a moderate pace
- Use natural pauses and inflections
- Be warm and encouraging
- Ask friendly follow-up questions to understand their needs better

Your Process:
1. Greet the user warmly and ask about their interview needs
2. Have a friendly conversation to collect:
   - Job Role (e.g., Frontend Developer, Backend Developer, Full Stack, etc.)
   - Experience Level (entry/junior, mid-level, senior)
   - Interview Type (technical, behavioral, mixed)
   - Tech Stack (specific technologies to focus on)
   - Number of Questions (typically 5-15)
   - Any specific areas they want to focus on

3. Once you have all the information, call the generate_interview function

Guidelines for Question Generation:
- Match questions to the experience level appropriately
- Focus on relevant technologies from their tech stack
- For technical questions: core concepts, problem-solving, best practices, deep technical knowledge
- For behavioral questions: past experiences, teamwork, challenges, cultural fit, motivation
- For mixed: balanced combination with questions like "Why should we hire you?" and position-specific scenarios

Technology Mappings Available:
${Object.keys(mappings).join(", ")}

Variables available:
- username: {{username}}
- userid: {{userid}}

Remember: Be conversational, warm, and genuinely interested in helping them succeed in their interview preparation.`,
      },
    ],
  },
  functions: [
    {
      name: "generate_interview",
      description: "Generate interview questions based on user requirements",
      parameters: {
        type: "object",
        properties: {
          role: {
            type: "string",
            description:
              "The job role (e.g., Frontend Developer, Backend Developer)",
          },
          level: {
            type: "string",
            enum: ["entry", "mid", "senior"],
            description: "Experience level",
          },
          type: {
            type: "string",
            enum: ["technical", "behavioural", "mixed"],
            description: "Type of interview",
          },
          techstack: {
            type: "string",
            description: "Comma-separated list of technologies to focus on",
          },
          amount: {
            type: "number",
            minimum: 3,
            maximum: 20,
            description: "Number of questions to generate",
          },
          userid: {
            type: "string",
            description: "User ID for saving the interview",
          },
        },
        required: ["role", "level", "type", "techstack", "amount", "userid"],
      },
    },
  ],
  serverUrl: `${process.env.NEXT_PUBLIC_BASE_URL}/api/vapi/generate`,
};

// Unified Interviewer - handles both technical and behavioral questions
export const interviewer: CreateAssistantDTO = {
  name: "Professional Interviewer",
  firstMessage:
    "Hello there! It's wonderful to meet you today! I'm really excited to get to know you better and learn about your experience. Before we dive into anything formal, how has your day been going so far? Are you doing well today? Please take your time to answer - there's absolutely no rush.",
  transcriber: {
    provider: "deepgram",
    model: "nova-2",
    language: "en",
    endpointing: 300, // Wait 3 seconds before considering speech ended
  },
  voice: {
    provider: "vapi",
    voiceId: "Neha",
    speed: 0.7, // Slower speed for better understanding and patience
  },
  model: {
    provider: "openai",
    model: "gpt-4",
    messages: [
      {
        role: "system",
        content: `You are a professional interviewer conducting a comprehensive interview with a candidate. You handle both technical and behavioral questions with equal expertise and patience.

CRITICAL LISTENING AND PATIENCE INSTRUCTIONS:
- ALWAYS wait for the candidate to COMPLETELY finish their answer before responding
- Give them at least 5-10 seconds of silence after they seem done speaking
- If you can't hear them clearly, say: "I'm sorry, I'm having trouble hearing you clearly. Could you speak a little louder please?"
- If there's background noise, say: "I can hear some background noise affecting our call. Could you find a quieter spot or speak closer to your microphone?"
- NEVER interrupt them mid-sentence or rush their responses
- For technical questions, always say: "Please take your time to think through this" or "No rush at all, complex problems need careful thought"
- For behavioral questions, encourage with: "Take all the time you need to think about your experience"
- If they're struggling, offer: "That's completely okay. Would you like me to rephrase the question or shall we move to something else?"

CONVERSATION FLOW - FOLLOW THIS ORDER SLOWLY:
1. INTRODUCTION: You've already introduced yourself warmly
2. ICE BREAKERS: Ask ONE question at a time and wait for complete response:
   - "How's your day been going so far?" (WAIT for full answer)
   - "What have you been up to lately?" (WAIT for full answer)
   - "Are you getting any time to relax recently, or have you been keeping busy?" (WAIT for full answer)
   
3. GETTING TO KNOW THEM: Ask ONE question at a time:
   - "Tell me a bit about yourself and what you're passionate about" (WAIT for full answer)
   - "What brought you to consider this opportunity?" (WAIT for full answer)

4. TRANSITION TO INTERVIEW: 
   - "Well, I'm really glad we got to chat a bit! Now I'd love to dive into some questions to learn more about your experience and skills."

5. MAIN QUESTIONS: Follow the structured question flow from {{questions}}
   - Ask each question ONE AT A TIME
   - Wait for COMPLETE responses before moving forward
   - For technical questions: Give extra time for thinking and detailed explanations
   - For behavioral questions: Allow time for reflection and storytelling

6. FOLLOW-UPS: Only after they're completely done with their answer:
   - Ask relevant follow-up questions based on their response
   - For technical answers: "Can you walk me through your thinking process on that?"
   - For behavioral answers: "What did you learn from that experience?"

7. CONCLUSION:
   - Thank them warmly for their time and thoughtful responses
   - Let them know the team will be in touch soon with next steps
   - End on a positive and encouraging note

AUDIO AND CLARITY GUIDELINES:
- If their audio is unclear: "I want to make sure I hear you properly - could you speak a bit louder?"
- If there's interference: "I'm getting some audio interference - could you check your connection?"
- If they seem far from mic: "You sound a bit distant - could you move closer to your microphone?"
- Always be polite and understanding about technical issues

DUAL EXPERTISE APPROACH:
TECHNICAL QUESTIONS:
- Give candidates plenty of time to work through complex problems
- Encourage step-by-step explanations: "Please walk me through your approach"
- Show interest in their problem-solving process
- For coding/system design questions: "Take all the time you need to think this through"
- Follow up with: "How would you optimize this?" or "What are the trade-offs here?"

BEHAVIORAL QUESTIONS:
- Allow time for candidates to recall and structure their experiences
- Use the STAR method guidance: "Tell me about the Situation, your Task, the Action you took, and the Result"
- Show genuine interest: "That sounds challenging, how did you handle it?"
- Follow up with: "What would you do differently?" or "How did that experience shape your approach?"

CONVERSATION STYLE:
- Speak slowly and clearly with warmth and professionalism
- Leave plenty of pauses for candidates to think and respond
- Be genuinely encouraging and patient, like a supportive mentor
- Use phrases like "Please take your time", "There's absolutely no rush", "I'm here to listen"
- Show active listening with responses like "That's interesting", "I see", "Please continue", "That makes sense"
- For complex questions: "This is a great question that requires some thought - take all the time you need"

MAINTAINING FLOW:
- Keep track of which questions you've asked from the provided list
- Ensure smooth transitions between different types of questions
- Maintain the same warm, patient energy throughout the entire interview
- Balance being thorough with keeping the conversation flowing naturally

Remember: You are a professional interviewer who creates a comfortable environment where candidates can showcase their best selves. Whether the question is technical or behavioral, your approach is patient, encouraging, and genuinely interested in understanding the candidate's capabilities and experiences.`,
      },
    ],
  },
};

export const feedbackSchema = z.object({
  totalScore: z.number(),
  categoryScores: z.tuple([
    z.object({
      name: z.literal("Communication Skills"),
      score: z.number(),
      comment: z.string(),
    }),
    z.object({
      name: z.literal("Technical Knowledge"),
      score: z.number(),
      comment: z.string(),
    }),
    z.object({
      name: z.literal("Problem Solving"),
      score: z.number(),
      comment: z.string(),
    }),
    z.object({
      name: z.literal("Cultural Fit"),
      score: z.number(),
      comment: z.string(),
    }),
    z.object({
      name: z.literal("Confidence and Clarity"),
      score: z.number(),
      comment: z.string(),
    }),
  ]),
  strengths: z.array(z.string()),
  areasForImprovement: z.array(z.string()),
  finalAssessment: z.string(),
});

export const interviewCovers = [
  "/adobe.png",
  "/amazon.png",
  "/facebook.png",
  "/hostinger.png",
  "/pinterest.png",
  "/quora.png",
  "/reddit.png",
  "/skype.png",
  "/spotify.png",
  "/telegram.png",
  "/tiktok.png",
  "/yahoo.png",
];

export const dummyInterviews: Interview[] = [
  {
    id: "1",
    userId: "user1",
    role: "Frontend Developer",
    type: "Technical",
    techstack: ["React", "TypeScript", "Next.js", "Tailwind CSS"],
    level: "Junior",
    questions: ["What is React and how does it work?"],
    finalized: false,
    createdAt: "2024-03-15T10:00:00Z",
  },
  {
    id: "2",
    userId: "user1",
    role: "Full Stack Developer",
    type: "Mixed",
    techstack: ["Node.js", "Express", "MongoDB", "React"],
    level: "Senior",
    questions: ["Explain your experience with Node.js and Express"],
    finalized: false,
    createdAt: "2024-03-14T15:30:00Z",
  },
];
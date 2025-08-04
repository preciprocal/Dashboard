// data/chatbotKnowledge.ts

export interface ChatbotQA {
  id: string;
  category: string;
  keywords: string[];
  question: string;
  answer: string;
  priority: number;
  tags: string[];
  followUpQuestions?: string[];
}

// Core knowledge base with essential info
export const chatbotKnowledgeBase: ChatbotQA[] = [
  {
    id: "greeting",
    category: "conversational",
    keywords: ["hello", "hi", "hey", "yo", "wassup", "sup"],
    question: "Greeting",
    answer:
      "Yooo wassup! 🔥 I'm Alex, your AI homie who's bout to help you crush interviews! What's good?",
    priority: 10,
    tags: ["greeting"],
    followUpQuestions: ["How does this work?", "Pricing?", "Get started?"],
  },
  {
    id: "pricing",
    category: "pricing",
    keywords: ["price", "cost", "money", "plan", "expensive", "cheap", "free"],
    question: "Pricing",
    answer:
      "Bet! We got 3 plans:\n• Free - 10 interviews/month\n• Pro - $19/month unlimited\n• Premium - $39/month + human feedback\n\nFirst month free, no card needed fr! 💰",
    priority: 10,
    tags: ["pricing"],
    followUpQuestions: [
      "Start free trial?",
      "What's the difference?",
      "Can I cancel?",
    ],
  },
  {
    id: "how-it-works",
    category: "platform",
    keywords: ["how", "work", "process", "explain"],
    question: "How it works",
    answer:
      "Simple! Pick a company → Practice with AI interviewer → Get instant feedback → Improve and repeat. AI is trained on 100k real interviews so it's legit! 🤖",
    priority: 10,
    tags: ["process"],
    followUpQuestions: ["Which companies?", "How accurate?", "Try it now?"],
  },
  {
    id: "companies",
    category: "companies",
    keywords: ["companies", "google", "amazon", "microsoft", "faang", "which"],
    question: "Supported companies",
    answer:
      "We got 500+ companies! All the big tech (Google, Amazon, Microsoft), startups, consulting firms, finance - basically everywhere you wanna work! 🚀",
    priority: 9,
    tags: ["companies"],
    followUpQuestions: ["FAANG prep?", "Startup interviews?", "See full list?"],
  },
  {
    id: "success",
    category: "success",
    keywords: ["success", "results", "work", "effective", "hired"],
    question: "Success rate",
    answer:
      "Numbers don't lie - 98% success rate, 15k+ people hired, avg 47% salary increase! People getting offers in like 12 days avg. It's actually insane! 📈",
    priority: 9,
    tags: ["success"],
    followUpQuestions: [
      "Success stories?",
      "How long to see results?",
      "Guarantee?",
    ],
  },
  {
    id: "support",
    category: "support",
    keywords: ["help", "support", "human", "contact", "problem"],
    question: "Support",
    answer:
      "I gotchu! Live chat 24/7 (responds in 2 mins), email support@preciprocal.ai, or phone Mon-Fri. Real humans who actually know their stuff! 💬",
    priority: 8,
    tags: ["support"],
    followUpQuestions: ["Live chat now?", "Call support?", "Email issue?"],
  },
];

// Smart response generator that can handle any question
export class SmartChatbot {
  private knowledgeBase = chatbotKnowledgeBase;

  // Core company info for generating responses
  private companyInfo = {
    name: "Preciprocal AI",
    mission: "Help people crush interviews with AI coaching",
    pricing: {
      free: "10 interviews/month",
      pro: "$19/month unlimited",
      premium: "$39/month + human feedback",
    },
    stats: {
      successRate: "98%",
      peopleHired: "15,000+",
      avgSalaryIncrease: "47%",
      avgTimeToOffer: "12 days",
    },
    features: [
      "AI coaching",
      "500+ companies",
      "instant feedback",
      "progress tracking",
    ],
    support: {
      chat: "24/7 live chat",
      email: "support@preciprocal.ai",
      phone: "Mon-Fri 9AM-6PM PST",
    },
  };

  // GenZ phrases to mix into responses
  private genZPhrases = {
    positive: [
      "fr",
      "no cap",
      "bet",
      "lowkey fire",
      "that's crazy",
      "deadass",
      "facts",
      "goes hard",
    ],
    agreement: [
      "bet",
      "say less",
      "I gotchu",
      "for sure",
      "absolutely",
      "100%",
    ],
    excitement: [
      "that's fire",
      "insane",
      "goes crazy",
      "hits different",
      "mad good",
    ],
    casual: ["ngl", "tbh", "lowkey", "highkey", "kinda", "sorta", "prolly"],
  };

  generateResponse(userInput: string): string {
    const input = userInput.toLowerCase().trim();

    // Try exact match first
    const exactMatch = this.findExactMatch(input);
    if (exactMatch) return exactMatch.answer;

    // Generate smart response based on keywords and context
    return this.generateSmartResponse(input);
  }

  private findExactMatch(input: string): ChatbotQA | null {
    for (const item of this.knowledgeBase) {
      const keywordMatch = item.keywords.some((keyword) =>
        input.includes(keyword.toLowerCase())
      );
      if (keywordMatch) return item;
    }
    return null;
  }

  private generateSmartResponse(input: string): string {
    // Detect intent and generate appropriate response
    if (this.isQuestion(input)) {
      return this.handleQuestion(input);
    } else if (this.isComplaint(input)) {
      return this.handleComplaint(input);
    } else if (this.isPraise(input)) {
      return this.handlePraise(input);
    } else {
      return this.handleGeneral(input);
    }
  }

  private isQuestion(input: string): boolean {
    const questionWords = [
      "how",
      "what",
      "why",
      "when",
      "where",
      "who",
      "can",
      "will",
      "is",
      "do",
      "does",
      "?",
    ];
    return questionWords.some((word) => input.includes(word));
  }

  private isComplaint(input: string): boolean {
    const complaintWords = [
      "bad",
      "terrible",
      "awful",
      "hate",
      "broken",
      "sucks",
      "worst",
      "annoying",
    ];
    return complaintWords.some((word) => input.includes(word));
  }

  private isPraise(input: string): boolean {
    const praiseWords = [
      "good",
      "great",
      "awesome",
      "amazing",
      "love",
      "best",
      "perfect",
      "excellent",
    ];
    return praiseWords.some((word) => input.includes(word));
  }

  private handleQuestion(input: string): string {
    // Analyze what they're asking about
    if (
      input.includes("price") ||
      input.includes("cost") ||
      input.includes("money")
    ) {
      return `Bet! ${this.companyInfo.pricing.free} free, ${
        this.companyInfo.pricing.pro
      } Pro, ${
        this.companyInfo.pricing.premium
      } Premium. First month free ${this.randomPhrase("positive")}! 💰`;
    }

    if (input.includes("work") || input.includes("how")) {
      return `${this.randomPhrase(
        "agreement"
      )}! Pick company → AI interview → instant feedback → improve. AI trained on 100k real interviews so it ${this.randomPhrase(
        "excitement"
      )}! 🤖`;
    }

    if (
      input.includes("companies") ||
      input.includes("google") ||
      input.includes("amazon")
    ) {
      return `We got 500+ companies ${this.randomPhrase(
        "positive"
      )}! All FAANG, startups, consulting - basically everywhere. Which one you targeting? 🎯`;
    }

    if (
      input.includes("success") ||
      input.includes("results") ||
      input.includes("effective")
    ) {
      return `${this.companyInfo.stats.successRate} success rate, ${
        this.companyInfo.stats.peopleHired
      } hired, ${
        this.companyInfo.stats.avgSalaryIncrease
      } avg salary increase. Numbers ${this.randomPhrase(
        "excitement"
      )} ${this.randomPhrase("positive")}! 📈`;
    }

    if (
      input.includes("help") ||
      input.includes("support") ||
      input.includes("contact")
    ) {
      return `${this.randomPhrase("agreement")}! Live chat 24/7, email ${
        this.companyInfo.support.email
      }, or phone ${
        this.companyInfo.support.phone
      }. Real humans who actually know their stuff! 💬`;
    }

    if (
      input.includes("start") ||
      input.includes("begin") ||
      input.includes("sign up")
    ) {
      return `${this.randomPhrase(
        "excitement"
      )}! Go to preciprocal.ai, sign up with email (no card needed), pick your target role, start practicing. Takes like 5 mins ${this.randomPhrase(
        "positive"
      )}! ⚡`;
    }

    if (input.includes("free") || input.includes("trial")) {
      return `${this.randomPhrase(
        "positive"
      )} we got a legit free plan! 10 interviews/month + first month of any plan free. No card, no BS ${this.randomPhrase(
        "positive"
      )}! 🔥`;
    }

    if (input.includes("cancel") || input.includes("refund")) {
      return `${this.randomPhrase(
        "agreement"
      )}! Cancel anytime, 30-day money back, no fees. We not on that shady stuff ${this.randomPhrase(
        "positive"
      )}! ✌️`;
    }

    // Default question response
    return `${this.randomPhrase(
      "casual"
    )} that's a good question! ${this.randomPhrase(
      "agreement"
    )} but I might not have all the details. Hit up our live chat for the full breakdown - they know everything! 💬`;
  }

  private handleComplaint(input: string): string {
    return `Yo yo yo, ${this.randomPhrase(
      "agreement"
    )} I hear you and that's not the vibe! Let me get you connected to live chat rn so they can fix whatever's bugging out. They're actually clutch at solving stuff! 🛠️`;
  }

  private handlePraise(input: string): string {
    return `Ayy appreciate you! ${this.randomPhrase(
      "excitement"
    )} to hear that! We're just tryna help people bag their dream jobs ${this.randomPhrase(
      "positive"
    )}! Anything else I can help with? 🙌`;
  }

  private handleGeneral(input: string): string {
    const responses = [
      `${this.randomPhrase(
        "casual"
      )} I'm not 100% sure bout that specific thing, but our live chat team ${this.randomPhrase(
        "excitement"
      )}! They can help with literally anything. Want me to connect you?`,
      `${this.randomPhrase(
        "agreement"
      )} that's interesting! I might not have all the details tho. Live chat knows way more than me ${this.randomPhrase(
        "positive"
      )}! 💬`,
      `Hmm ${this.randomPhrase(
        "casual"
      )} that's outside my wheelhouse! But our support team deals with stuff like this daily. They're ${this.randomPhrase(
        "excitement"
      )} at helping! 🔥`,
    ];
    return responses[Math.floor(Math.random() * responses.length)];
  }

  private randomPhrase(type: keyof typeof this.genZPhrases): string {
    const phrases = this.genZPhrases[type];
    return phrases[Math.floor(Math.random() * phrases.length)];
  }
}

// Main function to get chatbot response
export const getChatbotResponse = (userInput: string): string => {
  const chatbot = new SmartChatbot();
  return chatbot.generateResponse(userInput);
};

// Legacy functions for backward compatibility
export const findBestMatch = (userInput: string): ChatbotQA | null => {
  const input = userInput.toLowerCase().trim();
  for (const item of chatbotKnowledgeBase) {
    const keywordMatch = item.keywords.some((keyword) =>
      input.includes(keyword.toLowerCase())
    );
    if (keywordMatch) return item;
  }
  return null;
};

export const getRandomFallbackResponse = (): string => {
  return getChatbotResponse("general question");
};

export const getCategorySuggestions = (category: string): string[] => {
  return [
    "How does it work?",
    "What's the pricing?",
    "Which companies?",
    "Success stories?",
    "Get started?",
    "Need help?",
  ];
};

export const getRelatedQuestions = (currentItem: ChatbotQA): string[] => {
  return (
    currentItem.followUpQuestions || [
      "Tell me more",
      "How do I start?",
      "Contact support",
    ]
  );
};

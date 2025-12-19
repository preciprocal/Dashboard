// lib/utils/ats-scorer.ts
import type {ResumeTip}  from '@/types/resume';

interface ATSScore {
  score: number;
  keywordScore: number;
  matchedKeywords: string[];
  missingKeywords: string[];
  tips: ResumeTip[];
  metrics: Record<string, number>;
}

export function calculateATSScore(
  resumeText: string,
  jobDescription?: string
): ATSScore {
  const text = resumeText.toLowerCase();
  const tips: ResumeTip[] = [];
  const metrics: Record<string, number> = {};

  // 1. Format check (40 points)
  let formatScore = 0;

  // Check for tables (bad for ATS)
  if (!text.includes('|') && !text.includes('─')) {
    formatScore += 10;
  } else {
    tips.push({
      type: 'critical',
      message: 'Avoid tables in your resume',
      explanation: 'ATS systems struggle to parse tabular data correctly',
      priority: 'high',
    });
  }

  // Check for images/graphics mentions
  if (!text.match(/\[image\]|\[graphic\]/i)) {
    formatScore += 10;
  } else {
    tips.push({
      type: 'warning',
      message: 'Remove images and graphics',
      explanation: 'ATS cannot read images - use text only',
      priority: 'high',
    });
  }

  // Check for standard section headers
  const standardSections = [
    'experience',
    'education',
    'skills',
    'summary',
    'objective',
  ];
  const foundSections = standardSections.filter(section =>
    text.includes(section)
  );

  formatScore += (foundSections.length / standardSections.length) * 20;
  metrics.sectionsFound = foundSections.length;

  if (foundSections.length < 3) {
    tips.push({
      type: 'warning',
      message: 'Use standard section headers',
      explanation: 'ATS looks for: Experience, Education, Skills, Summary',
      priority: 'medium',
    });
  }

  // 2. Keyword matching (40 points)
  let keywordScore = 0;
  const matchedKeywords: string[] = [];
  const missingKeywords: string[] = [];

  if (jobDescription) {
    const jdText = jobDescription.toLowerCase();

    // Extract likely keywords from JD
    const keywords = extractKeywordsFromText(jdText);

    keywords.forEach(keyword => {
      if (text.includes(keyword.toLowerCase())) {
        matchedKeywords.push(keyword);
      } else {
        missingKeywords.push(keyword);
      }
    });

    keywordScore = (matchedKeywords.length / keywords.length) * 40;
    metrics.keywordMatch = Math.round(
      (matchedKeywords.length / keywords.length) * 100
    );

    if (keywordScore < 20) {
      tips.push({
        type: 'critical',
        message: `Only ${matchedKeywords.length}/${keywords.length} job keywords found`,
        explanation: 'Add relevant keywords from the job description',
        priority: 'high',
      });
    }
  } else {
    keywordScore = 20; // Default if no JD
  }

  // 3. Content quality (20 points)
  let contentScore = 0;

  // Check for action verbs
  const actionVerbs = [
    'led',
    'managed',
    'developed',
    'created',
    'improved',
    'increased',
    'achieved',
    'implemented',
  ];
  const foundVerbs = actionVerbs.filter(verb => text.includes(verb));
  contentScore += (foundVerbs.length / actionVerbs.length) * 10;
  metrics.actionVerbs = foundVerbs.length;

  if (foundVerbs.length < 3) {
    tips.push({
      type: 'warning',
      message: 'Use more action verbs',
      explanation: 'Start bullet points with: Led, Managed, Developed, Achieved',
      priority: 'medium',
    });
  }

  // Check for quantifiable achievements
  const numberMatches = text.match(/\d+[%$kmb]?/g) || [];
  contentScore += Math.min(numberMatches.length / 5, 1) * 10;
  metrics.quantifiableResults = numberMatches.length;

  if (numberMatches.length < 3) {
    tips.push({
      type: 'warning',
      message: 'Add quantifiable results',
      explanation: 'Include numbers, percentages, and metrics (e.g., "Increased sales by 25%")',
      priority: 'high',
    });
  }

  // Calculate total
  const totalScore = Math.round(formatScore + keywordScore + contentScore);

  return {
    score: totalScore,
    keywordScore: Math.round(keywordScore),
    matchedKeywords,
    missingKeywords,
    tips,
    metrics,
  };
}

function extractKeywordsFromText(text: string): string[] {
  // Common tech skills, roles, and important terms
  const commonKeywords = [
    'python',
    'javascript',
    'react',
    'node',
    'aws',
    'docker',
    'sql',
    'agile',
    'scrum',
    'leadership',
    'management',
    'analysis',
    'design',
    'development',
  ];

  // Extract capitalized multi-word phrases (likely important terms)
  const phrases =
    text.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+/g) || [];

  // Extract all words, filter common ones
  const words = text
    .match(/\b[a-z]{3,}\b/g)
    ?.filter(
      word => !['the', 'and', 'with', 'for', 'this', 'that'].includes(word)
    ) || [];

  // Count frequency
  const frequency: Record<string, number> = {};
  words.forEach(word => {
    frequency[word] = (frequency[word] || 0) + 1;
  });

  // Get top keywords
  const topWords = Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([word]) => word);

  return [...new Set([...commonKeywords, ...phrases, ...topWords])].slice(0, 30);
}
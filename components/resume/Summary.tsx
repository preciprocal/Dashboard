// components/resume/Summary.tsx
import React from 'react';
import ScoreGauge from './ScoreGauge';
import ScoreBadge from './ScoreBadge';

interface FeedbackCategory {
  score: number;
  tips: Array<{
    type: "good" | "improve";
    tip: string;
    explanation: string;
  }>;
}

interface Feedback {
  overallScore: number;
  toneAndStyle: FeedbackCategory;
  content: FeedbackCategory;
  structure: FeedbackCategory;
  skills: FeedbackCategory;
}

interface CategoryProps {
  title: string;
  score: number;
}

const Category: React.FC<CategoryProps> = ({ title, score }) => {
  const textColor = score > 70 ? 'text-green-600'
    : score > 49
      ? 'text-yellow-600' : 'text-red-600';

  return (
    <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 last:border-b-0">
      <div className="flex items-center justify-between">
        <div className="flex flex-row gap-2 items-center">
          <p className="text-xl font-medium text-gray-900 dark:text-white">{title}</p>
          <ScoreBadge score={score} />
        </div>
        <p className="text-xl font-semibold">
          <span className={textColor}>{score}</span>
          <span className="text-gray-500 dark:text-gray-400">/100</span>
        </p>
      </div>
    </div>
  );
};

interface SummaryProps {
  feedback: Feedback;
}

const Summary: React.FC<SummaryProps> = ({ feedback }) => {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm w-full">
      {/* Header with Score Gauge */}
      <div className="flex flex-row items-center p-6 gap-8 border-b border-gray-100 dark:border-gray-700">
        <ScoreGauge score={feedback.overallScore} />

        <div className="flex flex-col gap-2">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Your Resume Score</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            This score is calculated based on the variables listed below.
          </p>
        </div>
      </div>

      {/* Category Breakdown */}
      <div>
        <Category title="Tone & Style" score={feedback.toneAndStyle.score} />
        <Category title="Content" score={feedback.content.score} />
        <Category title="Structure" score={feedback.structure.score} />
        <Category title="Skills" score={feedback.skills.score} />
      </div>
    </div>
  );
};

export default Summary;
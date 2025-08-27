// components/resume/ScoreCircle.tsx
interface ScoreCircleProps {
  score: number;
  size?: 'small' | 'medium' | 'large';
  showLabel?: boolean;
  className?: string;
}

export default function ScoreCircle({ score, size = 'medium', showLabel = false, className = '' }: ScoreCircleProps) {
  const dimensions = {
    small: { width: 'w-12', height: 'h-12', text: 'text-sm', radius: 18, strokeWidth: 4 },
    medium: { width: 'w-16', height: 'h-16', text: 'text-base', radius: 25, strokeWidth: 5 },
    large: { width: 'w-20', height: 'h-20', text: 'text-lg', radius: 30, strokeWidth: 6 }
  };

  const { width, height, text, radius, strokeWidth } = dimensions[size];
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const getScoreColor = (score: number) => {
    if (score >= 80) return { text: 'text-green-600 dark:text-green-400', stroke: 'stroke-green-600 dark:stroke-green-400' };
    if (score >= 60) return { text: 'text-yellow-600 dark:text-yellow-400', stroke: 'stroke-yellow-600 dark:stroke-yellow-400' };
    return { text: 'text-red-600 dark:text-red-400', stroke: 'stroke-red-600 dark:stroke-red-400' };
  };

  const getScoreLabel = (score: number) => {
    if (score >= 90) return 'Excellent';
    if (score >= 80) return 'Very Good';
    if (score >= 70) return 'Good';
    if (score >= 60) return 'Fair';
    return 'Needs Work';
  };

  const colors = getScoreColor(score);

  return (
    <div className={`relative ${width} ${height} flex flex-col items-center ${className}`}>
      <svg className={`${width} ${height} transform -rotate-90`} viewBox="0 0 80 80">
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="transparent"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          className="text-gray-200 dark:text-gray-600"
        />
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="transparent"
          stroke="currentColor"
          strokeWidth={strokeWidth}
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className={`transition-all duration-1000 ease-out ${colors.stroke}`}
          style={{
            animation: 'draw-circle 1.5s ease-out forwards'
          }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`font-bold ${text} ${colors.text}`}>
          {score}
        </span>
      </div>
      {showLabel && (
        <span className={`mt-1 text-xs font-medium ${colors.text}`}>
          {getScoreLabel(score)}
        </span>
      )}
      
      <style jsx>{`
        @keyframes draw-circle {
          from {
            stroke-dashoffset: ${circumference};
          }
          to {
            stroke-dashoffset: ${strokeDashoffset};
          }
        }
      `}</style>
    </div>
  );
}
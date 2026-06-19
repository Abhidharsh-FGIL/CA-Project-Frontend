import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Brain, Clock, Zap, Trophy, Lock, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuizCardProps {
  id: string;
  title: string;
  type: 'daily' | 'practice' | 'mastery';
  topic?: string;
  questionCount: number;
  pointsReward: number;
  timeLimit?: number;
  isCompleted?: boolean;
  score?: number;
  maxScore?: number;
  isLocked?: boolean;
  unlockRequirement?: string;
  expiresAt?: string;
  onStart: (id: string) => void;
  className?: string;
}

const typeConfig = {
  daily: {
    icon: Sparkles,
    label: 'Daily Challenge',
    color: 'text-yellow-500',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
  },
  practice: {
    icon: Brain,
    label: 'Practice Quiz',
    color: 'text-blue-500',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
  },
  mastery: {
    icon: Trophy,
    label: 'Mastery Check',
    color: 'text-purple-500',
    bgColor: 'bg-purple-500/10',
    borderColor: 'border-purple-500/30',
  },
};

export function QuizCard({
  id,
  title,
  type,
  topic,
  questionCount,
  pointsReward,
  timeLimit,
  isCompleted,
  score,
  maxScore,
  isLocked,
  unlockRequirement,
  expiresAt,
  onStart,
  className,
}: QuizCardProps) {
  const config = typeConfig[type];
  const Icon = config.icon;
  const scorePercent = score && maxScore ? (score / maxScore) * 100 : 0;
  
  const timeRemaining = expiresAt ? new Date(expiresAt).getTime() - Date.now() : null;
  const hoursRemaining = timeRemaining ? Math.max(0, Math.floor(timeRemaining / (1000 * 60 * 60))) : null;

  return (
    <Card className={cn(
      "relative overflow-hidden transition-all hover:shadow-md",
      isLocked && "opacity-60",
      isCompleted && "border-green-500/30 bg-green-50/50 dark:bg-green-950/20",
      !isLocked && !isCompleted && config.borderColor,
      className
    )}>
      {/* Type Badge */}
      <div className={cn("absolute top-0 right-0 px-3 py-1 rounded-bl-lg text-xs font-medium", config.bgColor, config.color)}>
        {config.label}
      </div>

      <CardHeader className="pb-2">
        <div className="flex items-start gap-3">
          <div className={cn("p-2 rounded-lg", config.bgColor)}>
            <Icon className={cn("h-5 w-5", config.color)} />
          </div>
          <div className="flex-1 min-w-0 pr-16">
            <CardTitle className="text-base truncate">{title}</CardTitle>
            {topic && <CardDescription className="truncate">{topic}</CardDescription>}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Quiz Info */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <span className="flex items-center gap-1">
            <Brain className="h-4 w-4" />
            {questionCount} questions
          </span>
          {timeLimit && (
            <span className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              {Math.floor(timeLimit / 60)} min
            </span>
          )}
          <span className="flex items-center gap-1">
            <Zap className="h-4 w-4 text-yellow-500" />
            +{pointsReward} XP
          </span>
        </div>

        {/* Expiry Timer */}
        {hoursRemaining !== null && hoursRemaining > 0 && !isCompleted && (
          <Badge variant="outline" className="text-orange-500 border-orange-500/30">
            ⏳ Expires in {hoursRemaining}h
          </Badge>
        )}

        {/* Completed State */}
        {isCompleted && score !== undefined && maxScore !== undefined && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Score</span>
              <span className="font-medium">{score}/{maxScore} ({Math.round(scorePercent)}%)</span>
            </div>
            <Progress value={scorePercent} className="h-2" />
            {scorePercent === 100 && (
              <Badge className="bg-green-500/10 text-green-500 border-green-500/30">
                🌟 Perfect Score!
              </Badge>
            )}
          </div>
        )}

        {/* Locked State */}
        {isLocked && unlockRequirement && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Lock className="h-4 w-4" />
            <span>{unlockRequirement}</span>
          </div>
        )}

        {/* Action Button */}
        <Button
          className="w-full"
          variant={isCompleted ? "outline" : "default"}
          disabled={isLocked}
          onClick={() => onStart(id)}
        >
          {isLocked ? (
            <>
              <Lock className="h-4 w-4 mr-2" />
              Locked
            </>
          ) : isCompleted ? (
            'View Results'
          ) : (
            <>
              <Zap className="h-4 w-4 mr-2" />
              Start Quiz
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

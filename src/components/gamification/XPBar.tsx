import { usePersona } from '@/contexts/PersonaContext';
import { cn } from '@/lib/utils';
import { Star, Flame, Trophy, Target, BookOpen } from 'lucide-react';

interface XPBarProps {
  current: number;
  max: number;
  className?: string;
}

export function XPBar({ current, max, className }: XPBarProps) {
  const { persona } = usePersona();
  const percentage = Math.min((current / max) * 100, 100);

  const getIcon = () => {
    switch (persona.progressStyle) {
      case 'stars':
        return <Star className="h-4 w-4 text-xp fill-xp" />;
      case 'quests':
        return <Target className="h-4 w-4 text-primary" />;
      case 'xp':
        return <Flame className="h-4 w-4 text-streak" />;
      case 'mastery':
        return <Trophy className="h-4 w-4 text-mastery" />;
      case 'academic':
        return <BookOpen className="h-4 w-4 text-primary" />;
      default:
        return <Star className="h-4 w-4 text-xp" />;
    }
  };

  return (
    <div className={cn('space-y-1.5', className)}>
      <div className="flex items-center justify-between text-sm">
        <div className="flex items-center gap-1.5 font-medium">
          {getIcon()}
          <span>{persona.labels.xp}</span>
        </div>
        <span className="text-muted-foreground">
          {current.toLocaleString()} / {max.toLocaleString()}
        </span>
      </div>
      <div className="xp-bar">
        <div
          className="xp-bar-fill"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

import { usePersona } from '@/contexts/PersonaContext';
import { cn } from '@/lib/utils';

interface MasteryBarProps {
  label: string;
  percentage: number;
  trend?: 'improving' | 'stable' | 'declining';
  className?: string;
}

export function MasteryBar({ label, percentage, trend, className }: MasteryBarProps) {
  const { persona } = usePersona();

  const getProgressColor = () => {
    if (percentage >= 80) return 'bg-mastery';
    if (percentage >= 50) return 'bg-warning';
    return 'bg-progress-low';
  };

  const getTrendIcon = () => {
    if (!trend) return null;
    switch (trend) {
      case 'improving':
        return <span className="text-mastery text-xs">↑</span>;
      case 'declining':
        return <span className="text-destructive text-xs">↓</span>;
      default:
        return <span className="text-muted-foreground text-xs">→</span>;
    }
  };

  const getLabel = () => {
    if (persona.band === 'A') {
      if (percentage >= 80) return '⭐⭐⭐';
      if (percentage >= 50) return '⭐⭐';
      return '⭐';
    }
    return `${percentage}%`;
  };

  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium truncate">{label}</span>
        <div className="flex items-center gap-1">
          {getTrendIcon()}
          <span className="text-muted-foreground text-xs">{getLabel()}</span>
        </div>
      </div>
      <div className="mastery-bar">
        <div
          className={cn('h-full rounded-full transition-all duration-500', getProgressColor())}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

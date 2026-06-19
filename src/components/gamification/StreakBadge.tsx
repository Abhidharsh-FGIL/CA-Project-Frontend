import { usePersona } from '@/contexts/PersonaContext';
import { cn } from '@/lib/utils';
import { Flame } from 'lucide-react';

interface StreakBadgeProps {
  streak: number;
  className?: string;
}

export function StreakBadge({ streak, className }: StreakBadgeProps) {
  const { persona } = usePersona();

  const getStreakEmoji = () => {
    switch (persona.band) {
      case 'A':
        return '☀️';
      case 'B':
        return '🔥';
      default:
        return null;
    }
  };

  const emoji = getStreakEmoji();

  if (streak === 0) return null;

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium',
        'bg-streak/10 text-streak',
        className
      )}
    >
      {emoji ? (
        <span>{emoji}</span>
      ) : (
        <Flame className="h-4 w-4" />
      )}
      <span>{streak}</span>
      <span className="text-xs opacity-75">{persona.labels.streak}</span>
    </div>
  );
}

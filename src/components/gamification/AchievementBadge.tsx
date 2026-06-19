import { usePersona } from '@/contexts/PersonaContext';
import { cn } from '@/lib/utils';
import type { Achievement } from '@/types';

interface AchievementBadgeProps {
  achievement: Achievement;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function AchievementBadge({ achievement, size = 'md', className }: AchievementBadgeProps) {
  const { persona } = usePersona();

  const sizeClasses = {
    sm: 'w-10 h-10 text-lg',
    md: 'w-14 h-14 text-2xl',
    lg: 'w-20 h-20 text-4xl',
  };

  const getBadgeStyle = () => {
    switch (persona.achievementStyle) {
      case 'stickers':
        return 'bg-gradient-to-br from-yellow-200 to-yellow-400 border-2 border-yellow-500 shadow-lg';
      case 'badges':
        return 'bg-gradient-to-br from-blue-400 to-blue-600 border-2 border-blue-700 shadow-lg';
      case 'trophies':
        return 'bg-gradient-to-br from-amber-400 to-amber-600 border-2 border-amber-700 shadow-lg';
      case 'certificates':
        return 'bg-gradient-to-br from-emerald-400 to-emerald-600 border-2 border-emerald-700 shadow-lg';
      case 'honors':
        return 'bg-gradient-to-br from-purple-400 to-purple-600 border-2 border-purple-700 shadow-lg';
      default:
        return 'bg-gradient-to-br from-primary/80 to-primary border-2 border-primary shadow-lg';
    }
  };

  return (
    <div
      className={cn(
        'rounded-full flex items-center justify-center transition-transform hover:scale-110',
        sizeClasses[size],
        getBadgeStyle(),
        className
      )}
      title={`${achievement.title}: ${achievement.description}`}
    >
      <span role="img" aria-label={achievement.title}>
        {achievement.icon}
      </span>
    </div>
  );
}

interface AchievementCardProps {
  achievement: Achievement;
  className?: string;
}

export function AchievementCard({ achievement, className }: AchievementCardProps) {
  const { persona } = usePersona();

  return (
    <div className={cn('card-elevated p-4 flex items-center gap-4', className)}>
      <AchievementBadge achievement={achievement} size="md" />
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold truncate">{achievement.title}</h4>
        <p className="text-sm text-muted-foreground truncate">{achievement.description}</p>
        <p className="text-xs text-primary mt-1">
          +{achievement.xpReward} {persona.labels.xp}
        </p>
      </div>
    </div>
  );
}

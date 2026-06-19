import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { 
  Award, Trophy, Flame, Zap, Crown, Medal, Star, Brain, 
  TrendingUp, Timer, BookOpen, GraduationCap, Footprints, Lock
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface BadgeData {
  id: string;
  name: string;
  description: string;
  icon: string;
  category: 'streak' | 'quiz' | 'assignment' | 'mastery' | 'special';
  xpReward: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  earnedAt?: string;
  isEarned: boolean;
}

interface BadgeShowcaseProps {
  badges: BadgeData[];
  className?: string;
  showLocked?: boolean;
  compact?: boolean;
}

const iconMap: Record<string, typeof Award> = {
  award: Award,
  trophy: Trophy,
  flame: Flame,
  zap: Zap,
  crown: Crown,
  medal: Medal,
  star: Star,
  brain: Brain,
  'trending-up': TrendingUp,
  timer: Timer,
  'book-open': BookOpen,
  'graduation-cap': GraduationCap,
  footprints: Footprints,
};

const rarityConfig = {
  common: {
    border: 'border-gray-300',
    bg: 'bg-gray-100 dark:bg-gray-800',
    text: 'text-gray-600 dark:text-gray-400',
    glow: '',
  },
  rare: {
    border: 'border-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-950',
    text: 'text-blue-600',
    glow: 'shadow-blue-200',
  },
  epic: {
    border: 'border-purple-400',
    bg: 'bg-purple-50 dark:bg-purple-950',
    text: 'text-purple-600',
    glow: 'shadow-purple-200',
  },
  legendary: {
    border: 'border-yellow-400',
    bg: 'bg-gradient-to-br from-yellow-50 to-amber-50 dark:from-yellow-950 dark:to-amber-950',
    text: 'text-yellow-600',
    glow: 'shadow-yellow-200 shadow-lg',
  },
};

export function BadgeShowcase({ badges, className, showLocked = true, compact = false }: BadgeShowcaseProps) {
  const earnedBadges = badges.filter(b => b.isEarned);
  const lockedBadges = badges.filter(b => !b.isEarned);

  const renderBadge = (badge: BadgeData) => {
    const IconComponent = iconMap[badge.icon] || Award;
    const rarity = rarityConfig[badge.rarity];

    return (
      <Tooltip key={badge.id}>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "relative flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-transform hover:scale-105 cursor-pointer",
              badge.isEarned ? rarity.border : 'border-dashed border-muted-foreground/30',
              badge.isEarned ? rarity.bg : 'bg-muted/30',
              badge.isEarned && rarity.glow,
              compact && "p-1.5"
            )}
          >
            {badge.isEarned ? (
              <IconComponent className={cn("h-6 w-6", rarity.text, compact && "h-5 w-5")} />
            ) : (
              <Lock className="h-6 w-6 text-muted-foreground/50" />
            )}
            {!compact && (
              <span className={cn(
                "text-xs font-medium text-center truncate max-w-16",
                !badge.isEarned && "text-muted-foreground/50"
              )}>
                {badge.name}
              </span>
            )}
            {badge.isEarned && badge.rarity !== 'common' && (
              <Badge 
                variant="secondary" 
                className={cn("absolute -top-1 -right-1 text-[10px] px-1", compact && "text-[8px]")}
              >
                {badge.rarity === 'legendary' ? '⭐' : badge.rarity === 'epic' ? '💎' : '✨'}
              </Badge>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-48">
          <div className="space-y-1">
            <p className="font-medium">{badge.name}</p>
            <p className="text-xs text-muted-foreground">{badge.description}</p>
            <div className="flex items-center gap-2 text-xs">
              <span className="text-yellow-500">+{badge.xpReward} XP</span>
              <span className="capitalize text-muted-foreground">{badge.rarity}</span>
            </div>
            {badge.isEarned && badge.earnedAt && (
              <p className="text-xs text-green-500">
                Earned {new Date(badge.earnedAt).toLocaleDateString()}
              </p>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-5 w-5 text-yellow-500" />
          Badges
          <Badge variant="secondary" className="ml-auto">
            {earnedBadges.length}/{badges.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={cn("grid gap-2", compact ? "grid-cols-6" : "grid-cols-4")}>
          {earnedBadges.map(renderBadge)}
          {showLocked && lockedBadges.slice(0, compact ? 6 : 4).map(renderBadge)}
        </div>
        {showLocked && lockedBadges.length > (compact ? 6 : 4) && (
          <p className="text-xs text-muted-foreground text-center mt-2">
            +{lockedBadges.length - (compact ? 6 : 4)} more to unlock
          </p>
        )}
      </CardContent>
    </Card>
  );
}

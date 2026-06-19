import { usePersona } from '@/contexts/PersonaContext';
import { XPBar } from './XPBar';
import { MasteryBar } from './MasteryBar';
import { StreakBadge } from './StreakBadge';
import { AchievementBadge } from './AchievementBadge';
import { cn } from '@/lib/utils';
import type { Achievement, StudentProgress } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Star, Compass, Zap, BarChart3, GraduationCap } from 'lucide-react';

interface ProgressWidgetProps {
  xp: number;
  xpToNextLevel: number;
  streak: number;
  achievements: Achievement[];
  masteryProgress?: StudentProgress[];
  className?: string;
}

export function ProgressWidget({
  xp,
  xpToNextLevel,
  streak,
  achievements,
  masteryProgress = [],
  className,
}: ProgressWidgetProps) {
  const { persona } = usePersona();

  const renderBandAWidget = () => (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="bg-gradient-to-r from-yellow-100 to-orange-100 dark:from-yellow-900/20 dark:to-orange-900/20 pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
          My Stars! ⭐
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            {[...Array(Math.min(Math.floor(xp / 100), 5))].map((_, i) => (
              <Star key={i} className="h-8 w-8 text-yellow-500 fill-yellow-500 animate-bounce-subtle" style={{ animationDelay: `${i * 0.1}s` }} />
            ))}
          </div>
          <StreakBadge streak={streak} />
        </div>
        <XPBar current={xp % 500} max={500} />
        <div className="flex gap-2 overflow-x-auto pb-2">
          {achievements.slice(0, 4).map((ach) => (
            <AchievementBadge key={ach.id} achievement={ach} size="sm" />
          ))}
        </div>
      </CardContent>
    </Card>
  );

  const renderBandBWidget = () => (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/20 dark:to-purple-900/20 pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Compass className="h-5 w-5 text-blue-500" />
          Quest Map 🗺️
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-2xl font-bold text-primary">{xp} Points</div>
          <StreakBadge streak={streak} />
        </div>
        <XPBar current={xp % 1000} max={1000} />
        <div className="grid grid-cols-2 gap-2">
          {masteryProgress.slice(0, 4).map((prog) => (
            <div key={prog.outcomeId} className="bg-muted/50 rounded-lg p-2">
              <div className="text-xs font-medium truncate">{prog.outcomeTitle}</div>
              <div className="flex items-center gap-1 mt-1">
                {[...Array(Math.ceil(prog.masteryLevel / 25))].map((_, i) => (
                  <div key={i} className="w-2 h-2 rounded-full bg-primary" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );

  const renderBandCWidget = () => (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="bg-gradient-to-r from-orange-100 to-red-100 dark:from-orange-900/20 dark:to-red-900/20 pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Zap className="h-5 w-5 text-orange-500" />
          XP Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-3xl font-bold">{xp.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground">Total XP</div>
          </div>
          <StreakBadge streak={streak} />
        </div>
        <XPBar current={xp % 2000} max={2000} />
        <div className="space-y-2">
          {masteryProgress.slice(0, 3).map((prog) => (
            <MasteryBar
              key={prog.outcomeId}
              label={prog.outcomeTitle}
              percentage={prog.masteryLevel}
              trend={prog.trend}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );

  const renderBandDWidget = () => (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="bg-gradient-to-r from-emerald-100 to-teal-100 dark:from-emerald-900/20 dark:to-teal-900/20 pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BarChart3 className="h-5 w-5 text-emerald-600" />
          Skill Mastery
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold">{xp.toLocaleString()} pts</div>
            <div className="text-sm text-muted-foreground">
              {streak} day consistency
            </div>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold text-mastery">
              {Math.round(masteryProgress.reduce((acc, p) => acc + p.masteryLevel, 0) / masteryProgress.length || 0)}%
            </div>
            <div className="text-xs text-muted-foreground">Avg Mastery</div>
          </div>
        </div>
        <div className="space-y-2">
          {masteryProgress.map((prog) => (
            <MasteryBar
              key={prog.outcomeId}
              label={prog.outcomeTitle}
              percentage={prog.masteryLevel}
              trend={prog.trend}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );

  const renderBandEWidget = () => (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-800/50 dark:to-slate-700/50 pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <GraduationCap className="h-5 w-5" />
          Academic Progress
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-4 space-y-4">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold">{xp.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Credits</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{streak}</div>
            <div className="text-xs text-muted-foreground">Day Streak</div>
          </div>
          <div>
            <div className="text-2xl font-bold">{achievements.length}</div>
            <div className="text-xs text-muted-foreground">Honors</div>
          </div>
        </div>
        <div className="space-y-2">
          {masteryProgress.map((prog) => (
            <MasteryBar
              key={prog.outcomeId}
              label={prog.outcomeTitle}
              percentage={prog.masteryLevel}
              trend={prog.trend}
            />
          ))}
        </div>
        <div className="pt-2 border-t">
          <div className="text-sm font-medium mb-2">Exam Readiness</div>
          <div className="h-3 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-500"
              style={{
                width: `${Math.round(masteryProgress.reduce((acc, p) => acc + p.masteryLevel, 0) / masteryProgress.length || 0)}%`,
              }}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );

  switch (persona.band) {
    case 'A':
      return renderBandAWidget();
    case 'B':
      return renderBandBWidget();
    case 'C':
      return renderBandCWidget();
    case 'D':
      return renderBandDWidget();
    case 'E':
      return renderBandEWidget();
    default:
      return renderBandCWidget();
  }
}

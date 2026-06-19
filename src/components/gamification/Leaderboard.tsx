import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Trophy, Flame, Share2, Crown, Medal, Award } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export interface LeaderboardEntry {
  id: string;
  name: string;
  avatar?: string;
  xp: number;
  streak: number;
  rank: number;
  previousRank?: number;
  title?: string;
  isCurrentUser?: boolean;
  assignmentScore?: number;
  quizScore?: number;
}

interface LeaderboardProps {
  entries: LeaderboardEntry[];
  className?: string;
  title?: string;
  showShare?: boolean;
  type?: 'xp' | 'assignment' | 'quiz';
}

const PODIUM_CONFIG: Record<number, { color: string; bar: string; icon: React.ReactNode; height: string; size: string; border: string }> = {
  1: {
    color: 'text-yellow-500',
    bar: 'bg-gradient-to-t from-yellow-500 to-yellow-400',
    icon: <Crown className="h-4 w-4 text-yellow-100" />,
    height: 'h-20',
    size: 'h-12 w-12',
    border: 'border-yellow-400 ring-2 ring-yellow-300',
  },
  2: {
    color: 'text-slate-400',
    bar: 'bg-gradient-to-t from-slate-400 to-slate-300',
    icon: <Medal className="h-4 w-4 text-slate-100" />,
    height: 'h-14',
    size: 'h-10 w-10',
    border: 'border-slate-400 ring-1 ring-slate-300',
  },
  3: {
    color: 'text-amber-600',
    bar: 'bg-gradient-to-t from-amber-600 to-amber-500',
    icon: <Award className="h-4 w-4 text-amber-100" />,
    height: 'h-10',
    size: 'h-9 w-9',
    border: 'border-amber-500 ring-1 ring-amber-300',
  },
};

function getRankBadge(rank: number) {
  if (rank === 1) return <Crown className="h-4 w-4 text-yellow-500" />;
  if (rank === 2) return <Medal className="h-4 w-4 text-slate-400" />;
  if (rank === 3) return <Award className="h-4 w-4 text-amber-600" />;
  return <span className="text-xs font-bold text-muted-foreground w-4 text-center">#{rank}</span>;
}

export function Leaderboard({
  entries,
  className,
  title = 'Class Leaderboard',
  showShare = true,
  type = 'xp',
}: LeaderboardProps) {
  const handleShare = () => {
    const me = entries.find(e => e.isCurrentUser);
    if (me) {
      const text = `🏆 I'm ranked #${me.rank} in my class with ${me.xp} XP! Can you beat my score?`;
      if (navigator.share) navigator.share({ text });
      else { navigator.clipboard.writeText(text); toast.success('Copied to clipboard!'); }
    }
  };

  const getScore = (e: LeaderboardEntry) =>
    type === 'assignment' ? (e.assignmentScore ?? 0) : type === 'quiz' ? (e.quizScore ?? 0) : e.xp;

  const scoreLabel = type === 'assignment' ? 'pts' : type === 'quiz' ? 'pts' : 'XP';

  // Build podium: [2nd, 1st, 3rd] left-to-right
  const top3 = [1, 2, 3].map(r => entries.find(e => e.rank === r)).filter(Boolean) as LeaderboardEntry[];
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean) as LeaderboardEntry[]; // [2nd, 1st, 3rd]

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4 text-yellow-500" />
            {title}
          </CardTitle>
          {showShare && entries.some(e => e.isCurrentUser) && (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handleShare}>
              <Share2 className="h-3 w-3 mr-1" />
              Share
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="px-3 pb-3">
        {/* ── Podium ── */}
        {podiumOrder.length >= 2 && (
          <div className="flex justify-center items-end gap-2 py-4 mb-3 bg-gradient-to-b from-muted/40 to-transparent rounded-lg">
            {podiumOrder.map((entry) => {
              const cfg = PODIUM_CONFIG[entry.rank];
              if (!cfg) return null;
              return (
                <div key={entry.id} className="flex flex-col items-center gap-1">
                  {/* Crown for #1 */}
                  {entry.rank === 1 && (
                    <Crown className="h-4 w-4 text-yellow-500 mb-0.5 animate-bounce" style={{ animationDuration: '2s' }} />
                  )}
                  <Avatar className={cn('border-2', cfg.size, cfg.border, entry.isCurrentUser && 'ring-offset-1')}>
                    <AvatarImage src={entry.avatar} />
                    <AvatarFallback className={cn('text-sm font-bold', entry.rank === 1 ? 'bg-yellow-50' : 'bg-muted')}>
                      {entry.name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className={cn(
                    'text-xs font-semibold truncate max-w-[56px] text-center',
                    entry.isCurrentUser && 'text-primary'
                  )}>
                    {entry.name.split(' ')[0]}
                    {entry.isCurrentUser && ' ★'}
                  </span>
                  <span className={cn('text-[10px] font-medium', cfg.color)}>
                    {getScore(entry).toLocaleString()} {scoreLabel}
                  </span>
                  {/* Podium bar */}
                  <div className={cn('w-14 rounded-t-md flex items-center justify-center', cfg.height, cfg.bar)}>
                    {cfg.icon}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Full ranked list ── */}
        <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className={cn(
                'flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors',
                entry.isCurrentUser
                  ? 'bg-primary/10 border border-primary/20'
                  : 'hover:bg-muted/50',
              )}
            >
              <div className="flex items-center justify-center w-5 shrink-0">
                {getRankBadge(entry.rank)}
              </div>

              <Avatar className="h-6 w-6 shrink-0">
                <AvatarImage src={entry.avatar} />
                <AvatarFallback className="text-[10px]">{entry.name.charAt(0)}</AvatarFallback>
              </Avatar>

              <span className={cn(
                'flex-1 text-xs font-medium truncate',
                entry.isCurrentUser && 'text-primary font-semibold'
              )}>
                {entry.name}{entry.isCurrentUser && ' (You)'}
              </span>

              <div className="flex items-center gap-1 shrink-0">
                {entry.streak > 0 && (
                  <span className="text-[10px] text-orange-500 flex items-center gap-0.5">
                    <Flame className="h-3 w-3" />{entry.streak}
                  </span>
                )}
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 font-mono">
                  {getScore(entry).toLocaleString()} {scoreLabel}
                </Badge>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

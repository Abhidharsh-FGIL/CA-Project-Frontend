import { useGamification } from '@/contexts/GamificationContext';
import { Flame, Star } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function StreakIndicator() {
  const { streak, xp } = useGamification();

  return (
    <div className="flex items-center gap-2">
      {/* XP pill */}
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.div
            className="flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium cursor-default"
            whileHover={{ scale: 1.05 }}
            key={xp}
          >
            <Star className="h-3 w-3" />
            <AnimatePresence mode="popLayout">
              <motion.span
                key={xp}
                initial={{ y: -8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 8, opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                {xp.toLocaleString()}
              </motion.span>
            </AnimatePresence>
          </motion.div>
        </TooltipTrigger>
        <TooltipContent>Total XP earned</TooltipContent>
      </Tooltip>

      {/* Streak pill */}
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.div
            className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium cursor-default"
            style={{
              background: streak > 0 ? 'hsl(var(--streak) / 0.12)' : 'hsl(var(--muted))',
              color: streak > 0 ? 'hsl(var(--streak))' : 'hsl(var(--muted-foreground))',
            }}
            whileHover={{ scale: 1.05 }}
            animate={streak >= 7 ? { scale: [1, 1.06, 1] } : {}}
            transition={streak >= 7 ? { repeat: Infinity, duration: 2 } : {}}
          >
            <Flame className="h-3 w-3" />
            <span>{streak}</span>
          </motion.div>
        </TooltipTrigger>
        <TooltipContent>{streak} day streak</TooltipContent>
      </Tooltip>
    </div>
  );
}

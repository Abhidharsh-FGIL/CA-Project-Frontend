import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';

interface GamificationState {
  xp: number;
  streak: number;
  todayActive: boolean;
}

interface GamificationContextValue {
  xp: number;
  streak: number;
  todayActive: boolean;
  awardXP: (amount: number, reason: string) => void;
  recordActivity: () => void;
}

const GamificationContext = createContext<GamificationContextValue | undefined>(undefined);

export const XP_EVENTS: Record<string, number> = {
  upload_document: 5,
  complete_assessment: 15,
  create_mindmap: 10,
  create_ebook: 10,
  daily_login: 3,
  ai_chat: 2,
  rag_query: 3,
};

export function GamificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { orgId, workspaceReady } = useWorkspaceContext();
  const wsParam = orgId || 'personal';
  const queryClient = useQueryClient();
  const [state, setState] = useState<GamificationState>({
    xp: 0,
    streak: 0,
    todayActive: false,
  });

  // Refs for auto-XP-toast delta detection
  const prevXpRef = useRef<number | null>(null);
  const hasMounted = useRef(false);

  // Reset local state when user or workspace changes (e.g. logout, workspace switch)
  useEffect(() => {
    setState({ xp: 0, streak: 0, todayActive: false });
    prevXpRef.current = null;
    hasMounted.current = false;
  }, [user?.id, wsParam]);

  // Fetch XP/streak via React Query so invalidateQueries(['gamification']) triggers refetch
  const { data: gamData } = useQuery({
    queryKey: ['gamification', user?.id, wsParam],
    queryFn: () => api.get<{ xp: number; streak: number }>(
      `/api/v1/gamification/my/summary?org_id=${wsParam}`
    ),
    enabled: !!user?.id && workspaceReady,
  });

  // Sync query data to local state + auto-toast on XP increase
  useEffect(() => {
    if (!gamData) return;
    const newXp = gamData.xp ?? 0;
    const newStreak = gamData.streak ?? 0;

    setState(s => ({ ...s, xp: newXp, streak: newStreak }));

    if (!hasMounted.current) {
      prevXpRef.current = newXp;
      hasMounted.current = true;
      return;
    }

    if (prevXpRef.current !== null && newXp > prevXpRef.current) {
      const delta = newXp - prevXpRef.current;
      toast(`+${delta} XP`, { description: 'Keep going!', duration: 2500, icon: '⭐' });
    }
    prevXpRef.current = newXp;
  }, [gamData]);

  // Record daily activity once per workspace per IST day (not per browser session,
  // so streak advances correctly when the tab stays open across midnight).
  useEffect(() => {
    if (!user?.id || !workspaceReady) return;
    const istNow = new Date(Date.now() + (5 * 60 + 30) * 60 * 1000);
    const istDay = istNow.toISOString().slice(0, 10);
    const dayKey = `gam_activity_${user.id}_${wsParam}_${istDay}`;
    if (localStorage.getItem(dayKey)) {
      setState(s => ({ ...s, todayActive: true }));
      return;
    }
    localStorage.setItem(dayKey, '1');
    setState(s => ({ ...s, todayActive: true }));

    // /activity handles streak + daily login XP (idempotent server-side)
    api.post<{ streak: number; xp: number }>(`/api/v1/gamification/activity?org_id=${wsParam}`)
      .then(() => {
        // Refetch to get updated XP/streak (triggers auto-toast if XP changed)
        queryClient.invalidateQueries({ queryKey: ['gamification'] });
      })
      .catch(() => {});
  }, [user?.id, wsParam, workspaceReady, queryClient]);

  const awardXP = useCallback((amount: number, reason: string) => {
    // Optimistic local update
    setState(s => ({ ...s, xp: s.xp + amount }));
    toast(`+${amount} XP`, { description: reason, duration: 2500, icon: '⭐' });
    // Update prev ref so auto-toast doesn't double-fire
    prevXpRef.current = (prevXpRef.current ?? 0) + amount;

    if (user?.id) {
      api.post(`/api/v1/gamification/xp?org_id=${wsParam}`, { amount, reason })
        .then(() => queryClient.invalidateQueries({ queryKey: ['gamification'] }))
        .catch(err => console.error('XP persist error:', err));
    }
  }, [user, wsParam, queryClient]);

  const recordActivity = useCallback(() => {
    if (user?.id) {
      api.post<{ streak: number; xp: number }>(`/api/v1/gamification/activity?org_id=${wsParam}`).then(data => {
        if (data?.streak != null) {
          setState(s => ({ ...s, streak: data.streak }));
        }
      }).catch(err => console.error('Streak update error:', err));
    }
  }, [user, wsParam]);

  return (
    <GamificationContext.Provider value={{ ...state, awardXP, recordActivity }}>
      {children}
    </GamificationContext.Provider>
  );
}

export function useGamification() {
  const ctx = useContext(GamificationContext);
  if (!ctx) throw new Error('useGamification must be used within GamificationProvider');
  return ctx;
}

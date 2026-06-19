import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';

export type DailyChallengeStatus = 'completed' | 'in_progress' | 'missed' | 'future';

export interface DailyChallengeQuestion {
  id: string;
  prompt: string;
  topic?: string;
  studentAnswer?: string;
  correctAnswer: string;
  isCorrect: boolean;
  explanation?: string;
}

export interface DailyChallengeAttempt {
  date: string; // YYYY-MM-DD
  status: DailyChallengeStatus;
  assessmentId?: string;
  attemptId?: string;
  score?: number;
  maxScore?: number;
  xpEarned?: number;
  subject?: string;
  topics?: string[];
  questions?: DailyChallengeQuestion[];
}

export interface DailyChallengeHistoryResponse {
  from: string;
  to: string;
  attempts: DailyChallengeAttempt[];
  stats: {
    totalDays: number;
    completedDays: number;
    missedDays: number;
    completionRate: number;
    currentStreak: number;
    bestStreak: number;
    avgScore: number;
    totalXp: number;
  };
  topicBreakdown: Array<{ topic: string; correct: number; total: number; accuracy: number }>;
}

const toDateStr = (d: Date) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export type DailyChallengeRangePreset = 'last7' | 'last30' | 'thisMonth' | 'lastMonth' | 'last3Months';

export function resolveRange(preset: DailyChallengeRangePreset): { from: Date; to: Date } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  switch (preset) {
    case 'last7': {
      const from = new Date(today);
      from.setDate(from.getDate() - 6);
      return { from, to: today };
    }
    case 'last30': {
      const from = new Date(today);
      from.setDate(from.getDate() - 29);
      return { from, to: today };
    }
    case 'thisMonth': {
      const from = new Date(today.getFullYear(), today.getMonth(), 1);
      return { from, to: today };
    }
    case 'lastMonth': {
      const from = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const to = new Date(today.getFullYear(), today.getMonth(), 0);
      return { from, to };
    }
    case 'last3Months': {
      const from = new Date(today);
      from.setMonth(from.getMonth() - 3);
      from.setDate(from.getDate() + 1);
      return { from, to: today };
    }
  }
}

export function useDailyChallengeHistory(preset: DailyChallengeRangePreset = 'last7') {
  const { user } = useAuth();
  const { orgId, workspaceReady } = useWorkspaceContext();
  const wsParam = orgId || 'personal';

  const { from, to } = resolveRange(preset);
  const fromStr = toDateStr(from);
  const toStr = toDateStr(to);

  return useQuery({
    queryKey: ['daily-challenge-history', user?.id, wsParam, fromStr, toStr],
    queryFn: async () => {
      const params = new URLSearchParams({ org_id: wsParam, from: fromStr, to: toStr });
      return api.get<DailyChallengeHistoryResponse>(
        `/api/v1/assessments/daily-challenge-history?${params}`
      );
    },
    enabled: !!user?.id && workspaceReady,
  });
}

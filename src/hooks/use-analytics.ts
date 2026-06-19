import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';

export function useMonthlyComparison() {
  const { user } = useAuth();
  const { orgId, workspaceReady } = useWorkspaceContext();
  const wsParam = orgId || 'personal';
  return useQuery({
    queryKey: ['monthly-comparison', user?.id, wsParam],
    queryFn: () => api.get<{
      thisMonth: { assessments: number; documents: number; chats: number; avgScore: number };
      lastMonth: { assessments: number; documents: number; chats: number; avgScore: number };
    }>(`/api/v1/analytics/user/monthly-comparison?org_id=${wsParam}`),
    enabled: !!user?.id && workspaceReady,
    staleTime: 5 * 60 * 1000,
  });
}

export function useScoreTrend(limit = 12) {
  const { user } = useAuth();
  const { orgId, workspaceReady } = useWorkspaceContext();
  const wsParam = orgId || 'personal';
  return useQuery({
    queryKey: ['score-trend', user?.id, limit, wsParam],
    queryFn: () => api.get<Array<{ date: string; score: number; subject: string }>>(
      `/api/v1/analytics/user/score-trend?limit=${limit}&org_id=${wsParam}`
    ),
    enabled: !!user?.id && workspaceReady,
    staleTime: 5 * 60 * 1000,
  });
}

export function useStudyTime() {
  const { user } = useAuth();
  const { orgId, workspaceReady } = useWorkspaceContext();
  const wsParam = orgId || 'personal';
  return useQuery({
    queryKey: ['study-time', user?.id, wsParam],
    queryFn: () => api.get<Array<{ subject: string; interactions: number }>>(
      `/api/v1/analytics/user/study-time?org_id=${wsParam}`
    ),
    enabled: !!user?.id && workspaceReady,
    staleTime: 5 * 60 * 1000,
  });
}

export function useActivityHeatmap(days = 30) {
  const { user } = useAuth();
  const { orgId, workspaceReady } = useWorkspaceContext();
  const wsParam = orgId || 'personal';
  return useQuery({
    queryKey: ['activity-heatmap', user?.id, days, wsParam],
    queryFn: () => api.get<{ dailyActivity: Array<{ date: string; count: number }> }>(
      `/api/v1/analytics/user/activity-heatmap?days=${days}&org_id=${wsParam}`
    ),
    enabled: !!user?.id && workspaceReady,
    staleTime: 5 * 60 * 1000,
  });
}

export function useUserRecentActivity() {
  const { user } = useAuth();
  const { orgId, workspaceReady } = useWorkspaceContext();
  const wsParam = orgId || 'personal';
  return useQuery({
    queryKey: ['user-recent-activity', user?.id, wsParam],
    queryFn: () => api.get<Array<{ type: string; label: string; icon: string; time: string; user_name?: string }>>(
      `/api/v1/analytics/user/recent-activity?org_id=${wsParam}`
    ),
    enabled: !!user?.id && workspaceReady,
    staleTime: 60_000,
  });
}

export function useUserRecentActivityFull(limit = 30) {
  const { user } = useAuth();
  const { orgId, workspaceReady } = useWorkspaceContext();
  const wsParam = orgId || 'personal';
  return useQuery({
    queryKey: ['user-recent-activity-full', user?.id, wsParam, limit],
    queryFn: () => api.get<Array<{ type: string; label: string; icon: string; time: string; user_name?: string }>>(
      `/api/v1/analytics/user/recent-activity?org_id=${wsParam}&limit=${limit}`
    ),
    enabled: !!user?.id && workspaceReady,
    staleTime: 60_000,
  });
}

export function useUserProgress() {
  const { user } = useAuth();
  const { orgId, workspaceReady } = useWorkspaceContext();
  const wsParam = orgId || 'personal';
  return useQuery({
    queryKey: ['user-progress', user?.id, wsParam],
    queryFn: () => api.get<{
      average_assessment_score: number;
      library_documents: number;
      total_chats: number;
    }>(`/api/v1/analytics/user/progress?org_id=${wsParam}`),
    enabled: !!user?.id && workspaceReady,
    staleTime: 2 * 60 * 1000,
  });
}

// ── Study Time Detailed Hooks ─────────────────────────────────────────────

export interface StudyTimeDetailed {
  total_minutes: number;
  daily_average: number;
  trend_percent: number;
  by_date: Array<{ date: string; minutes: number }>;
  by_subject: Array<{ subject: string; minutes: number }>;
  peak_hours: Array<{ hour: number; minutes: number }>;
  consistency_score: number;
  class_average_minutes: number | null;
}

export function useStudyTimeDetailed(period = '30d') {
  const { user } = useAuth();
  const { orgId, workspaceReady } = useWorkspaceContext();
  const wsParam = orgId || 'personal';
  return useQuery({
    queryKey: ['study-time-detailed', user?.id, wsParam, period],
    queryFn: () => api.get<StudyTimeDetailed>(
      `/api/v1/analytics/user/study-time-detailed?org_id=${wsParam}&period=${period}`
    ),
    enabled: !!user?.id && workspaceReady,
    staleTime: 5 * 60 * 1000,
  });
}

export interface OrgStudyTime {
  org_total_minutes: number;
  avg_per_student_daily: number;
  active_students: number;
  by_date: Array<{ date: string; total_minutes: number; active_students: number }>;
  by_subject: Array<{ subject: string; total_minutes: number }>;
  top_students: Array<{ user_id: string; name: string; total_minutes: number }>;
  at_risk_students: Array<{ user_id: string; name: string; total_minutes: number; daily_avg: number; days_inactive: number }>;
}

export function useOrgStudyTime(orgId: string, period = '30d', classId?: string) {
  return useQuery({
    queryKey: ['org-study-time', orgId, period, classId],
    queryFn: () => api.get<OrgStudyTime>(
      `/api/v1/analytics/org/${orgId}/study-time?period=${period}${classId ? `&class_id=${classId}` : ''}`
    ),
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });
}

export interface StudentStudyTime {
  student_name: string;
  total_minutes: number;
  daily_average: number;
  trend_percent: number;
  by_date: Array<{ date: string; minutes: number }>;
  by_subject: Array<{ subject: string; minutes: number }>;
  peak_hours: Array<{ hour: number; minutes: number }>;
  consistency_score: number;
}

export function useStudentStudyTime(orgId: string, studentId: string, period = '30d') {
  return useQuery({
    queryKey: ['student-study-time', orgId, studentId, period],
    queryFn: () => api.get<StudentStudyTime>(
      `/api/v1/analytics/org/${orgId}/student/${studentId}/study-time?period=${period}`
    ),
    enabled: !!orgId && !!studentId,
    staleTime: 5 * 60 * 1000,
  });
}

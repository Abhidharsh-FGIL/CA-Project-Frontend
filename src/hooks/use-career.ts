import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useGamification } from '@/contexts/GamificationContext';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';

export interface CareerSubjectStrength {
  subject: string;
  score: number;
  trend: 'improving' | 'steady' | 'declining';
  detail: string;
}

export interface CareerPath {
  title: string;
  compatibility: number;
  description: string;
  skills: string[];
  education: string;
  reasons: string[];
}

export interface SkillGap {
  skill: string;
  career: string;
  current: number;
  required: number;
  note: string;
}

export interface CareerProfile {
  summary: string;
  inferred_interests: string[];
  subject_strengths: CareerSubjectStrength[];
  top_careers: CareerPath[];
  skill_gaps: SkillGap[];
  next_steps: string[];
  data_richness: 'none' | 'sparse' | 'moderate' | 'rich';
  cached?: boolean;
}

/**
 * Fetches the AI-generated career profile built from assessment data,
 * topic mastery, and AI chat history. Cached 60 min server-side.
 */
export function useCareerProfile() {
  const { user } = useAuth();
  const { orgId, workspaceReady } = useWorkspaceContext();
  const wsParam = orgId || 'personal';
  return useQuery({
    queryKey: ['career-profile', user?.id, wsParam],
    queryFn: () => api.get<CareerProfile>(`/api/v1/career/profile?org_id=${wsParam}`),
    enabled: !!user?.id && workspaceReady,
    staleTime: 5 * 60 * 1000,
  });
}

/** Force-refresh the career profile (bypass server cache). */
export function useRefreshCareerProfile() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { orgId } = useWorkspaceContext();
  const wsParam = orgId || 'personal';
  return useMutation({
    mutationFn: () => api.get<CareerProfile>(`/api/v1/career/profile?force_refresh=true&org_id=${wsParam}`),
    onSuccess: (data) => {
      qc.setQueryData(['career-profile', user?.id, wsParam], data);
    },
  });
}

/** Generate custom career paths via user-provided interests (costs points). */
export function useGenerateCareerPaths() {
  const qc = useQueryClient();
  const { recordActivity } = useGamification();
  const { orgId } = useWorkspaceContext();
  const wsParam = orgId || 'personal';
  return useMutation({
    mutationFn: (payload: {
      interests: string[];
      strengths: string[];
      target_careers?: string[];
      grade?: number;
      context?: Record<string, any>;
    }) => api.post<any>(`/api/v1/career/analyze?org_id=${wsParam}`, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['career-profile'] });
      qc.invalidateQueries({ queryKey: ['subscription'] });
      qc.invalidateQueries({ queryKey: ['gamification'] });
      recordActivity();
    },
  });
}

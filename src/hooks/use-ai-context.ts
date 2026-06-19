import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';

export interface AIContextSession {
  id: string;
  user_id: string;
  workspace_id: string;
  student_mode: boolean;
  grade: number | null;
  board: string | null;
  subject: string | null;
  language: string;
  tone: string;
  difficulty: string;
  output_mode: string;
  org_locked: boolean;
  updated_at: string;
}

/** No backend endpoint exists for this — returns undefined so provider uses local defaults. */
export function useAIContextSession() {
  return { data: undefined, isLoading: false };
}

/** No backend endpoint exists — mutation is a no-op. */
export function useUpdateAIContext() {
  const { user } = useAuth();
  const { activeWorkspace } = useWorkspaceContext();
  const workspaceId = activeWorkspace?.id || 'personal';
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (_updates: Partial<Omit<AIContextSession, 'id' | 'user_id' | 'workspace_id' | 'updated_at'>>) => {
      // endpoint /api/v1/users/me/context does not exist on this backend
      return undefined as unknown as AIContextSession;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-context-session', user?.id, workspaceId] });
    },
  });
}

/** No backend endpoint exists — returns null so no org locks are applied. */
export function useOrgContextLocks() {
  return { data: null };
}

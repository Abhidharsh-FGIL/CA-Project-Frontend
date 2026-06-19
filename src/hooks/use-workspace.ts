import { useQuery } from '@tanstack/react-query';
import { api, buildUrl } from '@/lib/api';
import { useState, useCallback, useEffect } from 'react';

function resolveUploadUrl(url?: string | null): string | undefined {
  if (!url) return undefined;
  return buildUrl(url);
}

export interface Workspace {
  id: string;
  name: string;
  type: 'personal' | 'organization';
  logoUrl?: string;
  themeColor?: string;
  brandingEnabled?: boolean;
  role?: string;
  hasGenverse?: boolean;
  hasEvaluation?: boolean;
}

function getStorageKey(userId: string) {
  return `active-workspace-id-${userId}`;
}

export function useWorkspace(userId?: string) {
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(() => {
    if (!userId) return null;
    return localStorage.getItem(getStorageKey(userId));
  });

  useEffect(() => {
    if (!userId) {
      setActiveWorkspaceId(null);
      return;
    }
    const saved = localStorage.getItem(getStorageKey(userId));
    setActiveWorkspaceId(saved);
  }, [userId]);

  const { data: organizations = [], isLoading } = useQuery({
    queryKey: ['user-orgs', userId],
    queryFn: async () => {
      const data = await api.get<any[]>('/api/v1/users/me/workspaces');
      return (data || [])
        .filter((w: any) => w.type === 'organization')
        .map((w: any) => ({
          id: w.id,
          name: w.name,
          type: 'organization' as const,
          logoUrl: resolveUploadUrl(w.logo_url),
          themeColor: w.theme_color,
          brandingEnabled: w.branding_enabled ?? false,
          role: w.role,
          hasGenverse: w.has_genverse ?? true,
          hasEvaluation: w.has_evaluation ?? false,
        }));
    },
    enabled: !!userId,
  });

  const workspaces: Workspace[] = [
    { id: 'personal', name: 'Personal Workspace', type: 'personal' },
    ...organizations,
  ];

  const resolvedId = activeWorkspaceId || (organizations.length > 0 ? organizations[0].id : 'personal');
  const activeWorkspace = workspaces.find(w => w.id === resolvedId) || workspaces[0];

  // Workspace is "ready" when orgs have loaded (or no org workspace was stored).
  // This prevents queries from firing with workspace_id='personal' while orgs are still loading
  // when the user had previously selected an org workspace.
  const workspaceReady = !isLoading || resolvedId === 'personal';

  const switchWorkspace = useCallback((workspaceId: string) => {
    setActiveWorkspaceId(workspaceId);
    if (userId) {
      localStorage.setItem(getStorageKey(userId), workspaceId);
    }
  }, [userId]);

  const isOrgContext = activeWorkspace?.type === 'organization';
  const orgId = isOrgContext ? activeWorkspace.id : null;

  return { workspaces, activeWorkspace, switchWorkspace, isOrgContext, orgId, isLoading, workspaceReady };
}

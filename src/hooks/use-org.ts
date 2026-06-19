import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export function useOrganizations() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-orgs', user?.id],
    queryFn: () => api.get<any[]>('/api/v1/organizations/my'),
    enabled: !!user?.id,
  });
}

export function useCreateOrganization() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ name, logoUrl }: { name: string; logoUrl?: string }) =>
      api.post<any>('/api/v1/organizations/', { name, logo_url: logoUrl || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-orgs'] });
      qc.invalidateQueries({ queryKey: ['user-orgs'] });
      toast.success('Organisation created!');
    },
  });
}

export function useOrgMembers(orgId: string | null) {
  return useQuery({
    queryKey: ['org-members', orgId],
    queryFn: () => api.get<any[]>(`/api/v1/organizations/${orgId}/members`),
    enabled: !!orgId,
  });
}

export function useInviteMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ orgId, email, role }: { orgId: string; email?: string; userId?: string; role: string }) =>
      api.post<any>(`/api/v1/organizations/${orgId}/members/invite`, { email, role }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['org-members', vars.orgId] });
      toast.success('Member added');
    },
  });
}

export function useUpdateMemberRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, orgId, role }: { memberId: string; orgId: string; role: string }) =>
      api.patch(`/api/v1/organizations/${orgId}/members/${memberId}`, { role }),
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ['org-members', vars.orgId] }),
  });
}

export function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ memberId, orgId }: { memberId: string; orgId: string }) =>
      api.delete(`/api/v1/organizations/${orgId}/members/${memberId}`),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['org-members', vars.orgId] });
      toast.success('Member deactivated');
    },
  });
}

export function useOrgAnalytics(orgId: string | null) {
  return useQuery({
    queryKey: ['org-analytics', orgId],
    queryFn: () => api.get<{ org_id: string; member_counts: Record<string, number>; class_count: number; total_members: number }>(
      `/api/v1/analytics/org/${orgId}`
    ),
    enabled: !!orgId,
    staleTime: 5 * 60 * 1000,
  });
}

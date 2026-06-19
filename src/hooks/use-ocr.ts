import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useGamification } from '@/contexts/GamificationContext';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';

export interface OCRItem {
  id: string;
  title: string;
  type: string;
  storage_path: string | null;
  extracted_text_ref: string | null;
  folder: string | null;
  metadata: Record<string, any> | null;
  created_at: string | null;
  user_id: string;
}

// Map MIME content-type to OCRItem.type category
function mimeToType(mimeOrType: string | null | undefined): string {
  if (!mimeOrType) return 'txt';
  if (mimeOrType.startsWith('image/') || mimeOrType === 'image') return 'image';
  if (mimeOrType === 'application/pdf' || mimeOrType === 'pdf') return 'pdf';
  if (mimeOrType.includes('wordprocessingml') || mimeOrType === 'doc') return 'doc';
  return 'txt';
}

export function useOCRItems() {
  const { user } = useAuth();
  const { orgId, workspaceReady } = useWorkspaceContext();
  const wsParam = orgId || 'personal';
  return useQuery({
    queryKey: ['ocr-items', user?.id, wsParam],
    queryFn: async () => {
      const res = await api.get<any>(`/api/v1/library/?folder=ocr&org_id=${wsParam}&limit=50`);
      const items = res?.items ?? res ?? [];
      return (items || []).map((item: any): OCRItem => ({
        ...item,
        type: mimeToType(item.file_type || item.type),
        metadata: item.tags || item.metadata || null,
      }));
    },
    enabled: !!user?.id && workspaceReady,
  });
}

interface OCRPage {
  items: any[];
  next_cursor: string | null;
  has_more: boolean;
  total: number;
}

const OCR_PAGE_SIZE = 12;

export function useOCRItemsInfinite() {
  const { user } = useAuth();
  const { orgId, workspaceReady } = useWorkspaceContext();
  const wsParam = orgId || 'personal';

  const query = useInfiniteQuery({
    queryKey: ['ocr-items-infinite', user?.id, wsParam],
    queryFn: async ({ pageParam }) => {
      const params = new URLSearchParams({ org_id: wsParam, folder: 'ocr', limit: String(OCR_PAGE_SIZE) });
      if (pageParam) params.set('cursor', pageParam);
      const page = await api.get<OCRPage>(`/api/v1/library/?${params}`);
      return {
        ...page,
        items: (page.items || []).map((item: any): OCRItem => ({
          ...item,
          type: mimeToType(item.file_type || item.type),
          metadata: item.tags || item.metadata || null,
        })),
      };
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.has_more ? lastPage.next_cursor : undefined,
    enabled: !!user?.id && workspaceReady,
  });

  const allItems = query.data?.pages.flatMap((p) => p.items) ?? [];
  const total = query.data?.pages[0]?.total ?? 0;

  return {
    ...query,
    data: allItems,
    total,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
  };
}

export function useOCRUpload() {
  const qc = useQueryClient();
  const { recordActivity } = useGamification();
  const { orgId } = useWorkspaceContext();
  return useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('org_id', orgId || 'personal');
      return api.upload<{ item: any; extracted_text: string }>('/api/v1/ocr/extract', fd);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ocr-items'] });
      qc.invalidateQueries({ queryKey: ['ocr-items-infinite'] });
      qc.invalidateQueries({ queryKey: ['subscription'] });
      qc.invalidateQueries({ queryKey: ['gamification'] });
      recordActivity();
    },
  });
}

export function useOCRDelete() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: OCRItem) => api.delete(`/api/v1/library/${item.id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ocr-items'] }),
  });
}

export function useOCRText(itemId: string | null) {
  return useQuery({
    queryKey: ['ocr-text', itemId],
    // Extract the text string from { text: string } response
    queryFn: () =>
      api.get<{ text: string }>(`/api/v1/library/${itemId}/text`).then((r) => r?.text ?? ''),
    enabled: !!itemId,
  });
}

export function useOCRUpdateText() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ itemId, text }: { itemId: string; text: string }) =>
      api.patch(`/api/v1/library/${itemId}`, { extracted_text: text }),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['ocr-items'] });
      qc.invalidateQueries({ queryKey: ['ocr-items-infinite'] });
      qc.invalidateQueries({ queryKey: ['ocr-text', vars.itemId] });
    },
  });
}

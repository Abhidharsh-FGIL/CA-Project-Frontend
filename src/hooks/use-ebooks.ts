import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { useGamification } from '@/contexts/GamificationContext';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';

export interface EbookChapter {
  title: string;
  description?: string;
  content?: string;
  wordCount?: number;
  questions?: any[];
}

export interface EbookConfig {
  author?: string;
  bookSize?: 'short' | 'medium' | 'large';
  tone?: string;
  imageDensity?: string;
  imageTypes?: string[];
  assessmentConfig?: {
    enabled: boolean;
    placement: string;
    difficulty: string;
    questionTypes: string[];
  };
  versions?: { v: number; chapters: EbookChapter[]; saved_at: string }[];
}

export interface Ebook {
  id: string;
  user_id: string;
  title: string;
  ebook_json: { chapters?: EbookChapter[]; config?: EbookConfig } & Record<string, any>;
  language: string | null;
  source_type: string | null;
  source_ref_id: string | null;
  pdf_path: string | null;
  created_at: string | null;
}

export interface Audiobook {
  id: string;
  ebook_id: string;
  audio_path: string | null;
  voice_profile: string | null;
  narration_style: string | null;
  language: string | null;
  duration_seconds: number | null;
  chapter_timestamps: { label: string; type: string; start_seconds: number; duration_seconds: number }[] | null;
  created_at: string | null;
}

interface EbookPage {
  items: Ebook[];
  next_cursor: string | null;
  has_more: boolean;
  total: number;
}

const EBOOKS_PAGE_SIZE = 12;

export function useEbooks() {
  const { user } = useAuth();
  const { orgId, workspaceReady } = useWorkspaceContext();
  const wsParam = orgId || 'personal';

  const query = useInfiniteQuery({
    queryKey: ['ebooks', user?.id, wsParam],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ org_id: wsParam, limit: String(EBOOKS_PAGE_SIZE) });
      if (pageParam) params.set('cursor', pageParam);
      return api.get<EbookPage>(`/api/v1/ebooks/?${params.toString()}`);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.has_more ? lastPage.next_cursor : undefined,
    enabled: !!user?.id && workspaceReady,
  });

  // Flatten all pages into a single array for backwards compatibility
  const allEbooks = query.data?.pages.flatMap((p) => p.items) ?? [];
  const total = query.data?.pages[0]?.total ?? 0;

  return {
    ...query,
    data: allEbooks,
    total,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
  };
}

export function useEbookAudiobooks(ebookIds: string[]) {
  return useQuery({
    queryKey: ['audiobooks', ebookIds],
    queryFn: async () => {
      const results = await Promise.all(
        ebookIds.map(id => api.get<Audiobook[]>(`/api/v1/ebooks/${id}/audiobooks`).catch(() => []))
      );
      return results.flat();
    },
    enabled: ebookIds.length > 0,
  });
}

export function useCreateEbook() {
  const qc = useQueryClient();
  const { recordActivity } = useGamification();
  const { orgId } = useWorkspaceContext();
  return useMutation({
    mutationFn: (ebook: { title: string; ebook_json: any; language: string; source_type: string }) =>
      api.post<Ebook>('/api/v1/ebooks/', { ...ebook, org_id: orgId || null }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ebooks'] });
      qc.invalidateQueries({ queryKey: ['subscription'] });
      qc.invalidateQueries({ queryKey: ['gamification'] });
      recordActivity();
    },
  });
}

export function useUpdateEbook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...updates }: { id: string; ebook_json?: any; title?: string }) =>
      api.patch<Ebook>(`/api/v1/ebooks/${id}`, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ebooks'] }),
  });
}

export function useDeleteEbook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/api/v1/ebooks/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ebooks'] });
      toast.success('eBook deleted');
    },
  });
}

export function useDuplicateEbook() {
  const qc = useQueryClient();
  const { orgId } = useWorkspaceContext();
  return useMutation({
    mutationFn: (ebook: Ebook) =>
      api.post<Ebook>('/api/v1/ebooks/', {
        title: `${ebook.title} (Copy)`,
        ebook_json: ebook.ebook_json,
        language: ebook.language,
        source_type: ebook.source_type,
        org_id: orgId || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ebooks'] });
      toast.success('eBook duplicated');
    },
  });
}

// Utility functions (unchanged)
export function estimateChapters(size: string): string {
  switch (size) {
    case 'short': return '3–5';
    case 'medium': return '6–10';
    case 'large': return '11–20';
    default: return '3–5';
  }
}

export function estimatePages(size: string, tone: string): string {
  const base = size === 'short' ? 15 : size === 'medium' ? 30 : 60;
  const modifier = tone === 'story' ? 1.2 : tone === 'exam' ? 0.8 : 1;
  return `~${Math.round(base * modifier)}`;
}

export function estimateReadingTime(chapters: EbookChapter[]): number {
  const totalWords = chapters.reduce((sum, ch) => sum + (ch.wordCount || (ch.content?.split(/\s+/).length ?? 0)), 0);
  return Math.max(1, Math.round(totalWords / 200));
}

export function analyzeDifficulty(chapters: EbookChapter[]): string {
  const allContent = chapters.map(c => c.content || '').join(' ');
  const words = allContent.split(/\s+/).filter(Boolean);
  if (!words.length) return 'Beginner';
  const avgWordLen = words.reduce((s, w) => s + w.length, 0) / words.length;
  if (avgWordLen > 6.5) return 'Advanced';
  if (avgWordLen > 5) return 'Intermediate';
  return 'Beginner';
}

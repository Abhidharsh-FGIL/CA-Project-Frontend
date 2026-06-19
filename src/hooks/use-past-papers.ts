import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { api, buildUrl } from '@/lib/api';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { toast } from 'sonner';

export interface PastPaper {
  id: string;
  title: string;
  paper_name: string;
  board: string;
  grade: number;
  subject: string;
  year: number;
  language: string | null;
  storage_path: string | null;
  file_url: string | null;
  link: string | null;
  created_at: string | null;
}

export interface PastPaperFilters {
  search?: string;
  board?: string;
  grade?: string;
  subject?: string;
  year?: string;
  language?: string;
  sortBy?: 'newest' | 'oldest' | 'name_asc' | 'name_desc';
}

interface PastPaperPage {
  items: PastPaper[];
  next_cursor: string | null;
  has_more: boolean;
  total: number;
}

const PAST_PAPERS_PAGE_SIZE = 12;

export function usePastPapers(filters: PastPaperFilters) {
  const query = useInfiniteQuery({
    queryKey: ['past-papers', filters],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ limit: String(PAST_PAPERS_PAGE_SIZE) });
      if (filters.board) params.set('board', filters.board);
      if (filters.grade) params.set('grade', filters.grade);
      if (filters.subject) params.set('subject', filters.subject);
      if (filters.year) params.set('year', filters.year);
      if (filters.language) params.set('language', filters.language);
      if (filters.search) params.set('search', filters.search);
      if (filters.sortBy) params.set('sort_by', filters.sortBy);
      if (pageParam) params.set('cursor', pageParam);
      return api.get<PastPaperPage>(`/api/v1/past-papers/?${params}`);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.has_more ? lastPage.next_cursor : undefined,
  });

  const allPapers = query.data?.pages.flatMap((p) => p.items) ?? [];
  const total = query.data?.pages[0]?.total ?? 0;

  return {
    ...query,
    data: allPapers,
    total,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
  };
}

export function useDistinctPaperValues() {
  return useQuery({
    queryKey: ['past-papers-distinct'],
    queryFn: async () => {
      const page = await api.get<PastPaperPage>('/api/v1/past-papers/?limit=50');
      const data = page.items || [];
      return {
        boards: [...new Set(data.map(r => r.board))].sort(),
        grades: [...new Set(data.map(r => r.grade))].sort((a, b) => a - b),
        subjects: [...new Set(data.map(r => r.subject))].sort(),
        years: [...new Set(data.map(r => r.year))].sort((a, b) => b - a),
        languages: [...new Set(data.map(r => r.language).filter(Boolean) as string[])].sort(),
      };
    },
  });
}

export function useDownloadPaper() {
  const { canAccess, triggerUpgrade } = useSubscription();

  const handleDownload = async (paper: PastPaper) => {
    if (!canAccess('past_papers')) {
      triggerUpgrade('past_papers');
      return;
    }
    if (paper.link) {
      window.open(paper.link, '_blank');
      return;
    }
    if (paper.storage_path || paper.file_url) {
      try {
        const res = await api.get<{ url: string }>(`/api/v1/past-papers/${paper.id}/signed-url`);
        if (res.url) {
          const fullUrl = buildUrl(res.url);
          // Fetch as blob to force download (cross-origin <a download> doesn't work)
          const blob = await fetch(fullUrl).then(r => r.blob());
          const blobUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = blobUrl;
          a.download = paper.paper_name || paper.title || 'past-paper.pdf';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(blobUrl);
        } else {
          toast.error('No file URL available');
        }
      } catch {
        toast.error('Failed to download file');
      }
      return;
    }
    toast.error('No file available for this paper');
  };

  return { handleDownload, canDownload: canAccess('past_papers') };
}

import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { api, BASE_URL, getToken } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useGamification } from '@/contexts/GamificationContext';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';

export function useLibraryItems(folder?: string) {
  const { user } = useAuth();
  const { orgId, workspaceReady } = useWorkspaceContext();
  const wsParam = orgId || 'personal';
  return useQuery({
    queryKey: ['library-items', user?.id, folder, wsParam],
    queryFn: async () => {
      const params = new URLSearchParams({ org_id: wsParam, limit: '50' });
      if (folder) params.set('folder', folder);
      const res = await api.get<any>(`/api/v1/library/?${params}`);
      // Handle both paginated and legacy response formats
      return res?.items ?? res ?? [];
    },
    enabled: !!user?.id && workspaceReady,
  });
}

interface LibraryPage {
  items: any[];
  next_cursor: string | null;
  has_more: boolean;
  total: number;
}

const LIBRARY_PAGE_SIZE = 12;

export function useLibraryItemsInfinite(folder?: string) {
  const { user } = useAuth();
  const { orgId, workspaceReady } = useWorkspaceContext();
  const wsParam = orgId || 'personal';

  const query = useInfiniteQuery({
    queryKey: ['library-items-infinite', user?.id, folder, wsParam],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ org_id: wsParam, limit: String(LIBRARY_PAGE_SIZE) });
      if (folder) params.set('folder', folder);
      if (pageParam) params.set('cursor', pageParam);
      return api.get<LibraryPage>(`/api/v1/library/?${params}`);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.has_more ? lastPage.next_cursor : undefined,
    enabled: !!user?.id && workspaceReady,
    // No polling: live updates are pushed via SSE (see useVaultEventsStream),
    // which patches this cache directly when Celery finishes a file.
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

export function useUploadDocument() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { recordActivity } = useGamification();
  const { orgId } = useWorkspaceContext();

  return useMutation({
    mutationFn: async ({ file, title, folder, tags }: {
      file: File;
      title: string;
      folder?: string;
      tags?: string[];
    }) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', title);
      if (folder) fd.append('folder', folder);
      if (tags?.length) fd.append('tags', JSON.stringify(tags));
      fd.append('org_id', orgId || 'personal');
      return api.upload<any>('/api/v1/library/upload', fd);
    },
    onSuccess: (newItem) => {
      // Optimistically prepend the new item into every matching infinite-query
      // cache so it shows up *immediately* as "Processing…" — no waiting for a
      // refetch round-trip. The polling loop in useLibraryItemsInfinite will
      // then flip it to "Ready" once Celery finishes.
      if (newItem?.id) {
        qc.setQueriesData<any>({ queryKey: ['library-items-infinite'] }, (old) => {
          if (!old?.pages?.length) return old;
          const [firstPage, ...rest] = old.pages;
          // Avoid duplicates if the server refetch already included it.
          if ((firstPage.items ?? []).some((it: any) => it.id === newItem.id)) {
            return old;
          }
          return {
            ...old,
            pages: [
              {
                ...firstPage,
                items: [newItem, ...(firstPage.items ?? [])],
                total: (firstPage.total ?? 0) + 1,
              },
              ...rest,
            ],
          };
        });
      }
      qc.invalidateQueries({ queryKey: ['library-items'] });
      qc.invalidateQueries({ queryKey: ['subscription'] });
      qc.invalidateQueries({ queryKey: ['gamification'] });
      toast({ title: 'Document uploaded', description: 'Your file is being processed for AI search.' });
      recordActivity();
    },
    onError: (err: any) =>
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' }),
  });
}

export function useDeleteLibraryItem() {
  const qc = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: ({ id }: { id: string; storagePath?: string }) =>
      api.delete(`/api/v1/library/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['library-items'] });
      qc.invalidateQueries({ queryKey: ['library-items-infinite'] });
      toast({ title: 'Deleted', description: 'Item removed from library.' });
    },
  });
}

export function useUpdateLibraryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Record<string, any> }) =>
      api.patch<any>(`/api/v1/library/${id}`, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['library-items'] });
      qc.invalidateQueries({ queryKey: ['library-items-infinite'] });
    },
  });
}

/**
 * Subscribe to the backend SSE stream of Knowledge Vault status changes.
 *
 * Replaces the previous "poll the list endpoint every 3s while any item is
 * processing" loop. The Celery worker publishes a Redis message the moment a
 * file flips from `processing` → `ready` (or `failed`); the FastAPI
 * `/api/v1/library/events` endpoint forwards it as an SSE frame, and we patch
 * the matching item directly in every cached library-items-infinite query.
 *
 * Mount this once on any page that displays the vault list (e.g. LibraryPage).
 * The browser auto-reconnects EventSource on transient failures; on a clean
 * reconnect we also invalidate the list query so any state we missed while
 * disconnected is reconciled.
 */
export function useVaultEventsStream() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const userId = user?.id;

  useEffect(() => {
    if (!userId) return;
    const token = getToken();
    if (!token) return;

    // EventSource cannot set Authorization headers — pass token via query param.
    const url = `${BASE_URL}/api/v1/library/events?token=${encodeURIComponent(token)}`;
    let es: EventSource | null = null;
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      es = new EventSource(url);

      es.onmessage = (ev) => {
        try {
          const data = JSON.parse(ev.data);
          if (data?.type !== 'item_status' || !data.item_id) return;

          // Patch the matching item in every cached infinite-query page.
          qc.setQueriesData<any>({ queryKey: ['library-items-infinite'] }, (old) => {
            if (!old?.pages?.length) return old;
            let touched = false;
            const pages = old.pages.map((page: any) => {
              const items = (page.items ?? []).map((it: any) => {
                if (it.id !== data.item_id) return it;
                touched = true;
                return {
                  ...it,
                  processing_status: data.processing_status ?? it.processing_status,
                  is_processed: data.is_processed ?? it.is_processed,
                  extracted_text_ref: data.extracted_text_ref ?? it.extracted_text_ref,
                };
              });
              return { ...page, items };
            });
            return touched ? { ...old, pages } : old;
          });

          // Also patch the non-infinite cache, if anything is using it.
          qc.setQueriesData<any>({ queryKey: ['library-items'] }, (old) => {
            if (!Array.isArray(old)) return old;
            let touched = false;
            const next = old.map((it: any) => {
              if (it.id !== data.item_id) return it;
              touched = true;
              return {
                ...it,
                processing_status: data.processing_status ?? it.processing_status,
                is_processed: data.is_processed ?? it.is_processed,
                extracted_text_ref: data.extracted_text_ref ?? it.extracted_text_ref,
              };
            });
            return touched ? next : old;
          });
        } catch {
          /* ignore malformed frames */
        }
      };

      es.onerror = () => {
        // EventSource will auto-reconnect; reconcile any missed events on
        // recovery by refetching the list once.
        if (es) {
          es.close();
          es = null;
        }
        if (cancelled) return;
        qc.invalidateQueries({ queryKey: ['library-items-infinite'] });
        // Backoff before reconnecting.
        setTimeout(connect, 4000);
      };
    };

    connect();

    return () => {
      cancelled = true;
      if (es) {
        es.close();
        es = null;
      }
    };
  }, [userId, qc]);
}

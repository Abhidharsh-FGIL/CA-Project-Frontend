import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useUserPortal } from '@/contexts/UserPortalContext';
import { getAdminExamCards, getUserExamCards, logoSrc, saveAdminExamCards } from '@/lib/examCardsApi';
import { examLogo } from '@/lib/exam-logo';
import type { ExamCard } from '@/config/exam-cards';

/**
 * The admin's exam cards for the Exams page, or undefined until the server answers (or when it has none to give).
 * Callers treat undefined as "use the built-in page", so nothing waits on this.
 */
export function useExamCards(): ExamCard[] | undefined {
  const userId = useUserPortal().user?.user_id;
  const q = useQuery({
    queryKey: ['exam-cards', userId],
    queryFn: getUserExamCards,
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  return q.data && q.data.length > 0 ? q.data : undefined;
}

/** An exam's emblem: the one the admin uploaded for it, else the body's own. */
export function useExamLogo(groupId?: string | null): { src: string; alt: string } {
  const cards = useExamCards();
  return useMemo(() => {
    const card = cards?.find(c => c.id === groupId);
    return card?.logo_url ? { src: logoSrc(card.logo_url), alt: card.name || card.authority } : examLogo(groupId);
  }, [cards, groupId]);
}

export const ADMIN_EXAM_CARDS_KEY = ['admin-exam-cards'] as const;

export function useAdminExamCards() {
  return useQuery({ queryKey: ADMIN_EXAM_CARDS_KEY, queryFn: getAdminExamCards, retry: false, staleTime: 15 * 1000 });
}

/** Saves the whole list. The page the aspirant sees is refreshed with it. */
export function useSaveExamCards() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (cards: ExamCard[]) => saveAdminExamCards(cards),
    onSuccess: (_res, cards) => {
      qc.setQueryData(ADMIN_EXAM_CARDS_KEY, cards);
      qc.invalidateQueries({ queryKey: ['exam-cards'] });
    },
  });
}

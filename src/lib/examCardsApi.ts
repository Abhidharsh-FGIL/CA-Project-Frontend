import { api, buildUrl, userApi } from '@/lib/api';
import { parseExamCards, toExamCardsBody, type ExamCard } from '@/config/exam-cards';

/** GET /api/v1/user/exam-cards — the cards the Exams page lists. An empty list means "none saved": the built-in page. */
export async function getUserExamCards(): Promise<ExamCard[]> {
  return parseExamCards(await userApi.get<unknown>('/api/v1/user/exam-cards'));
}

/** GET /api/v1/admin/exam-cards — the same list for the admin. */
export async function getAdminExamCards(): Promise<ExamCard[]> {
  return parseExamCards(await api.get<unknown>('/api/v1/admin/exam-cards'));
}

/** PUT /api/v1/admin/exam-cards — replaces the whole list, so every card goes back, not only what changed. */
export function saveAdminExamCards(cards: ExamCard[]): Promise<unknown> {
  return api.put('/api/v1/admin/exam-cards', toExamCardsBody(cards));
}

/** POST /api/v1/admin/exam-cards/logo — a multipart `file`; answers `{ logo_url }`. The image is not on a card until the card is saved. */
export async function uploadExamLogo(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const res = await api.upload<{ logo_url?: string; url?: string }>('/api/v1/admin/exam-cards/logo', form);
  const url = res?.logo_url ?? res?.url;
  if (!url) throw new Error('The server did not return the image address.');
  return url;
}

/**
 * Where a card's logo is loaded from. The server may answer a full address or a path on itself; a data URI or a full
 * address is used as it is.
 */
export function logoSrc(logoUrl: string): string {
  return /^(https?:|data:)/i.test(logoUrl) ? logoUrl : buildUrl(logoUrl.startsWith('/') ? logoUrl : `/${logoUrl}`);
}

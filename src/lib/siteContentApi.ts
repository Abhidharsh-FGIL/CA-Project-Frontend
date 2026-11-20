import { api } from '@/lib/api';
import { parseOverrides, type ContentOverrides } from '@/content/store';

/** GET /api/v1/admin/site-content — the text the admin has changed (only those keys). See BACKEND_SITE_CONTENT.md. */
export async function getAdminSiteContent(): Promise<ContentOverrides> {
  return parseOverrides(await api.get<unknown>('/api/v1/admin/site-content'));
}

/** PUT /api/v1/admin/site-content — replaces the whole set. A key left out follows the built-in text. */
export function saveAdminSiteContent(content: ContentOverrides): Promise<unknown> {
  return api.put('/api/v1/admin/site-content', { content });
}

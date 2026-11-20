import { api, publicApi } from '@/lib/api';
import { DEFAULT_LIVE_EXAMS, liveExamsFromSettings, parseLiveExams } from '@/config/landing-settings';

/**
 * GET /api/v1/public/landing-settings — no sign-in: the landing page is public. `{ "live_exams": ["TNPSC Group 4 & 2", …] }`.
 * Resolves to the built-in list when the endpoint is absent or sends nothing usable. See BACKEND_LANDING_SETTINGS.md.
 */
export async function getLiveExams(): Promise<string[]> {
  try {
    return liveExamsFromSettings(await publicApi.get<unknown>('/api/v1/public/landing-settings'));
  } catch {
    return DEFAULT_LIVE_EXAMS;
  }
}

/** The admin's saved list — empty when none is saved yet (so the form can show the built-in list as its starting point). */
export async function getAdminLiveExams(): Promise<string[]> {
  return parseLiveExams(((await api.get<unknown>('/api/v1/admin/landing-settings')) as Record<string, unknown> | null)?.live_exams);
}

/** PUT /api/v1/admin/landing-settings — replaces the list. */
export function saveAdminLiveExams(liveExams: string[]): Promise<unknown> {
  return api.put('/api/v1/admin/landing-settings', { live_exams: liveExams });
}

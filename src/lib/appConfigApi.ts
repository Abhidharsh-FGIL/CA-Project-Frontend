import { api } from '@/lib/api';
import { parseAppConfig, toAppConfigBody, type AppConfig } from '@/config/app-config';

/**
 * GET /api/v1/admin/app-config — what the mobile app shows before sign-in. With nothing saved the server returns empty
 * strings and empty lists, which is an empty form, not an error.
 */
export async function getAdminAppConfig(): Promise<AppConfig> {
  return parseAppConfig(await api.get<unknown>('/api/v1/admin/app-config'));
}

/** PUT /api/v1/admin/app-config — replaces the whole document, so every field goes back, not only what changed. */
export function saveAdminAppConfig(config: AppConfig): Promise<unknown> {
  return api.put('/api/v1/admin/app-config', toAppConfigBody(config));
}

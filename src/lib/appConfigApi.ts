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

/**
 * POST /api/v1/admin/app-config/onboarding-image (multipart, field "file") → `{ image_url }`. PNG, JPEG or WebP, up to 1 MB.
 * Put the returned `image_url` on the slide; nothing is attached until the config is saved.
 */
export async function uploadOnboardingImage(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const res = (await api.upload<unknown>('/api/v1/admin/app-config/onboarding-image', form)) as { image_url?: unknown } | null;
  if (typeof res?.image_url !== 'string' || !res.image_url) throw new Error('The server did not return a picture address.');
  return res.image_url;
}

/**
 * POST /api/v1/admin/app-config/banner-image (multipart, field "file") → `{ image_url }`. PNG, JPEG or WebP, up to 1 MB.
 * Put the returned `image_url` on the banner; nothing is attached until the config is saved.
 */
export async function uploadBannerImage(file: File): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  const res = (await api.upload<unknown>('/api/v1/admin/app-config/banner-image', form)) as { image_url?: unknown } | null;
  if (typeof res?.image_url !== 'string' || !res.image_url) throw new Error('The server did not return a picture address.');
  return res.image_url;
}

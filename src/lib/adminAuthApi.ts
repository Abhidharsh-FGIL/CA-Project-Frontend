/**
 * Admin Portal authentication API.
 *
 * Endpoints (verified against the live Postman collection):
 *   POST  /api/v1/admin/auth/signup   → { name, email, password }     (first-time only)
 *   POST  /api/v1/admin/auth/login    → { email, password }
 *   POST  /api/v1/admin/auth/logout   → { refresh_token }  (Authorization required)
 *
 * Tokens land in the SAME localStorage slot as user tokens. Admin and user
 * sessions are therefore mutually exclusive in this client — calling
 * `loginAdmin` after a `loginUser` overwrites the access token.
 */
import { api, setTokens, clearTokens } from './api';
import type { AuthTokenResponse, MessageSuccess } from './userAuthApi';

export type AdminRole = 'super_admin' | 'content_admin';

export interface AdminProfile {
  admin_id: string;
  name: string;
  email: string;
  role: AdminRole;
  is_active: boolean;
  created_at: string;
}

export interface AdminSignupPayload {
  name: string;
  email: string;
  password: string;
}

export interface AdminLoginPayload {
  email: string;
  password: string;
}

export function signupAdmin(payload: AdminSignupPayload) {
  return api.post<AdminProfile>('/api/v1/admin/auth/signup', payload);
}

export async function loginAdmin(payload: AdminLoginPayload): Promise<AuthTokenResponse> {
  const res = await api.post<AuthTokenResponse>('/api/v1/admin/auth/login', payload);
  if (res?.access_token && res?.refresh_token) setTokens(res.access_token, res.refresh_token);
  return res;
}

export async function logoutAdmin(): Promise<MessageSuccess> {
  const refreshToken = localStorage.getItem('refresh_token') || '';
  try {
    return await api.post<MessageSuccess>('/api/v1/admin/auth/logout', { refresh_token: refreshToken });
  } finally {
    clearTokens();
  }
}

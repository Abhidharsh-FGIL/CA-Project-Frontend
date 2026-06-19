/**
 * User Portal authentication & profile API.
 *
 * Unauthenticated endpoints (no token sent):
 *   POST  /api/v1/user/auth/register/           → { full_name, email_address, mobile_number, password }
 *   POST  /api/v1/user/auth/verify-otp/         → { email_address, otp }
 *   POST  /api/v1/user/auth/resend-otp/         → { email_address }
 *   POST  /api/v1/user/auth/login/              → { email, password }
 *   POST  /api/v1/user/auth/forgot-password/    → { email }
 *   POST  /api/v1/user/auth/reset-password/     → { token, new_password }
 *
 * Authenticated endpoints (sends user_access_token):
 *   POST  /api/v1/user/auth/logout/             → no body
 *   GET   /api/v1/user/profile/                 → UserProfile
 *   PUT   /api/v1/user/profile/                 → { name, phone }
 *   PUT   /api/v1/user/profile/change-password/ → { old_password, new_password }
 *
 * Trailing slashes are required — FastAPI issues a 307 redirect for paths
 * without them, which loses the POST body in some redirect-follow scenarios.
 */
import { publicApi, userApi, setUserTokens, clearUserTokens } from './api';

// ─── Response shapes ──────────────────────────────────────────────────────────

export interface AuthTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: 'bearer';
}

export interface MessageSuccess {
  message: string;
  success: boolean;
}

export interface UserProfile {
  user_id: string;
  name: string;
  email: string;
  phone: string;
  otp_verified: boolean;
  phone_verified: boolean;
  subscription_tier: 'free' | 'standard' | 'ultimate' | 'premium';
  subscription_expiry: string | null;
  created_at: string;
  is_active: boolean;
}

// ─── Request payload shapes ───────────────────────────────────────────────────

export interface RegisterPayload {
  full_name: string;
  email_address: string;
  mobile_number: string;
  password: string;
}

export interface VerifyOtpPayload {
  email_address: string;
  otp: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface ResetPasswordPayload {
  token: string;
  new_password: string;
}

export interface ChangePasswordPayload {
  old_password: string;
  new_password: string;
}

export interface UpdateProfilePayload {
  name?: string;
  phone?: string;
}

// ─── Unauthenticated auth endpoints (publicApi — no token ever sent) ─────────

export function registerUser(payload: RegisterPayload) {
  return publicApi.post<MessageSuccess>('/api/v1/user/auth/register', payload);
}

export async function verifyUserOtp(payload: VerifyOtpPayload): Promise<AuthTokenResponse> {
  const res = await publicApi.post<AuthTokenResponse>('/api/v1/user/auth/verify-otp', payload);
  if (res?.access_token && res?.refresh_token) setUserTokens(res.access_token, res.refresh_token);
  return res;
}

export function resendUserOtp(email_address: string) {
  return publicApi.post<MessageSuccess>('/api/v1/user/auth/resend-otp', { email_address });
}

export async function loginUser(payload: LoginPayload): Promise<AuthTokenResponse> {
  const res = await publicApi.post<AuthTokenResponse>('/api/v1/user/auth/login', payload);
  if (res?.access_token && res?.refresh_token) setUserTokens(res.access_token, res.refresh_token);
  return res;
}

export function forgotUserPassword(email: string) {
  return publicApi.post<MessageSuccess>('/api/v1/user/auth/forgot-password', { email });
}

export function resetUserPassword(payload: ResetPasswordPayload) {
  return publicApi.post<MessageSuccess>('/api/v1/user/auth/reset-password', payload);
}

// ─── Authenticated endpoints (userApi — sends user_access_token) ─────────────

export async function logoutUser(): Promise<MessageSuccess> {
  try {
    const res = await userApi.post<MessageSuccess>('/api/v1/user/auth/logout');
    return res;
  } finally {
    clearUserTokens();
  }
}

export function getUserProfile() {
  return userApi.get<UserProfile>('/api/v1/user/profile/');
}

export function updateUserProfile(payload: UpdateProfilePayload) {
  return userApi.put<UserProfile>('/api/v1/user/profile/', payload);
}

export function changeUserPassword(payload: ChangePasswordPayload) {
  return userApi.put<MessageSuccess>('/api/v1/user/profile/change-password', payload);
}

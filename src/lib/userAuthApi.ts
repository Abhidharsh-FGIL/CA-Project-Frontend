/**
 * User Portal authentication & profile API.
 *
 * Unauthenticated endpoints (no token sent):
 *   POST  /api/v1/user/auth/register/           → { full_name, email_address, mobile_number, password,
 *                                                    date_of_birth, gender, student_class, section, roll_no,
 *                                                    school_name, medium, class_teacher, academic_year,
 *                                                    preferred_exam }  (all required)
 *   POST  /api/v1/user/auth/verify-otp/         → { email_address, otp }
 *   POST  /api/v1/user/auth/resend-otp/         → { email_address }
 *   POST  /api/v1/user/auth/login/              → { email, password }
 *   POST  /api/v1/user/auth/login-otp/send      → { identifier }  (an email ID or a 10-digit mobile number)
 *   POST  /api/v1/user/auth/login-otp/verify    → { identifier, otp }  (answers as /login does)
 *   POST  /api/v1/user/auth/google              → { id_token, profile? }  (see `googleAuth`)
 *   POST  /api/v1/user/auth/forgot-password/    → { email }
 *   POST  /api/v1/user/auth/reset-password/     → { token, new_password }
 *
 * Authenticated endpoints (sends user_access_token):
 *   POST  /api/v1/user/auth/logout/             → no body
 *   GET   /api/v1/user/profile/                 → UserProfile (now includes the 10 student-detail fields)
 *   POST  /api/v1/user/profile/                 → { name?, phone?, + 10 student-detail fields, all optional }
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

/**
 * Student-detail fields added to the school portal. Present on the profile
 * response and accepted (optionally) on profile update; required on register.
 */
export interface StudentDetailFields {
  /** ISO date, e.g. "2012-03-12" */
  date_of_birth: string;
  gender: string;
  /** Class/grade as a string, e.g. "8" */
  student_class: string;
  section: string;
  roll_no: string;
  school_name: string;
  medium: string;
  class_teacher: string;
  /** e.g. "2025-26" */
  academic_year: string;
  /**
   * Which exam the aspirant is preparing for — a `TNPSC_GROUPS` id
   * (`group-1` | `group-4` | `gat-b`), not the display label, so the value stays
   * stable if a group is ever renamed. Chosen at registration and mandatory.
   */
  preferred_exam: string;
}

export interface UserProfile extends Partial<StudentDetailFields> {
  /**
   * Multi-select variant of `preferred_exam` (see §7.9 of TNPSC_API_SPEC.md). The
   * live API returns both; the portal reads whichever is populated.
   */
  target_groups?: string[];
  user_id: string;
  name: string;
  email: string;
  phone: string;
  /** Curriculum board (e.g. CBSE) — drives the dashboard assessments filter. */
  board?: string;
  otp_verified: boolean;
  phone_verified: boolean;
  subscription_tier: 'free' | 'standard' | 'ultimate' | 'premium';
  subscription_expiry: string | null;
  created_at: string;
  is_active: boolean;
}

// ─── Request payload shapes ───────────────────────────────────────────────────

export interface RegisterPayload extends StudentDetailFields {
  full_name: string;
  email_address: string;
  mobile_number: string;
}

export interface VerifyOtpPayload {
  email_address: string;
  otp: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginOtpPayload {
  /** The same email ID or mobile number the code was sent for. */
  identifier: string;
  otp: string;
}

export interface ResetPasswordPayload {
  token: string;
  new_password: string;
}

export interface ChangePasswordPayload {
  old_password: string;
  new_password: string;
}

export interface UpdateProfilePayload extends Partial<StudentDetailFields> {
  name?: string;
  phone?: string;
}

// ─── Unauthenticated auth endpoints (publicApi — no token ever sent) ─────────

export function registerUser(payload: RegisterPayload) {
  return publicApi.post<MessageSuccess>('/api/v1/user/auth/register', payload);
}

/** Keep the tokens of a successful sign-in where the authenticated client reads them. */
function keepTokens(res: AuthTokenResponse): AuthTokenResponse {
  if (res?.access_token && res?.refresh_token) setUserTokens(res.access_token, res.refresh_token);
  return res;
}

export async function verifyUserOtp(payload: VerifyOtpPayload): Promise<AuthTokenResponse> {
  return keepTokens(await publicApi.post<AuthTokenResponse>('/api/v1/user/auth/verify-otp', payload));
}

export function resendUserOtp(email_address: string) {
  return publicApi.post<MessageSuccess>('/api/v1/user/auth/resend-otp', { email_address });
}

export async function loginUser(payload: LoginPayload): Promise<AuthTokenResponse> {
  return keepTokens(await publicApi.post<AuthTokenResponse>('/api/v1/user/auth/login', payload));
}

/**
 * Ask for a one-time password to be sent to the account behind an email ID or a mobile number.
 * The reply's `message` names where it went, masked ("OTP sent to your registered email
 * ez********@gmail.com"). 429 means it was asked for again inside the 60 seconds.
 */
export function sendLoginOtp(identifier: string) {
  return publicApi.post<MessageSuccess>('/api/v1/user/auth/login-otp/send', { identifier });
}

/** Sign in with that password. Answers exactly as `loginUser` does, so the tokens are kept the same way. */
export async function verifyLoginOtp(payload: LoginOtpPayload): Promise<AuthTokenResponse> {
  return keepTokens(await publicApi.post<AuthTokenResponse>('/api/v1/user/auth/login-otp/verify', payload));
}

/** What a new account needs beyond what Google gives (name and email): the same details the sign-up form asks for. */
export type GoogleSignUpProfile = StudentDetailFields & {
  full_name: string;
  mobile_number: string;
};

export type GoogleAuthResult =
  /** Signed in (an existing account), or the account was created from `profile` and signed in. */
  | { kind: 'signed-in' }
  /** Google is fine but no account exists yet, and no `profile` was sent to make one with. */
  | { kind: 'needs-profile'; email: string; name: string };

/**
 * Sign in or sign up with a Google ID token.
 *
 * The token is sent to the backend, which checks Google's signature and that it was issued for this app's
 * client ID — the page never decides who the person is. An email Google has verified needs no OTP.
 *
 *   existing account            → 200 { access_token, refresh_token, token_type }
 *   no account, no `profile`    → 200 { needs_profile: true, email, name }
 *   no account, with `profile`  → the account is created, then the same tokens
 */
export async function googleAuth(idToken: string, profile?: GoogleSignUpProfile): Promise<GoogleAuthResult> {
  const res = await publicApi.post<Partial<AuthTokenResponse> & { needs_profile?: boolean; email?: string; name?: string }>(
    '/api/v1/user/auth/google',
    { id_token: idToken, ...(profile ? { profile } : {}) },
  );
  if (res?.access_token && res?.refresh_token) {
    keepTokens(res as AuthTokenResponse);
    return { kind: 'signed-in' };
  }
  if (res?.needs_profile) return { kind: 'needs-profile', email: res.email ?? '', name: res.name ?? '' };
  throw new Error('Google sign-in did not complete. Please try again.');
}

export function forgotUserPassword(email: string) {
  return publicApi.post<MessageSuccess>('/api/v1/user/auth/forgot-password', { email });
}

export function resetUserPassword(payload: ResetPasswordPayload) {
  return publicApi.post<MessageSuccess>('/api/v1/user/auth/reset-password', payload);
}

// ─── Authenticated endpoints (userApi — sends user_access_token) ─────────────

/**
 * Sign out: tell the server, and forget the tokens *now*.
 *
 * The request is started with the token it needs, then the browser drops its tokens at once instead of
 * when the server answers. Anything that looks at the tokens straight after — the landing page, which
 * sends a signed-in visitor to the dashboard — must find the person already signed out; waiting for the
 * reply left a window where it did not, and the first press of Logout bounced back to the dashboard.
 */
export function logoutUser(): Promise<MessageSuccess> {
  const request = userApi.post<MessageSuccess>('/api/v1/user/auth/logout');
  clearUserTokens();
  return request;
}

export function getUserProfile() {
  return userApi.get<UserProfile>('/api/v1/user/profile/');
}

export function updateUserProfile(payload: UpdateProfilePayload) {
  return userApi.post<UserProfile>('/api/v1/user/profile/', payload);
}

export function changeUserPassword(payload: ChangePasswordPayload) {
  return userApi.put<MessageSuccess>('/api/v1/user/profile/change-password', payload);
}

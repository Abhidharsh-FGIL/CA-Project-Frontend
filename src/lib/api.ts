/**
 * Centralized API client for the FastAPI backend.
 * Replaces all Supabase direct calls.
 */
import { toast } from 'sonner';

// Backend root URL — read from VITE_API_BASE_URL in .env, no trailing slash.
export const BASE_URL: string =
  (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ??
  'https://futuregenautomation.com/school_assessment/api';

// Loud, unmistakable log so it's obvious in DevTools Console what URL is live
console.log(
  `%c[API] BASE_URL = %c${BASE_URL}`,
  'font-weight:bold;color:#6366f1;font-size:13px',
  'background:#dcfce7;color:#166534;padding:3px 8px;border-radius:4px;font-family:monospace;font-size:13px',
);
console.log(
  `%c[API] Sample resolved URL  →  ${BASE_URL}/api/v1/user/profile`,
  'color:#6b7280;font-size:11px',
);

/**
 * Build the full URL for an API path.
 *
 * Concatenates BASE_URL with the given path. The only dedup performed is when
 * `path` already starts with the FULL pathname of BASE_URL — that protects
 * against backends that return absolute paths including the deployment prefix
 * (e.g. backend returns "/genverse_test/api/uploads/..." while BASE_URL is
 * "https://x/genverse_test/api").
 *
 * NOTE: partial / tail-head overlap is intentionally NOT deduped, because
 * some backends genuinely have duplicated segments. For example, with
 *   BASE_URL = "https://x/assessment_portal/api"
 *   path     = "/api/v1/user/profile"
 * the expected full URL is "https://x/assessment_portal/api/api/v1/user/profile"
 * (deployment path "/api" + API path "/api/v1/...").
 */
export function buildUrl(path: string): string {
  // If path is already a full URL, return as-is
  if (path.startsWith('http://') || path.startsWith('https://')) return path;

  try {
    const basePath = new URL(BASE_URL).pathname.replace(/\/+$/, '');
    if (basePath && basePath !== '/' && path.startsWith(basePath)) {
      // Full-prefix dedup: backend echoed the deployment prefix
      path = path.slice(basePath.length);
    }
  } catch {
    // BASE_URL is not a full URL (e.g. relative), skip dedup
  }

  return `${BASE_URL}${path}`;
}

/**
 * Turn an error body into a throwable Error.
 *
 * `detail` may be a plain string or a structured object — the backend uses the
 * structured form for business-rule failures (e.g. `{code: "LEVEL_LOCKED",
 * message, required_level, ...}`). Surface `message` as the Error text so toasts
 * stay readable, and hang the parsed object off `.code` / `.detail` so callers
 * can branch on it.
 */
export function toRequestError(body: any, status: number): Error {
  const detail = body?.detail ?? body;
  if (detail && typeof detail === 'object' && typeof detail.message === 'string') {
    const error = new Error(detail.message);
    (error as any).code = detail.code;
    (error as any).detail = detail;
    (error as any).status = status;
    return error;
  }
  const msg: unknown = body?.detail ?? body?.message ?? `Request failed: ${status}`;
  const error = new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  (error as any).status = status;
  return error;
}

const TOKEN_KEY = 'access_token';
const REFRESH_KEY = 'refresh_token';

// User portal uses separate keys so admin and user sessions never clash
const USER_TOKEN_KEY = 'user_access_token';
const USER_REFRESH_KEY = 'user_refresh_token';

// ─── Admin token helpers ──────────────────────────────────────────────────────

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setTokens(access: string, refresh: string): void {
  localStorage.setItem(TOKEN_KEY, access);
  localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

// ─── User portal token helpers ────────────────────────────────────────────────

export function getUserToken(): string | null {
  return localStorage.getItem(USER_TOKEN_KEY);
}

export function setUserTokens(access: string, refresh: string): void {
  localStorage.setItem(USER_TOKEN_KEY, access);
  localStorage.setItem(USER_REFRESH_KEY, refresh);
}

export function clearUserTokens(): void {
  localStorage.removeItem(USER_TOKEN_KEY);
  localStorage.removeItem(USER_REFRESH_KEY);
}

// ─── Public (no-auth) client for unauthenticated user-auth endpoints ─────────
//
// Never sends any Authorization header. Never tries token refresh. Never
// redirects to /login. Safe to call from register / login / forgot-password etc.
// Error parsing supports both FastAPI format ({ detail }) and user-auth API
// format ({ success, error_code, message }).

async function publicApiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const res = await fetch(buildUrl(path), {
    ...options,
    headers: { ...((options.headers as Record<string, string>) ?? {}), ...headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    // user-auth API: { success, error_code, message, details }
    // FastAPI standard: { detail }
    throw toRequestError(err, res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const publicApi = {
  post: <T>(path: string, body?: unknown) =>
    publicApiRequest<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
};

// ─── Authenticated user-portal client (sends user_access_token) ──────────────

async function userApiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const makeUserRequest = (tkn: string | null) => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (tkn) headers['Authorization'] = `Bearer ${tkn}`;
    return fetch(buildUrl(path), {
      ...options,
      headers: { ...((options.headers as Record<string, string>) ?? {}), ...headers },
    });
  };

  let res = await makeUserRequest(getUserToken());

  // Auto-refresh user token once on 401, but never on the refresh endpoint itself
  const isUserAuthEndpoint = path.includes('/user/auth/login') || path.includes('/user/auth/refresh');
  if (res.status === 401 && !isUserAuthEndpoint) {
    const newToken = await refreshUserAccessToken();
    if (newToken) {
      res = await makeUserRequest(newToken);
    } else {
      window.location.href = `${import.meta.env.BASE_URL || '/'}#/user/login`;
      throw new Error('Session expired');
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw toRequestError(err, res.status);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const userApi = {
  get:    <T>(path: string)                   => userApiRequest<T>(path, { method: 'GET' }),
  post:   <T>(path: string, body?: unknown)   => userApiRequest<T>(path, { method: 'POST',   body: JSON.stringify(body ?? {}) }),
  put:    <T>(path: string, body?: unknown)   => userApiRequest<T>(path, { method: 'PUT',    body: JSON.stringify(body ?? {}) }),
  patch:  <T>(path: string, body?: unknown)   => userApiRequest<T>(path, { method: 'PATCH',  body: JSON.stringify(body ?? {}) }),
  delete: <T>(path: string)                   => userApiRequest<T>(path, { method: 'DELETE' }),
};

// ─── Token refresh ────────────────────────────────────────────────────────────

/** Refresh the admin access token via the admin-specific endpoint. */
export async function refreshAccessToken(): Promise<string | null> {
  const refresh = localStorage.getItem(REFRESH_KEY);
  if (!refresh) return null;
  try {
    const res = await fetch(buildUrl('/api/v1/admin/auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
    });
    if (!res.ok) {
      clearTokens();
      return null;
    }
    const data = await res.json();
    setTokens(data.access_token, data.refresh_token);
    return data.access_token;
  } catch {
    clearTokens();
    return null;
  }
}

/** Refresh the user portal access token via the user-specific endpoint. */
export async function refreshUserAccessToken(): Promise<string | null> {
  const refresh = localStorage.getItem(USER_REFRESH_KEY);
  if (!refresh) return null;
  try {
    const res = await fetch(buildUrl('/api/v1/user/auth/refresh'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refresh }),
    });
    if (!res.ok) {
      clearUserTokens();
      return null;
    }
    const data = await res.json();
    setUserTokens(data.access_token, data.refresh_token);
    return data.access_token;
  } catch {
    clearUserTokens();
    return null;
  }
}

// ─── Custom API error ────────────────────────────────────────────────────────

/** Error thrown by API calls. `handled = true` means a toast was already shown. */
export class ApiError extends Error {
  handled: boolean;
  constructor(message: string, handled = false) {
    super(message);
    this.name = 'ApiError';
    this.handled = handled;
  }
}

// ─── Structured error parsing ────────────────────────────────────────────────

const FEATURE_LABELS: Record<string, string> = {
  ai_chat: 'AI Assistant',
  vault_ai_chat: 'Knowledge Vault Chat',
  create_assessment: 'Assessment Hub',
  ocr_extraction: 'OCR Extraction',
  ebook_create: 'eBook Creator',
  career_guidance: 'Career Guidance',
  playground_rapid_mcq: 'Speed Blitz',
  playground_concept_connect: 'Concept Connect',
  playground_roleplay: 'RolePlay',
  playground_imagine: 'Imagine',
  insight_feed: 'Insight Feed',
  library_upload: 'Library Upload',
};

/**
 * Parses structured backend errors into user-friendly messages.
 * Shows a toast for actionable errors (insufficient points, limits, gating).
 * Returns { message, handled } where handled=true means toast was already shown.
 */
function parseApiError(detail: any, status: number): { message: string; handled: boolean } {
  if (typeof detail === 'string') return { message: detail, handled: false };
  if (!detail || typeof detail !== 'object') return { message: `Request failed: ${status}`, handled: false };

  const errorType = detail.error;

  if (errorType === 'insufficient_points') {
    const msg = 'You\'ve run out of AI points. Upgrade your plan or purchase additional points to continue.';
    toast.error('Insufficient Points', {
      description: msg,
      duration: 6000,
      action: { label: 'Upgrade', onClick: () => { window.location.href = `${import.meta.env.BASE_URL || '/'}#/user/subscription`; } },
    });
    return { message: msg, handled: true };
  }

  if (errorType === 'usage_limit_exceeded') {
    const label = FEATURE_LABELS[detail.feature_key] || detail.feature_key?.replace(/_/g, ' ') || 'this feature';
    const msg = `You've reached the ${detail.period || 'usage'} limit for ${label}. Upgrade your plan for higher limits.`;
    toast.error('Usage Limit Reached', {
      description: msg,
      duration: 6000,
      action: { label: 'Upgrade', onClick: () => { window.location.href = `${import.meta.env.BASE_URL || '/'}#/user/subscription`; } },
    });
    return { message: msg, handled: true };
  }

  if (errorType === 'feature_gated') {
    const label = FEATURE_LABELS[detail.feature_key] || detail.feature_key?.replace(/_/g, ' ') || 'This feature';
    const msg = `${label} is not available on your current plan. Upgrade to unlock this feature.`;
    toast.error('Feature Restricted', {
      description: msg,
      duration: 6000,
      action: { label: 'Upgrade', onClick: () => { window.location.href = `${import.meta.env.BASE_URL || '/'}#/user/subscription`; } },
    });
    return { message: msg, handled: true };
  }

  if (errorType === 'subscription_inactive') {
    const msg = 'Your subscription is not active. Renew or upgrade to continue using this feature.';
    toast.error('Subscription Inactive', {
      description: msg,
      duration: 6000,
      action: { label: 'View Plans', onClick: () => { window.location.href = `${import.meta.env.BASE_URL || '/'}#/user/subscription`; } },
    });
    return { message: msg, handled: true };
  }

  if (errorType === 'no_subscription') {
    const msg = 'No active subscription found. Subscribe to start using this feature.';
    toast.error('No Subscription', {
      description: msg,
      duration: 6000,
      action: { label: 'Subscribe', onClick: () => { window.location.href = `${import.meta.env.BASE_URL || '/'}#/user/subscription`; } },
    });
    return { message: msg, handled: true };
  }

  return { message: detail.message || `Request failed: ${status}`, handled: false };
}

/**
 * Parses a streaming response error body and returns { message, handled }.
 * handled=true means a toast was already shown by parseApiError.
 */
export async function parseStreamError(res: Response): Promise<{ message: string; handled: boolean }> {
  try {
    const errBody = await res.json();
    return parseApiError(errBody?.detail, res.status);
  } catch {
    return { message: `Request failed: ${res.status}`, handled: false };
  }
}

// ─── Core request ─────────────────────────────────────────────────────────────

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  let token = getToken();
  const url = buildUrl(path);

  // Dev-only: log every outgoing request so you can verify the URL + auth
  if (import.meta.env.DEV) {
    console.log(
      `%c[API] ${options.method || 'GET'} %c${url}%c  ${token ? '🔑 with token' : '🔓 no token'}`,
      'font-weight:bold;color:#6366f1',
      'color:#0ea5e9;font-family:monospace',
      token ? 'color:#16a34a' : 'color:#dc2626',
    );
  }

  const makeRequest = async (targetUrl: string, tok: string | null): Promise<Response> => {
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };
    if (tok) headers['Authorization'] = `Bearer ${tok}`;
    // Don't set Content-Type for FormData — browser sets it with the boundary
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }
    // redirect:'manual' lets us inspect 3xx ourselves. FastAPI sometimes issues
    // 307s whose Location header omits the deployment prefix (e.g. it sends
    // "/api/v1/foo/" instead of "/assessment_portal/api/api/v1/foo/"). If we
    // let the browser auto-follow that, it resolves against the bare origin
    // and drops our prefix. We re-prepend BASE_URL and retry manually below.
    return fetch(targetUrl, { ...options, headers, redirect: 'manual' });
  };

  let res = await makeRequest(url, token);

  // Follow up to 3 manual redirects, re-prepending BASE_URL on relative Locations.
  let redirectsFollowed = 0;
  while (
    redirectsFollowed < 3 &&
    (res.status === 301 || res.status === 302 || res.status === 307 || res.status === 308 ||
     // fetch with redirect:'manual' marks opaque-redirect responses as type 'opaqueredirect'
     res.type === 'opaqueredirect')
  ) {
    redirectsFollowed += 1;
    let location = res.headers.get('Location');
    // Opaque redirects hide headers; in that case we can only guess that
    // FastAPI added a trailing slash. Append "/" and retry.
    if (!location && res.type === 'opaqueredirect') {
      location = path.endsWith('/') ? path : path + '/';
    }
    if (!location) break;
    // If Location is absolute and matches our origin but is missing the
    // deployment prefix, swap it back in. If it's a relative path, rebuild
    // against BASE_URL so the deployment prefix is preserved.
    let nextUrl: string;
    if (location.startsWith('http://') || location.startsWith('https://')) {
      try {
        const loc = new URL(location);
        const base = new URL(BASE_URL);
        if (loc.origin === base.origin && !loc.pathname.startsWith(base.pathname)) {
          // Browser-followed redirect that lost our prefix — restore it
          nextUrl = `${BASE_URL}${loc.pathname}${loc.search}${loc.hash}`;
        } else {
          nextUrl = location;
        }
      } catch {
        nextUrl = location;
      }
    } else {
      // Relative path — re-prepend BASE_URL to preserve deployment prefix
      nextUrl = `${BASE_URL}${location.startsWith('/') ? '' : '/'}${location}`;
    }
    if (import.meta.env.DEV) {
      console.log(
        `%c[API] ↪ ${res.status} redirect: %c${nextUrl}`,
        'color:#f59e0b;font-weight:bold',
        'color:#0ea5e9;font-family:monospace',
      );
    }
    res = await makeRequest(nextUrl, token);
  }

  // Try token refresh once on 401, but not for auth endpoints themselves
  const isAuthEndpoint = path.includes('/admin/auth/login') || path.includes('/admin/auth/signup') || path.includes('/admin/auth/refresh');
  if (res.status === 401 && !isAuthEndpoint) {
    token = await refreshAccessToken();
    if (token) {
      res = await makeRequest(url, token);
    } else {
      // Redirect to login if we can't refresh
      window.location.href = `${import.meta.env.BASE_URL || '/'}#/adminlogin`;
      throw new Error('Session expired');
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    // FastAPI standard errors nest the message inside `detail`.
    // User-auth API returns a flat object: { message, error_code, success }.
    // Fall back from detail → top-level message → entire object so both formats work.
    const detail = err.detail !== undefined ? err.detail
      : err.message !== undefined ? err.message
      : err;
    const { message: msg, handled } = parseApiError(detail, res.status);
    throw new ApiError(msg, handled);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

// ─── Typed helpers ────────────────────────────────────────────────────────────

export const api = {
  get: <T>(path: string) =>
    apiRequest<T>(path, { method: 'GET' }),

  post: <T>(path: string, body?: unknown) =>
    apiRequest<T>(path, {
      method: 'POST',
      body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
    }),

  patch: <T>(path: string, body?: unknown) =>
    apiRequest<T>(path, {
      method: 'PATCH',
      body: JSON.stringify(body ?? {}),
    }),

  put: <T>(path: string, body?: unknown) =>
    apiRequest<T>(path, {
      method: 'PUT',
      body: JSON.stringify(body ?? {}),
    }),

  delete: <T>(path: string) =>
    apiRequest<T>(path, { method: 'DELETE' }),

  /** Multipart file upload — pass a pre-built FormData */
  upload: <T>(path: string, formData: FormData) =>
    apiRequest<T>(path, { method: 'POST', body: formData }),
};

/**
 * Download a binary file from the backend (PDF, DOCX, etc.).
 * Handles auth + token refresh the same way as apiRequest.
 * Returns a Blob on success.
 */
export async function apiDownload(path: string): Promise<Blob> {
  const url = buildUrl(path);
  let token = getToken();

  const makeRequest = async (tok: string | null): Promise<Response> => {
    const headers: Record<string, string> = {};
    if (tok) headers['Authorization'] = `Bearer ${tok}`;
    return fetch(url, { method: 'GET', headers });
  };

  let res = await makeRequest(token);

  if (res.status === 401) {
    token = await refreshAccessToken();
    if (token) {
      res = await makeRequest(token);
    } else {
      window.location.href = `${import.meta.env.BASE_URL || '/'}#/adminlogin`;
      throw new Error('Session expired');
    }
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    const detail = err.detail ?? err;
    // Use the centralized error parser for structured errors (feature_gated, usage_limit, etc.)
    const parsed = parseApiError(detail, res.status);
    throw new Error(parsed.message || (typeof detail === 'string' ? detail : `Download failed: ${res.status}`));
  }

  return res.blob();
}

// ─── SSE streaming helper ─────────────────────────────────────────────────────

/**
 * Opens a server-sent-event stream to the backend.
 * Calls `onChunk` for every non-empty data line.
 * Returns a cancel function.
 */
export function streamRequest(
  path: string,
  body: unknown,
  onChunk: (text: string) => void | Promise<void>,
  onDone?: () => void,
  onError?: (err: Error) => void
): () => void {
  const url = buildUrl(path);
  const controller = new AbortController();

  (async () => {
    try {
      let token = getToken();

      const makeReq = (tok: string | null) =>
        fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

      let res = await makeReq(token);

      // Refresh token on 401
      if (res.status === 401) {
        token = await refreshAccessToken();
        if (token) {
          res = await makeReq(token);
        } else {
          window.location.href = `${import.meta.env.BASE_URL || '/'}#/adminlogin`;
          onError?.(new Error('Session expired'));
          return;
        }
      }

      if (!res.ok || !res.body) {
        let msg = `Stream failed: ${res.status}`;
        let handled = false;
        try {
          const errBody = await res.json();
          const parsed = parseApiError(errBody?.detail, res.status);
          msg = parsed.message;
          handled = parsed.handled;
        } catch { /* couldn't parse */ }
        onError?.(new ApiError(msg, handled));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        // Process complete lines only; keep the last partial line in the buffer
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? ''; // last element may be incomplete
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            const chunk = trimmed.slice(6);
            if (chunk !== '[DONE]') await onChunk(chunk);
          }
        }
      }
      // Flush any remaining data in the buffer
      if (buffer.trim().startsWith('data: ')) {
        const chunk = buffer.trim().slice(6);
        if (chunk !== '[DONE]') await onChunk(chunk);
      }
      onDone?.();
    } catch (err: unknown) {
      if ((err as Error).name !== 'AbortError') {
        onError?.(err as Error);
      }
    }
  })();

  return () => controller.abort();
}

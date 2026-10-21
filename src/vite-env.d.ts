/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend base URL, no trailing slash. */
  readonly VITE_API_BASE_URL?: string;
  /** Google OAuth client ID (public). Empty or unset turns Sign in with Google off. */
  readonly VITE_GOOGLE_CLIENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

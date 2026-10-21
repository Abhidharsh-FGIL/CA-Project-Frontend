/**
 * Sign in with Google.
 *
 * The one setting is the OAuth **client ID** from the Google Cloud console (Credentials → OAuth client ID →
 * Web application). It is public by design — it ends up in the page for anyone to read — so it lives in the
 * environment (`VITE_GOOGLE_CLIENT_ID`, in `.env` / `.env.local`, never committed) only so each deployment
 * can use its own, not to keep it secret.
 *
 * The client *secret* is a different thing and has no place here: the browser never needs it. The backend
 * checks the Google token the page hands it against this same client ID.
 *
 * Left empty, Google sign-in is off: the buttons are not drawn and nothing else changes.
 */
export const GOOGLE_CLIENT_ID: string = ((import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? '').trim();

export const GOOGLE_ENABLED: boolean = GOOGLE_CLIENT_ID.length > 0;

if (import.meta.env.DEV && !GOOGLE_ENABLED) {
  // Development only: the buttons are simply absent without an ID, which looks like a bug rather than a setting.
  console.info('[Google sign-in] off — set VITE_GOOGLE_CLIENT_ID in .env.local and restart the dev server to show the button.');
}

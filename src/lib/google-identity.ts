/**
 * Google Identity Services, as far as this app needs it: load Google's script once, draw its button, and
 * read the name and email out of the token it hands back.
 *
 * What the button returns is an *ID token* — a JWT signed by Google. The page only reads it to prefill a
 * form; it is the backend that checks the signature and decides who the person is. Nothing read here is
 * trusted.
 */

const SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

export interface GoogleButtonOptions {
  theme?: 'outline' | 'filled_blue' | 'filled_black';
  size?: 'large' | 'medium' | 'small';
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
  shape?: 'rectangular' | 'pill' | 'circle' | 'square';
  /** Pixels; Google draws it between 200 and 400. */
  width?: number;
  logo_alignment?: 'left' | 'center';
  locale?: string;
}

interface GoogleId {
  initialize(config: { client_id: string; callback: (response: { credential?: string }) => void; ux_mode?: 'popup' | 'redirect'; auto_select?: boolean }): void;
  renderButton(parent: HTMLElement, options: GoogleButtonOptions): void;
}

declare global {
  interface Window {
    google?: { accounts?: { id?: GoogleId } };
  }
}

let loading: Promise<GoogleId> | null = null;

/** Google's script, loaded once however many buttons ask for it. Rejects if it cannot be reached. */
export function loadGoogleIdentity(): Promise<GoogleId> {
  const ready = window.google?.accounts?.id;
  if (ready) return Promise.resolve(ready);
  loading ??= new Promise<GoogleId>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => {
      const id = window.google?.accounts?.id;
      if (id) resolve(id);
      else reject(new Error('Google sign-in did not start.'));
    };
    script.onerror = () => reject(new Error('Could not reach Google. Check your connection and try again.'));
    document.head.appendChild(script);
  }).catch(error => {
    loading = null; // a failed load can be tried again
    throw error;
  });
  return loading;
}

export interface GoogleProfile {
  email: string;
  name: string;
  picture: string | null;
}

/**
 * The name and email in a Google ID token, for prefilling a form. Null when the token is not a readable JWT.
 * The name is exactly as Google has it (it may carry characters the sign-up form does not accept).
 */
export function readGoogleCredential(credential: string): GoogleProfile | null {
  const part = credential.split('.')[1];
  if (!part) return null;
  try {
    const base64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    const claims = JSON.parse(new TextDecoder().decode(bytes)) as Record<string, unknown>;
    const email = typeof claims.email === 'string' ? claims.email : '';
    if (!email) return null;
    return {
      email,
      name: typeof claims.name === 'string' ? claims.name : '',
      picture: typeof claims.picture === 'string' ? claims.picture : null,
    };
  } catch {
    return null;
  }
}

/**
 * A name the sign-up form accepts — letters and spaces — from whatever Google calls the person
 * ("A. Kumar", "ரீபா S"). The form validates letters and spaces only, and the person can edit what is filled.
 */
export function formNameFrom(name: string): string {
  return name.replace(/[^\p{L}\p{M} ]/gu, ' ').replace(/\s+/g, ' ').trim();
}

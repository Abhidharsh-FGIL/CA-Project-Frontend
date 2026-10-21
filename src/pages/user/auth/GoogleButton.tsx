/**
 * "Sign in with Google", drawn by Google.
 *
 * Google requires its own button (its branding rules do not allow a lookalike), so this only gives it a
 * place to draw and passes on the token it returns. Draws nothing when no client ID is configured, so a
 * deployment without Google set up shows the pages exactly as before.
 */
import { useEffect, useRef, useState } from 'react';
import { GOOGLE_CLIENT_ID, GOOGLE_ENABLED } from '@/config/google';
import { loadGoogleIdentity, type GoogleButtonOptions } from '@/lib/google-identity';

export function GoogleButton({
  text,
  onCredential,
}: {
  text: NonNullable<GoogleButtonOptions['text']>;
  /** Called with the Google ID token when the person picks an account. */
  onCredential: (credential: string) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  // The latest callback, without redrawing Google's button every time the parent renders.
  const latest = useRef(onCredential);
  latest.current = onCredential;

  useEffect(() => {
    const el = host.current;
    if (!GOOGLE_ENABLED || !el) return;
    let cancelled = false;
    loadGoogleIdentity()
      .then(id => {
        if (cancelled) return;
        id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          ux_mode: 'popup',
          callback: response => {
            if (response.credential) latest.current(response.credential);
          },
        });
        el.innerHTML = '';
        // Google draws the button at a fixed pixel width, 200 to 400.
        const width = Math.min(400, Math.max(200, Math.round(el.getBoundingClientRect().width)));
        id.renderButton(el, { theme: 'outline', size: 'large', text, shape: 'pill', width, logo_alignment: 'center' });
      })
      .catch(error => {
        if (!cancelled) setProblem(error instanceof Error ? error.message : 'Google sign-in is not available.');
      });
    return () => {
      cancelled = true;
    };
  }, [text]);

  if (!GOOGLE_ENABLED) return null;
  return (
    <div className="mge-google-wrap">
      <div ref={host} className="mge-google" />
      {problem && <p className="mge-field-error" style={{ textAlign: 'center' }}>{problem}</p>}
    </div>
  );
}

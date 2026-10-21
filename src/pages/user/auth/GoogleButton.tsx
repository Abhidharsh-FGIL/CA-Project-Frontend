/**
 * "Continue with Google", on the page's own terms.
 *
 * Google only hands back a sign-in token through its own button, which it draws in an iframe and does not
 * let a page restyle — at 40px high, in its own colours, that never sat well among the form's 54px buttons.
 * So the button you see is ours (`.mge-gbtn-face`: the Google "G" and the words, sized like the buttons
 * around it), and Google's real button is laid over it, invisible and stretched to cover it. A click lands
 * on Google's button, so the sign-in is Google's own, and what the person looks at is the page's.
 *
 * Draws nothing when no client ID is configured, so a deployment without Google set up shows the pages
 * exactly as before.
 */
import { useEffect, useRef, useState } from 'react';
import { GOOGLE_CLIENT_ID, GOOGLE_ENABLED } from '@/config/google';
import { loadGoogleIdentity, type GoogleButtonOptions } from '@/lib/google-identity';

type Text = NonNullable<GoogleButtonOptions['text']>;

const LABEL: Record<Text, string> = {
  signin_with: 'Sign in with Google',
  signup_with: 'Sign up with Google',
  continue_with: 'Continue with Google',
  signin: 'Sign in',
};

/** The height of the button's face — the same as the page's primary buttons. */
const FACE_HEIGHT = 54;
/** What Google draws its large button at. */
const GOOGLE_HEIGHT = 40;

/** Google's own four-colour "G" (their published mark). */
function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" width="22" height="22" aria-hidden="true" focusable="false">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

export function GoogleButton({
  text,
  onCredential,
}: {
  text: Text;
  /** Called with the Google ID token when the person picks an account. */
  onCredential: (credential: string) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const hit = useRef<HTMLDivElement>(null);
  const [problem, setProblem] = useState<string | null>(null);
  // The latest callback, without redrawing Google's button every time the parent renders.
  const latest = useRef(onCredential);
  latest.current = onCredential;

  useEffect(() => {
    const outer = box.current;
    const layer = hit.current;
    if (!GOOGLE_ENABLED || !outer || !layer) return;
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
        layer.innerHTML = '';
        // Google draws at a fixed pixel width, 200 to 400. Stretch it over the face if the face is wider
        // or taller, so the whole face is a click target.
        const faceWidth = Math.round(outer.getBoundingClientRect().width);
        const width = Math.min(400, Math.max(200, faceWidth));
        layer.style.width = `${width}px`;
        layer.style.transform = `scale(${faceWidth / width}, ${FACE_HEIGHT / GOOGLE_HEIGHT})`;
        id.renderButton(layer, { theme: 'outline', size: 'large', text, shape: 'rectangular', width, logo_alignment: 'center' });
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
      <div ref={box} className="mge-gbtn" style={{ height: FACE_HEIGHT }}>
        <div className="mge-gbtn-face" aria-hidden="true">
          <GoogleG />
          <span>{LABEL[text]}</span>
        </div>
        {/* Google's real button: invisible, on top, and the thing that actually gets clicked. */}
        <div ref={hit} className="mge-gbtn-hit" />
      </div>
      {problem && <p className="mge-field-error" style={{ textAlign: 'center' }}>{problem}</p>}
    </div>
  );
}

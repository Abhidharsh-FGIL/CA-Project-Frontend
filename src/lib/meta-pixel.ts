/**
 * Meta (Facebook / Instagram) Pixel.
 *
 * The pixel tells Meta which ad clicks turned into real sign-ups, so the ads can be aimed at the people who
 * are likely to register. It is loaded only when `VITE_META_PIXEL_ID` is set - leave it empty and nothing is
 * loaded and every call here does nothing.
 *
 * Two things are reported:
 *   - `PageView`, on every page and every move between pages (the app routes in the URL's # part, which the
 *     pixel does not notice on its own).
 *   - `CompleteRegistration`, only when a student has actually finished signing up - not when they merely open
 *     the sign-up page.
 *
 * Verify with Meta Events Manager -> Test Events, and the Meta Pixel Helper browser extension.
 */

type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown };

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

const PIXEL_ID = (import.meta.env.VITE_META_PIXEL_ID as string | undefined)?.trim() ?? '';

let started = false;

/** Loads Meta's script and starts the pixel. Safe to call more than once; does nothing without an ID. */
export function initMetaPixel(): void {
  if (started || !PIXEL_ID || typeof window === 'undefined') return;
  started = true;

  // Meta's standard loader: a queue that collects calls until the real script arrives.
  const fbq: Fbq = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args);
    else (fbq.queue as unknown[]).push(args);
  } as Fbq;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = '2.0';
  fbq.queue = [];
  window.fbq = fbq;
  window._fbq = fbq;

  const script = document.createElement('script');
  script.async = true;
  script.src = 'https://connect.facebook.net/en_US/fbevents.js';
  document.head.appendChild(script);

  fbq('init', PIXEL_ID);
}

/** A page was shown. Called on the first load and on every route change. */
export function trackPageView(): void {
  if (!PIXEL_ID) return;
  initMetaPixel();
  window.fbq?.('track', 'PageView');
}

/**
 * A student finished signing up. Fires once per registration: the same registration reported twice (a refresh, a
 * re-render, a double press) is ignored, but a different one in the same browser session - say a Google sign-up
 * after an email one while testing - is counted. `key` says which registration this is; the email is the natural
 * choice.
 */
export function trackCompleteRegistration(key = 'registration'): void {
  if (!PIXEL_ID) return;
  const id = key.trim().toLowerCase() || 'registration';
  try {
    const done: string[] = JSON.parse(sessionStorage.getItem('mge:meta-registered') ?? '[]');
    if (done.includes(id)) return;
    sessionStorage.setItem('mge:meta-registered', JSON.stringify([...done, id]));
  } catch {
    /* storage blocked: fire anyway - a duplicate is better than a missed registration */
  }
  initMetaPixel();
  window.fbq?.('track', 'CompleteRegistration');
}

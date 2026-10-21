/**
 * A phone or tablet: a touch-first device, or one that says so in its user agent.
 *
 * On these, switching apps, pulling down a notification or locking the screen all hide the page, so tab-switch
 * proctoring would penalise ordinary use. Desktop browsers are unaffected.
 */
export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  if (/Android|iPhone|iPad|iPod|Mobile|Opera Mini|IEMobile/i.test(navigator.userAgent)) return true;
  // iPadOS reports itself as a Mac, but has touch points.
  if (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1) return true;
  try {
    return typeof window !== 'undefined' && window.matchMedia('(pointer: coarse) and (hover: none)').matches;
  } catch {
    return false;
  }
}

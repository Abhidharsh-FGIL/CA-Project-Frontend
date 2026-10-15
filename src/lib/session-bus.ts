/**
 * A way for the API layer to say "this person's session is over" without owning the popup.
 *
 * When a token is refused and its refresh token is refused too, the API client is the first to know
 * — but it knows nothing of screens. It announces here; the popup (`SessionExpiredHost`) and the
 * user portal's state (which forgets the signed-in person) listen. When none is listening — a page
 * outside the portals, a test — `announceSessionExpired` says so and the client falls back to
 * sending the person to the login page, as it always did.
 */

export type Portal = 'user' | 'admin';

type Listener = (portal: Portal) => void;

const listeners = new Set<Listener>();
/** Portals whose expiry has been told already, until someone signs in again. */
const told = new Set<Portal>();

/** Subscribe. Returns the unsubscribe. */
export function onSessionExpired(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Tell the listeners a session has lapsed. True when someone is listening and has it — the caller
 * then needs no redirect of its own.
 *
 * A page makes several calls at once, so a lapse arrives as a burst of refusals, and a slow one can
 * land after the person has already dismissed the popup. Only the first is announced; the rest are
 * taken as part of the same event (and still return true) until `rearmSessionExpired`.
 */
export function announceSessionExpired(portal: Portal): boolean {
  if (listeners.size === 0) return false;
  if (told.has(portal)) return true;
  told.add(portal);
  listeners.forEach(listener => listener(portal));
  return true;
}

/** A session has begun (a sign-in, a refreshed token): the next lapse is a new event. */
export function rearmSessionExpired(portal: Portal): void {
  told.delete(portal);
}

/**
 * Knowing when the page the user has open is an old build.
 *
 * Every build gets a key (the git commit and the time, made by `vite.config.ts`), baked into the bundle as
 * `__APP_BUILD__` and written to `version.json` beside `index.html`, which is served with no caching. A page
 * that sees a different key out there knows a newer build has been deployed. The server may also say so in an
 * `X-App-Build` response header on any API call.
 *
 * What is done about it is not decided here: `AppUpdateHost` shows a banner and reloads at a safe moment. A
 * reload is never safe in the middle of a test, so a page that must not be reloaded asks for a *hold*.
 */
import { useEffect, useSyncExternalStore } from 'react';

declare const __APP_BUILD__: string | undefined;

/** The build this page is running. `dev` under `npm run dev` and in tests, where updates are never offered. */
export const APP_BUILD: string = typeof __APP_BUILD__ === 'string' && __APP_BUILD__ ? __APP_BUILD__ : 'dev';

export function createUpdateStore(current: string) {
  const enabled = current !== 'dev';
  let newer: string | null = null;
  let holds = 0;
  const listeners = new Set<() => void>();
  const emit = () => listeners.forEach(l => l());

  return {
    current,
    enabled,

    /** A build key seen out there (version.json, or the API's header). Anything but a different key is ignored. */
    note(served: string | null | undefined) {
      if (!enabled || !served || served === current || served === newer) return;
      newer = served;
      emit();
    },

    /** The newer build, or null while this page is current. */
    newer: () => newer,

    /** Ask that nothing reload the page until the returned function is called. Counts, so holds can overlap. */
    hold(): () => void {
      holds += 1;
      emit();
      let released = false;
      return () => {
        if (released) return;
        released = true;
        holds -= 1;
        emit();
      };
    },
    held: () => holds > 0,

    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

export const updates = createUpdateStore(APP_BUILD);

/** Tell the store about a build key seen in a response header. */
export const noteServerBuild = (build: string | null | undefined) => updates.note(build);

/** The build deployed right now, read from `version.json`; null when it cannot be read (offline, dev server). */
export async function fetchServedBuild(): Promise<string | null> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const body = (await res.json()) as { build?: unknown };
    return typeof body?.build === 'string' && body.build ? body.build : null;
  } catch {
    return null;
  }
}

const RELOADED_KEY = 'mge:reloaded-for-build';

/**
 * Reload to pick up `target`. Once per target: if the page comes back still on the old build (a CDN or proxy
 * serving stale files), reloading again would loop forever, so the second attempt is refused.
 */
export function reloadForUpdate(target: string | null, reload: () => void = () => window.location.reload()): boolean {
  try {
    if (target && sessionStorage.getItem(RELOADED_KEY) === target) return false;
    if (target) sessionStorage.setItem(RELOADED_KEY, target);
  } catch {
    /* storage blocked: reload anyway — one reload at a time is all a click can cause */
  }
  reload();
  return true;
}

/** The newer build's key, or null while this page is current. */
export function useNewerBuild(): string | null {
  return useSyncExternalStore(updates.subscribe, updates.newer);
}

/** Whether something has asked that the page not be reloaded. */
export function useUpdatesHeld(): boolean {
  return useSyncExternalStore(updates.subscribe, updates.held);
}

/** While `active`, the page will not be reloaded for an update. Use it for a test in progress, or a form being filled. */
export function useHoldUpdates(active: boolean) {
  useEffect(() => {
    if (!active) return;
    return updates.hold();
  }, [active]);
}

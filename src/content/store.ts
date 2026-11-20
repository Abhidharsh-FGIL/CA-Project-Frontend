import { useEffect, useSyncExternalStore } from 'react';
import { publicApi } from '@/lib/api';

/**
 * The admin's text overrides — `{ "<key>": "<text>" }`, only the fields the admin changed. See BACKEND_SITE_CONTENT.md.
 *
 * Kept outside React Query on purpose: public pages and small components read it without a provider, and the last answer
 * is remembered in the browser so a returning visitor sees the admin's wording on first paint, not after a flash of the
 * built-in text. Anything that goes wrong leaves the built-in text in force.
 */
const CACHE_KEY = 'mge.site-content.v1';
const FRESH_MS = 5 * 60 * 1000;

export type ContentOverrides = Record<string, string>;

/** `{ content: {...} }`, or the bare map — only non-empty strings count. */
export function parseOverrides(raw: unknown): ContentOverrides {
  const body = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const map = body.content && typeof body.content === 'object' ? (body.content as Record<string, unknown>) : body;
  const out: ContentOverrides = {};
  for (const [k, v] of Object.entries(map)) if (typeof v === 'string' && v.trim() !== '') out[k] = v;
  return out;
}

function readCache(): ContentOverrides {
  try {
    return parseOverrides(JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null'));
  } catch {
    return {};
  }
}

let overrides: ContentOverrides = readCache();
let loadedAt = 0;
let inflight: Promise<void> | null = null;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach(l => l());

/** Replace what is in force (and remember it). Used by the loader and by the admin screen after a save. */
export function setOverrides(next: ContentOverrides): void {
  overrides = next;
  loadedAt = Date.now();
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(next));
  } catch {
    /* private window or blocked storage — the text still applies for this visit */
  }
  emit();
}

/** Fetch the overrides, unless they are fresh. `force` skips that check (after the admin saves). */
export function loadSiteContent(force = false): Promise<void> {
  if (inflight) return inflight;
  if (!force && Date.now() - loadedAt < FRESH_MS) return Promise.resolve();
  inflight = publicApi
    .get<unknown>('/api/v1/public/site-content')
    .then(res => setOverrides(parseOverrides(res)))
    .catch(() => {
      // No endpoint, or offline: keep whatever is in force (the cache, else the built-in text), and try again later.
      loadedAt = Date.now() - FRESH_MS + 30_000;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export const currentOverrides = (): ContentOverrides => overrides;

/** Test hook. */
export function resetSiteContent(next: ContentOverrides = {}): void {
  overrides = next;
  loadedAt = Date.now();
  inflight = null;
  emit();
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};

/** The overrides in force; draws again when they arrive. Starts the (shared, cached) fetch. */
export function useSiteContent(): ContentOverrides {
  const value = useSyncExternalStore(subscribe, currentOverrides, currentOverrides);
  useEffect(() => {
    void loadSiteContent();
  }, []);
  return value;
}

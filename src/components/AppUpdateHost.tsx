/**
 * Keeps the open page from going stale. Mounted once, inside the router. Shows nothing.
 *
 * It looks for a newer build (`version.json`) when the tab comes back into view, every few minutes, and on each
 * page change. When the user moves to another page and a newer build is known, it reloads quietly to the new
 * build. A test in progress holds the page (`useHoldUpdates`): nothing reloads it, however the update was noticed.
 */
import { useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { fetchServedBuild, reloadForUpdate, updates } from '@/lib/app-version';

const CHECK_EVERY_MS = 5 * 60 * 1000;
const FIRST_CHECK_MS = 10 * 1000;

export default function AppUpdateHost() {
  const { pathname } = useLocation();

  const check = useCallback(async () => {
    if (!updates.enabled) return;
    updates.note(await fetchServedBuild());
  }, []);

  useEffect(() => {
    if (!updates.enabled) return;
    const first = setTimeout(check, FIRST_CHECK_MS);
    const every = setInterval(check, CHECK_EVERY_MS);
    const onVisible = () => document.visibilityState === 'visible' && void check();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', check);
    return () => {
      clearTimeout(first);
      clearInterval(every);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', check);
    };
  }, [check]);

  // A page change is the moment a reload costs nothing: take it if a newer build is known, else look for one.
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (!updates.enabled) return;
    void check().then(() => {
      const target = updates.newer();
      if (target && !updates.held()) reloadForUpdate(target);
    });
  }, [pathname, check]);

  return null;
}

/**
 * Keeps the open page from going stale. Mounted once, inside the router.
 *
 * It looks for a newer build (`version.json`) when the tab comes back into view, every few minutes, and on each
 * page change. If there is one:
 *   - on a page change, with nothing holding the page, it reloads quietly to the new build;
 *   - otherwise a small banner says an update is ready, with a Refresh button once it is safe.
 * A test in progress holds the page (`useHoldUpdates`): nothing reloads it, however the update was noticed.
 */
import { useCallback, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { RefreshCw } from 'lucide-react';
import { fetchServedBuild, reloadForUpdate, updates, useNewerBuild, useUpdatesHeld } from '@/lib/app-version';

const CHECK_EVERY_MS = 5 * 60 * 1000;
const FIRST_CHECK_MS = 10 * 1000;

export default function AppUpdateHost() {
  const newer = useNewerBuild();
  const held = useUpdatesHeld();
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

  if (!newer) return null;

  return (
    <div
      role="status"
      data-no-print
      className="fixed bottom-20 left-1/2 z-[60] flex w-[calc(100%-1.5rem)] max-w-md -translate-x-1/2 items-center gap-3 rounded-2xl bg-gray-900 px-4 py-3 text-white shadow-2xl ring-1 ring-white/10 lg:bottom-6"
    >
      <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-xl bg-orange-500">
        <RefreshCw className="h-4 w-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold">A new version is available</p>
        <p className="text-xs text-gray-300">{held ? 'Finish what you are doing, then refresh.' : 'Refresh to get the latest update.'}</p>
      </div>
      <button
        type="button"
        onClick={() => reloadForUpdate(newer, () => window.location.reload())}
        disabled={held}
        className="flex-shrink-0 rounded-xl bg-orange-500 px-3.5 py-2 text-xs font-bold text-white hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-40"
      >
        Refresh
      </button>
    </div>
  );
}

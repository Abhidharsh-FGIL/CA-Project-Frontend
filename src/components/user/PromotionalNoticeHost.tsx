/**
 * The daily "free test coming up" popup.
 *
 * Shown once a day (India time) to a signed-in student while a promotional test is upcoming or live and they have not
 * taken it — on whichever page they land on, except in the middle of a test. Mounted once inside the portal.
 */
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CalendarClock, Gift } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useUserPortal } from '@/contexts/UserPortalContext';
import { useMyPromotional } from '@/hooks/use-my-promotional';
import { announceable, markNoticeShown, noticeShownToday, promotionalPhase, whenLabel } from '@/lib/promotionalApi';
import { promotionalTestPath } from '@/pages/user/PromotionalTestPage';
import { shortCountdown, useNow } from '@/components/promotional/Countdown';

/** Pages the popup never covers: a test being taken, and the promotional pages themselves. */
const QUIET = ['/user/assessment/', '/user/promotional/', '/user/test/'];

export default function PromotionalNoticeHost() {
  const { isAuthenticated, user } = useUserPortal();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { data } = useMyPromotional(isAuthenticated);
  const now = useNow(0, 1000);
  const [open, setOpen] = useState(false);

  const list = useMemo(() => announceable(data ?? [], Date.now()), [data]);
  const first = list[0];
  const quiet = QUIET.some(p => pathname.startsWith(p));

  useEffect(() => {
    if (!user?.user_id || !first || quiet || open) return;
    if (noticeShownToday(user.user_id)) return;
    markNoticeShown(user.user_id);
    setOpen(true);
  }, [user?.user_id, first, quiet, open]);

  if (!isAuthenticated || !first) return null;
  const live = promotionalPhase(first, now) === 'live';

  const go = () => {
    setOpen(false);
    navigate(promotionalTestPath(first.id));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-sm gap-0 overflow-hidden rounded-3xl border-0 bg-white p-0 shadow-2xl dark:bg-gray-900 [&>button]:right-3 [&>button]:top-3 [&>button]:z-10 [&>button]:rounded-full [&>button]:bg-white/20 [&>button]:p-1.5 [&>button]:text-white [&>button]:opacity-100">
        <div className="bg-gradient-to-br from-orange-500 via-rose-500 to-fuchsia-600 px-6 pb-6 pt-7 text-center text-white">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white/20 ring-1 ring-white/40">
            <Gift className="h-7 w-7" aria-hidden />
          </span>
          <p className="mt-3 text-[11px] font-bold uppercase tracking-widest opacity-90">{live ? 'Live now · free test' : 'Get ready · free test'}</p>
          <DialogTitle className="mt-1 text-xl font-extrabold text-white">{first.title}</DialogTitle>
          <DialogDescription className="mt-1 text-sm text-white/90">
            {live
              ? `Open now — closes in ${shortCountdown(Date.parse(first.ends_at) - now)}.`
              : `Starts in ${shortCountdown(Date.parse(first.starts_at) - now)}. It's free and does not use your plan's tests.`}
          </DialogDescription>
        </div>
        <div className="space-y-3 px-6 py-5">
          <p className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
            <CalendarClock className="h-4 w-4 text-orange-500" /> {whenLabel(first.starts_at)} – {whenLabel(first.ends_at)}
          </p>
          {list.length > 1 && (
            <p className="text-xs text-gray-500">+ {list.length - 1} more free test{list.length > 2 ? 's' : ''} on your dashboard.</p>
          )}
          <button
            type="button"
            onClick={go}
            className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-rose-500 py-2.5 text-sm font-bold text-white shadow-lg transition hover:from-orange-600 hover:to-rose-600"
          >
            {live ? 'Start the test' : 'View & get ready'}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="w-full rounded-xl py-2 text-sm font-semibold text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            Later
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

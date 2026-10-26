/**
 * "Were you referred by someone?" — asked once, right after a new account is made with Google, when no
 * referral code came with it. Google can create the account in one step, so there is no form to ask on;
 * the code is linked afterwards with `/referral/apply` (allowed for a few days, before the first purchase).
 *
 * The page that makes the account calls `askAboutReferral()`; this host, mounted once inside the portal, shows
 * the popup on whatever page the person lands on. The flag survives the redirect to the dashboard.
 */
import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Gift } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useUserPortal } from '@/contexts/UserPortalContext';
import { applyReferralCode, cleanReferralInput } from '@/lib/referralApi';

const FLAG = 'mge:ask-referral';
const EVENT = 'mge:ask-referral';

/** Ask on the next screen. Storage can be blocked; then the event alone still opens it on this page. */
export function askAboutReferral() {
  try {
    sessionStorage.setItem(FLAG, '1');
  } catch {
    /* the event below still works */
  }
  window.dispatchEvent(new Event(EVENT));
}

function pending(): boolean {
  try {
    return sessionStorage.getItem(FLAG) === '1';
  } catch {
    return false;
  }
}

function clearFlag() {
  try {
    sessionStorage.removeItem(FLAG);
  } catch {
    /* nothing to clear */
  }
}

export default function ReferralAskHost() {
  const { isAuthenticated } = useUserPortal();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) return;
    if (pending()) setOpen(true);
    const onAsk = () => setOpen(true);
    window.addEventListener(EVENT, onAsk);
    return () => window.removeEventListener(EVENT, onAsk);
  }, [isAuthenticated]);

  const close = () => {
    clearFlag();
    setOpen(false);
    setCode('');
    setError(null);
  };

  const apply = async () => {
    const value = cleanReferralInput(code);
    if (!value) {
      setError('Enter a referral code, or skip.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await applyReferralCode(value);
      toast.success(`✓ ${r.message || 'Referral applied'}${r.referrer_name ? ` (${r.referrer_name})` : ''}`);
      void queryClient.invalidateQueries({ queryKey: ['referral'] });
      close();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Could not apply that code.');
    } finally {
      setBusy(false);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <Dialog open={open} onOpenChange={o => !o && close()}>
      <DialogContent
        // Only the X, "No, skip" or Esc closes it — a stray click outside the box must not dismiss it.
        onInteractOutside={e => e.preventDefault()}
        className="max-w-sm gap-0 overflow-hidden rounded-3xl border-0 bg-white p-0 shadow-2xl dark:bg-gray-900 [&>button]:right-3 [&>button]:top-3 [&>button]:z-10 [&>button]:rounded-full [&>button]:bg-white/20 [&>button]:p-1.5 [&>button]:text-white [&>button]:opacity-100 hover:[&>button]:bg-white/30"
      >
        <div className="bg-gradient-to-br from-orange-500 via-orange-400 to-pink-500 px-6 pb-6 pt-7 text-center text-white">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-white/20 ring-1 ring-white/40">
            <Gift className="h-7 w-7" aria-hidden />
          </span>
          <DialogTitle className="mt-3 text-xl font-extrabold text-white">Were you referred by someone?</DialogTitle>
          <DialogDescription className="mt-1 text-sm text-white/90">
            Link your account to the friend who told you about MyGovExams.
          </DialogDescription>
        </div>
        <div className="space-y-3 px-6 py-5">
          <input
            value={code}
            onChange={e => {
              setCode(e.target.value);
              setError(null);
            }}
            onKeyDown={e => e.key === 'Enter' && !busy && apply()}
            placeholder="Referral code"
            aria-label="Referral code"
            autoComplete="off"
            className="w-full rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-sm uppercase tracking-wide text-gray-900 focus:outline-none focus:ring-2 focus:ring-orange-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
          />
          {error ? (
            <p className="text-xs font-medium text-rose-600 dark:text-rose-400">{error}</p>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400">Code, or your friend’s mobile number or email</p>
          )}
          <button
            type="button"
            onClick={apply}
            disabled={busy}
            className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 py-2.5 text-sm font-bold text-white shadow-lg shadow-orange-200 transition hover:from-orange-600 hover:to-orange-700 disabled:opacity-60 dark:shadow-orange-950/40"
          >
            {busy ? 'Checking…' : 'Continue'}
          </button>
          <button
            type="button"
            onClick={close}
            disabled={busy}
            className="w-full rounded-xl py-2 text-sm font-semibold text-gray-500 hover:bg-gray-50 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            No, skip
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { BadgeCheck, Banknote, Clock, Copy, Gift, Link2, Loader2, MessageCircle, Users } from 'lucide-react';
import { UserShell } from '@/components/user/UserShell';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { SUPPORT_EMAIL } from '@/config/support';
import { useUserPortal } from '@/contexts/UserPortalContext';
import {
  WITHDRAWAL_STATUS_LABEL,
  applyReferralCode,
  getReferralFriends,
  getReferralMe,
  getWithdrawals,
  nextWithdrawalWindow,
  withdrawalMail,
  withdrawalWindowOpen,
  rupees,
  shortDate,
  whatsappShareUrl,
  withdrawalProblem,
  type ReferralFriend,
  type ReferralMe,
  type Withdrawal,
} from '@/lib/referralApi';

const CARD = 'rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900';

async function copyText(text: string, done: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(done);
  } catch {
    toast.error('Could not copy. Please copy it by hand.');
  }
}

/** Refer & Earn: the user's code and link, what friends have earned them, and the wallet it feeds. */
export default function ReferralPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ['referral', 'me'], queryFn: getReferralMe, staleTime: 30_000 });
  const friends = useQuery({ queryKey: ['referral', 'friends'], queryFn: getReferralFriends, staleTime: 30_000 });

  return (
    <UserShell>
      <div className="space-y-4 sm:space-y-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 sm:text-2xl">Refer &amp; Earn</h1>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400 sm:text-sm">
            Invite your friends and earn cashback when they make their first purchase.
          </p>
        </div>

        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-7 w-7 animate-spin text-orange-500" />
          </div>
        ) : error || !data ? (
          <div className={cn(CARD, 'p-6 text-center text-sm text-gray-600 dark:text-gray-400')}>
            Could not load your referral details. Please try again in a moment.
          </div>
        ) : (
          <>
            <ShareCard me={data} />
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label="Friends referred" value={String(data.stats.friends_referred)} icon={Users} tone="blue" />
              <Stat label="Friends who made an eligible purchase" value={String(data.stats.paying_friends)} icon={BadgeCheck} tone="emerald" />
              <Stat label="Cashback pending" value={rupees(data.wallet.pending)} icon={Clock} tone="amber" />
              <Stat label="Total cashback earned" value={rupees(data.stats.total_earned)} icon={Gift} tone="orange" />
            </div>
            <WithdrawCard me={data} />
            {data.can_apply_code && <ApplyCode />}
            {data.my_referrer && (
              <p className="text-xs text-gray-500 dark:text-gray-400">
                You joined through <span className="font-semibold text-gray-700 dark:text-gray-300">{data.my_referrer.name}</span>
                {data.my_referrer.linked_at ? ` on ${shortDate(data.my_referrer.linked_at)}` : ''}.
              </p>
            )}
            <HowItWorks me={data} />
            <Friends items={friends.data?.items ?? []} total={friends.data?.total ?? 0} loading={friends.isLoading} me={data} />
          </>
        )}
      </div>
    </UserShell>
  );
}

function ShareCard({ me }: { me: ReferralMe }) {
  const message = `Join me on MyGovExams for TNPSC mock tests and practice. Sign up with my referral code ${me.referral_code}: ${me.share_link}`;
  return (
    <section className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 via-orange-400 to-pink-500 p-5 text-white shadow-lg shadow-orange-200/60 dark:shadow-none sm:p-6">
      <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/20 blur-2xl" />
      <div className="relative">
        <h2 className="text-2xl font-extrabold leading-tight sm:text-3xl">Earn {me.reward_percent}% Cashback!</h2>
        <p className="mt-1 max-w-xl text-sm text-white/90">
          Invite your friends and earn {me.reward_percent}% cashback on their first eligible purchase.
        </p>
        <p className="mt-4 text-[10px] font-bold uppercase tracking-[0.25em] text-white/80">Your referral code</p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <p className="rounded-xl bg-white/20 px-4 py-2 font-mono text-2xl font-extrabold tracking-wider ring-1 ring-white/40 backdrop-blur sm:text-3xl">
            {me.referral_code || '—'}
          </p>
          <button
            type="button"
            onClick={() => copyText(me.referral_code, 'Code copied')}
            disabled={!me.referral_code}
            className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-sm font-bold text-orange-600 shadow-sm transition hover:bg-orange-50 disabled:opacity-60"
          >
            <Copy className="h-4 w-4" /> Copy
          </button>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => copyText(me.share_link, 'Link copied')}
            disabled={!me.share_link}
            className="inline-flex items-center gap-1.5 rounded-xl bg-white/20 px-3.5 py-2 text-sm font-semibold ring-1 ring-white/40 backdrop-blur transition hover:bg-white/30 disabled:opacity-60"
          >
            <Link2 className="h-4 w-4" /> Copy Link
          </button>
          <a
            href={whatsappShareUrl(message)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-500 px-3.5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-600"
          >
            <MessageCircle className="h-4 w-4" /> Share on WhatsApp
          </a>
        </div>
      </div>
    </section>
  );
}

const TONES = {
  blue: 'bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400',
  orange: 'bg-orange-50 text-orange-600 dark:bg-orange-950/50 dark:text-orange-400',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400',
};

function Stat({ label, value, icon: Icon, tone }: { label: string; value: string; icon: typeof Users; tone: keyof typeof TONES }) {
  return (
    <div className={cn(CARD, 'flex items-center gap-3 p-4')}>
      <span className={cn('grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl', TONES[tone])}>
        <Icon className="h-5 w-5" aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-xl font-bold leading-none text-gray-900 dark:text-gray-100">{value}</p>
        <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">{label}</p>
      </div>
    </div>
  );
}

/** For someone who signed up without a code: allowed for a short while, and only before the first purchase. */
function ApplyCode() {
  const queryClient = useQueryClient();
  const [code, setCode] = useState('');
  const apply = useMutation({
    mutationFn: () => applyReferralCode(code),
    onSuccess: r => {
      toast.success(`${r.message}${r.referrer_name ? ` (${r.referrer_name})` : ''}`);
      setCode('');
      queryClient.invalidateQueries({ queryKey: ['referral'] });
    },
    onError: (e: Error) => toast.error(e.message || 'Could not apply that code.'),
  });
  return (
    <section className={cn(CARD, 'border-amber-200 bg-amber-50/60 p-4 dark:border-amber-900/60 dark:bg-amber-950/20')}>
      <p className="text-sm font-bold text-gray-900 dark:text-gray-100">Add a referral code</p>
      <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400">
        Did a friend tell you about MyGovExams? Enter their code, mobile number or email — before your first purchase.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <input
          value={code}
          onChange={e => setCode(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && code.trim() && apply.mutate()}
          placeholder="Referral code"
          aria-label="Referral code"
          className="min-w-0 flex-1 basis-48 rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm uppercase tracking-wide focus:outline-none focus:ring-2 focus:ring-amber-300 dark:border-amber-900 dark:bg-gray-800 dark:text-gray-100"
        />
        <button
          type="button"
          onClick={() => apply.mutate()}
          disabled={!code.trim() || apply.isPending}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
        >
          {apply.isPending ? 'Applying…' : 'Apply'}
        </button>
      </div>
    </section>
  );
}

function HowItWorks({ me }: { me: ReferralMe }) {
  const steps = [
    {
      title: 'Refer a Friend',
      text: "Share your referral code or link. When your friend signs up using your referral code, they'll be linked to your account.",
    },
    {
      title: 'Friend Makes Their First Eligible Purchase',
      text: `Earn ${me.reward_percent}% cashback on your friend's first eligible purchase, excluding GST.`,
    },
    {
      title: 'Earn Cashback',
      text: `Your reward will remain pending for ${me.hold_days} days before becoming available for withdrawal. Once available, you can withdraw from ${rupees(me.min_withdrawal)}, subject to the applicable withdrawal terms.`,
    },
  ];
  return (
    <>
      <section className={cn(CARD, 'p-5')}>
        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">How It Works</h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} className="flex items-start gap-3">
              <span className="grid h-7 w-7 flex-shrink-0 place-items-center rounded-full bg-orange-100 text-xs font-bold text-orange-600 dark:bg-orange-950/50 dark:text-orange-400">
                {i + 1}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{s.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-gray-600 dark:text-gray-400">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-4 text-[11px] text-gray-500 dark:text-gray-400">
          Terms apply.{' '}
          <Link to="/terms" target="_blank" rel="noopener noreferrer" className="font-semibold text-orange-600 hover:underline dark:text-orange-400">
            Read the Refer &amp; Earn terms
          </Link>
        </p>
      </section>
    </>
  );
}

function Friends({ items, total, loading, me }: { items: ReferralFriend[]; total: number; loading: boolean; me: ReferralMe }) {
  return (
    <section className={cn(CARD, 'p-5')}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">Recent referral activity</h2>
        {total > 0 && <span className="text-xs text-gray-400">{total} in all</span>}
      </div>
      {loading ? (
        <div className="flex h-24 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
        </div>
      ) : items.length === 0 ? (
        <p className="py-8 text-center text-sm text-gray-500 dark:text-gray-400">
          No friends yet. Share your code{me.referral_code ? ` ${me.referral_code}` : ''} to get started.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {items.map((f, i) => (
            <li
              key={`${f.name}-${i}`}
              className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/70 px-3 py-2.5 dark:border-gray-800 dark:bg-gray-800/40"
            >
              <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full bg-orange-100 text-sm font-bold text-orange-600 dark:bg-orange-950/50 dark:text-orange-400">
                {(f.name || '?')[0].toUpperCase()}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{f.name}</p>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  {f.joined_at ? `Joined ${shortDate(f.joined_at)}` : 'Joined'}
                  {f.purchases === 0 &&
                    (f.earning_active && f.earning_until
                      ? ` · first purchase by ${shortDate(f.earning_until)}`
                      : ' · reward window ended')}
                </p>
              </div>
              {f.purchases > 0 || f.earned > 0 ? (
                <span className="text-right">
                  <span className="block text-sm font-bold text-emerald-600 dark:text-emerald-400">+{rupees(f.earned)}</span>
                  <span className="block text-[10px] text-gray-400">First purchase</span>
                </span>
              ) : (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                  {f.earning_active ? 'Waiting for first purchase' : 'No purchase'}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Available cash, the rules for taking it out, and the requests made so far. */
function WithdrawCard({ me }: { me: ReferralMe }) {
  const [open, setOpen] = useState(false);
  const list = useQuery({ queryKey: ['referral', 'withdrawals'], queryFn: getWithdrawals, staleTime: 30_000, enabled: me.withdrawals_enabled });
  // A request is an e-mail to support, so it needs only a balance and the first week of the month.
  const windowOpen = withdrawalWindowOpen();
  const canWithdraw = me.wallet.available > 0 && windowOpen;
  const opensOn = nextWithdrawalWindow().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <section className={cn(CARD, 'overflow-hidden')}>
      <div className="flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-emerald-50 to-white p-5 dark:from-emerald-950/30 dark:to-gray-900">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            <Banknote className="h-3.5 w-3.5" aria-hidden /> Available for withdrawal
          </p>
          <p className="mt-1 text-3xl font-extrabold text-gray-900 dark:text-gray-100">{rupees(me.wallet.available)}</p>
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Withdrawal can be requested from the <span className="font-semibold text-gray-700 dark:text-gray-300">1st to the 7th</span> of every month
            {me.wallet.pending > 0 ? ` · ${rupees(me.wallet.pending)} pending` : ''}
          </p>
        </div>
        <div className="flex flex-col items-start gap-1.5 sm:items-end">
          <button
            type="button"
            onClick={() => setOpen(true)}
            disabled={!canWithdraw}
            className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Withdraw
          </button>
          <p className="max-w-[16rem] text-[11px] text-gray-500 dark:text-gray-400 sm:text-right">
            {!windowOpen
              ? `The window opens on ${opensOn}.`
              : me.wallet.available <= 0
                ? `The window is open, but there is nothing to withdraw yet. Rewards become available after the ${me.hold_days}-day pending period.`
                : 'The window is open — request your withdrawal until the 7th.'}
          </p>
        </div>
      </div>

      {me.withdrawals_enabled && (list.data?.length ?? 0) > 0 && (
        <div className="border-t border-gray-100 p-5 dark:border-gray-800">
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">Your withdrawals</h3>
          <ul className="mt-3 space-y-2">
            {list.data!.map((w, i) => (
              <WithdrawalRow key={w.id || i} w={w} />
            ))}
          </ul>
        </div>
      )}

      <WithdrawDialog me={me} open={open} onClose={() => setOpen(false)} />
    </section>
  );
}

const WITHDRAWAL_TONE: Record<string, string> = {
  requested: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  paid: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  rejected: 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300',
};

function WithdrawalRow({ w }: { w: Withdrawal }) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50/70 px-3 py-2.5 dark:border-gray-800 dark:bg-gray-800/40">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
          {rupees(w.amount)}{' '}
          <span className="font-normal text-gray-500">
            to {w.method === 'bank' ? 'bank' : 'UPI'}
            {w.destination ? ` ${w.destination}` : ''}
          </span>
        </p>
        <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">
          {shortDate(w.created_at)}
          {w.payout_reference ? ` · Ref ${w.payout_reference}` : ''}
          {w.note ? ` · ${w.note}` : ''}
        </p>
      </div>
      <span className={cn('rounded-full px-2 py-0.5 text-[10px] font-bold', WITHDRAWAL_TONE[w.status] ?? WITHDRAWAL_TONE.requested)}>
        {WITHDRAWAL_STATUS_LABEL[w.status] ?? w.status}
      </span>
    </li>
  );
}

function WithdrawDialog({ me, open, onClose }: { me: ReferralMe; open: boolean; onClose: () => void }) {
  const [form, setForm] = useState({
    amount: '',
    method: 'upi' as 'upi' | 'bank',
    upiId: '',
    accountNumber: '',
    ifsc: '',
    accountName: '',
  });
  const set = (patch: Partial<typeof form>) => setForm(f => ({ ...f, ...patch }));
  const { user } = useUserPortal();
  // The balance is the only limit: a request is checked by a person at support, not by a minimum here.
  const problem = !withdrawalWindowOpen() ? 'Withdrawals can be requested from the 1st to the 7th of the month.' : withdrawalProblem(form, me.wallet.available, 0);

  /** Opens the student's mail app with the request written out, addressed to support. */
  const send = () => {
    const { subject, body } = withdrawalMail({
      name: user?.name ?? '',
      email: user?.email ?? '',
      phone: user?.phone || undefined,
      referralCode: me.referral_code,
      amount: Number(form.amount),
      available: me.wallet.available,
      method: form.method,
      upiId: form.upiId.trim(),
      accountName: form.accountName.trim(),
      accountNumber: form.accountNumber.trim(),
      ifsc: form.ifsc.trim().toUpperCase(),
    });
    window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    toast.success('Your email app has opened — press Send to place the withdrawal request.');
    setForm(f => ({ ...f, amount: '', accountNumber: '' }));
    onClose();
  };

  const input =
    'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-400 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100';

  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md gap-0 rounded-2xl bg-white p-0 dark:bg-gray-900">
        <div className="border-b border-gray-100 px-6 py-4 dark:border-gray-800">
          <DialogTitle className="text-lg font-bold text-gray-900 dark:text-gray-100">Withdraw rewards</DialogTitle>
          <DialogDescription className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            Available {rupees(me.wallet.available)} · requests open from the 1st to the 7th of the month
          </DialogDescription>
        </div>
        <div className="space-y-3 px-6 py-4">
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300">
            Amount (₹)
            <input
              className={cn(input, 'mt-1')}
              inputMode="decimal"
              value={form.amount}
              onChange={e => set({ amount: e.target.value.replace(/[^\d.]/g, '') })}
              placeholder={String(me.wallet.available)}
            />
          </label>
          <div role="radiogroup" aria-label="Payout method" className="inline-flex gap-1 rounded-xl border border-gray-100 bg-gray-50 p-1 dark:border-gray-800 dark:bg-gray-800/40">
            {(['upi', 'bank'] as const).map(m => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={form.method === m}
                onClick={() => set({ method: m })}
                className={cn(
                  'rounded-lg px-4 py-1.5 text-xs font-bold transition',
                  form.method === m ? 'bg-emerald-600 text-white shadow-sm' : 'text-gray-600 hover:bg-white dark:text-gray-300 dark:hover:bg-gray-800',
                )}
              >
                {m === 'upi' ? 'UPI' : 'Bank account'}
              </button>
            ))}
          </div>
          {form.method === 'upi' ? (
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300">
              UPI ID
              <input className={cn(input, 'mt-1')} value={form.upiId} onChange={e => set({ upiId: e.target.value })} placeholder="name@okaxis" autoComplete="off" />
            </label>
          ) : (
            <>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300">
                Account holder name
                <input className={cn(input, 'mt-1')} value={form.accountName} onChange={e => set({ accountName: e.target.value })} autoComplete="off" />
              </label>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300">
                Account number
                <input
                  className={cn(input, 'mt-1')}
                  inputMode="numeric"
                  value={form.accountNumber}
                  onChange={e => set({ accountNumber: e.target.value.replace(/\D/g, '').slice(0, 18) })}
                  autoComplete="off"
                />
              </label>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300">
                IFSC
                <input
                  className={cn(input, 'mt-1 uppercase')}
                  value={form.ifsc}
                  onChange={e => set({ ifsc: e.target.value.toUpperCase().slice(0, 11) })}
                  placeholder="SBIN0001234"
                  autoComplete="off"
                />
              </label>
            </>
          )}
          <p className="text-[11px] leading-relaxed text-gray-500 dark:text-gray-400">
            Your request is sent to our support team by email. It is approved by our team and paid within 3–5 working days. Verification (such as PAN) may be needed.
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-4 dark:border-gray-800">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">
            Cancel
          </button>
          <button
            type="button"
            onClick={send}
            disabled={!!problem}
            title={problem ?? undefined}
            className="rounded-lg bg-emerald-600 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Request withdrawal
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

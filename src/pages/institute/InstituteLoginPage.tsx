import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Building2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { instituteSession, loginInstitute } from '@/lib/instituteApi';

/** Turn "sri-ram-academy" into "Sri Ram Academy" until the server tells us the real name. */
const readable = (slug: string) => slug.split('-').filter(Boolean).map(w => w[0].toUpperCase() + w.slice(1)).join(' ');

/**
 * An institute's own sign-in page, at `#/institute/<slug>`. The address names the institute; the email and
 * password must belong to that institute, so one institute's login cannot open another's page.
 */
export default function InstituteLoginPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (instituteSession.signedInTo(slug)) navigate(`/institute/${slug}/students`, { replace: true });
  }, [slug, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await loginInstitute(slug, email.trim(), password);
      navigate(`/institute/${slug}/students`, { replace: true });
    } catch (err) {
      const status = (err as { status?: number }).status;
      const message = (err as Error).message;
      // A wrong email, a wrong password and an unknown address all say the same thing: nothing to guess from.
      setError(status === 401 || status === 404 ? 'These details do not match this institute.' : message || 'Sign-in failed. Please try again.');
      toast.dismiss();
    } finally {
      setSubmitting(false);
    }
  };

  const field =
    'w-full px-4 py-2.5 border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 rounded-xl focus:border-brand-500 outline-none text-sm';

  return (
    <div className="relative flex h-[100dvh] items-center justify-center overflow-y-auto bg-gradient-to-br from-slate-50 via-blue-50 to-purple-100 p-4 py-8 dark:from-slate-950 dark:via-blue-950/60 dark:to-purple-950/60">
      <div className="relative z-10 w-full max-w-md animate-fadeIn">
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-400 shadow-lg">
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <span className="text-lg font-bold gradient-text">Institute Portal</span>
        </div>

        <div className="rounded-2xl border border-white bg-white/95 p-5 shadow-xl dark:border-gray-800 dark:bg-gray-900/95 sm:p-7">
          <h1 className="mb-1 text-2xl font-bold text-gray-900 dark:text-gray-100">{readable(slug) || 'Institute'}</h1>
          <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">Sign in to see your students and their test history.</p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="office@institute.com" required autoComplete="username" className={field} />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
              <div className="relative">
                <input
                  type={show ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className={`${field} pr-11`}
                />
                <button type="button" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-700 dark:bg-red-950/30 dark:text-red-300">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-brand-600 py-3 font-semibold text-white shadow-lg hover:bg-brand-700 disabled:opacity-60"
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

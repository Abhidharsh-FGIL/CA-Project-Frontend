import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GraduationCap, Eye, EyeOff, Mail, CheckCircle2, ArrowLeft } from 'lucide-react';
import { useUserPortal } from '@/contexts/UserPortalContext';
import { toast } from 'sonner';

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, forgotPassword, isAuthenticated } = useUserPortal();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);

  useEffect(() => {
    if (isAuthenticated) navigate('/user/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);

  const locked = failedAttempts >= 5;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (locked) {
      toast.error('Account locked after 5 failed attempts. Check your email for the unlock link.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await login(email, password);
      if (res.ok) {
        toast.success('Welcome back!');
        navigate('/user/dashboard');
      } else {
        setFailedAttempts(n => n + 1);
        toast.error(res.error || 'Login failed');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const submitForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await forgotPassword(forgotEmail);
    if (res.ok) {
      setForgotSent(true);
    } else {
      toast.error(res.error || 'Could not send reset link');
    }
  };

  return (
    <div className="h-[100dvh] overflow-y-auto bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-100 dark:from-slate-950 dark:via-indigo-950/60 dark:to-purple-950/60 flex items-center justify-center p-4 py-8 relative">
      {/* Decorative blobs */}
      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-purple-300/30 dark:bg-purple-700/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-indigo-300/30 dark:bg-indigo-700/20 rounded-full blur-3xl pointer-events-none" />

      {/* Back to Home */}
      <Link
        to="/"
        className="absolute top-4 left-4 z-20 flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform duration-150" />
        <span>Back to Home</span>
      </Link>

      <div className="max-w-md w-full relative z-10 animate-fadeIn">
        <Link to="/" className="flex items-center justify-center gap-2 mb-8 group">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-indigo-900/50 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <span className="text-lg font-bold gradient-text">FGIL CA Academy</span>
        </Link>

        <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur rounded-2xl shadow-xl shadow-indigo-100/50 dark:shadow-black/40 border border-white dark:border-gray-800 p-5 sm:p-7 animate-scaleIn">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">Welcome back</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Log in to continue your CA prep journey.</p>

          {locked && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl p-3 mb-4 text-xs text-red-700 dark:text-red-300">
              <strong>Account locked.</strong> Too many failed attempts. Check your email for the unlock link.
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full px-4 py-2.5 border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-xl focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/40 outline-none transition-all text-sm"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(email);
                    setForgotOpen(true);
                  }}
                  className="text-xs text-indigo-600 font-semibold hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-2.5 pr-11 border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-xl focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/40 outline-none transition-all text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || locked}
              className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-[length:200%_auto] text-white py-3 rounded-xl font-semibold hover:bg-right-bottom transition-all duration-500 shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-300 disabled:opacity-60 active:scale-[0.98] press relative overflow-hidden"
            >
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Logging in...
                </span>
              ) : (
                'Log in'
              )}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
            New here?{' '}
            <Link to="/user/register" className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">
              Create an account
            </Link>
          </p>
        </div>
      </div>

      {forgotOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-sm w-full p-7 animate-scaleIn border border-transparent dark:border-gray-800">
            {forgotSent ? (
              <div className="text-center">
                <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-950/40 rounded-full flex items-center justify-center mx-auto mb-3">
                  <CheckCircle2 className="w-7 h-7 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">Check your email</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
                  We've sent a reset link to <strong>{forgotEmail}</strong>.
                </p>
                <button
                  onClick={() => {
                    setForgotOpen(false);
                    setForgotSent(false);
                  }}
                  className="w-full bg-indigo-600 text-white py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition-all"
                >
                  Close
                </button>
              </div>
            ) : (
              <form onSubmit={submitForgot}>
                <div className="w-14 h-14 bg-indigo-50 dark:bg-indigo-950/40 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Mail className="w-7 h-7 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 text-center mb-1">Reset your password</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-5">
                  Enter your email and we'll send a reset link.
                </p>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={e => setForgotEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  className="w-full px-4 py-2.5 border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-xl focus:border-indigo-500 dark:focus:border-indigo-400 outline-none mb-4"
                />
                <button
                  type="submit"
                  className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-2.5 rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all"
                >
                  Send reset link
                </button>
                <button
                  type="button"
                  onClick={() => setForgotOpen(false)}
                  className="w-full mt-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 py-2"
                >
                  Cancel
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

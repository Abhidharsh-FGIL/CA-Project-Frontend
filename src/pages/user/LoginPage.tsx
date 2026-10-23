import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Eye,
  EyeOff,
  FileText,
  KeyRound,
  Lock,
  Mail,
  Target,
} from 'lucide-react';
import { trackCompleteRegistration } from '@/lib/meta-pixel';
import { useUserPortal } from '@/contexts/UserPortalContext';
import { STUDENT_PASSWORD_LOGIN } from '@/config/features';
import { GOOGLE_ENABLED } from '@/config/google';
import { toast } from 'sonner';
import { ROUTES } from '@/pages/landing/LandingShell';
import { ArtImage, AuthField, AuthLayout, AuthModal } from './auth/AuthShell';
import { LoginOtpForm } from './auth/LoginOtpForm';
import { GoogleButton } from './auth/GoogleButton';

/** What the product offers, as a row under the form. */
const POINTS = [
  { icon: FileText, label: 'Full mock tests', tone: 'blue' },
  { icon: BookOpen, label: 'Unit-wise practice', tone: 'orange' },
  { icon: Target, label: 'Previous year papers', tone: 'purple' },
  { icon: BarChart3, label: 'AI performance reports', tone: 'green' },
];

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, forgotPassword, signInWithGoogle, isAuthenticated } = useUserPortal();
  /**
   * Password is the way in by default, with the OTP form one tap away and back. When password
   * login is switched off (`STUDENT_PASSWORD_LOGIN`) the page opens on the OTP form and stays there.
   */
  const [mode, setMode] = useState<'password' | 'otp'>(STUDENT_PASSWORD_LOGIN ? 'password' : 'otp');
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

  const [googleError, setGoogleError] = useState('');
  /**
   * Google gave a token. A known account is signed in; a new one has no details yet, so it goes to the
   * sign-up form with the Google token and name, to add the rest — not to a dead end.
   */
  const googleLogin = async (credential: string) => {
    setGoogleError('');
    const res = await signInWithGoogle(credential);
    if (res.ok) {
      // A brand-new account the server made on the spot (it says so) is a registration; an existing one is not.
      if (res.created) trackCompleteRegistration(`google:${credential.slice(-24)}`);
      toast.success(res.created ? 'Account created successfully!' : 'Welcome back!');
      navigate('/user/dashboard');
    } else if (res.needsProfile) {
      toast.info('Almost there — add a few details to create your account.');
      navigate(ROUTES.signup, { state: { google: { credential, ...res.needsProfile } } });
    } else {
      setGoogleError(res.error || 'Google sign-in failed. Please try again.');
    }
  };

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
    <AuthLayout
      title="Login | MyGovExams"
      side={<ArtImage name="hero.png" alt="A student preparing for her government exam" />}
      below={
        <div className="mge-auth-points">
          {POINTS.map(p => (
            <div className="mge-auth-point" key={p.label}>
              <span className={`mge-tile mge-tile-${p.tone}`}>
                <p.icon aria-hidden="true" />
              </span>
              {p.label}
            </div>
          ))}
        </div>
      }
    >
      <div className="mge-auth-card">
        <h1>Welcome Back</h1>
        {mode === 'otp' ? (
          <LoginOtpForm
            initialIdentifier={email}
            onUsePassword={STUDENT_PASSWORD_LOGIN ? () => setMode('password') : undefined}
          />
        ) : (
          <>
            <p className="mge-auth-sub">Login to continue your exam preparation</p>

            {locked && (
              <div className="mge-auth-alert">
                <strong>Account locked.</strong> Too many failed attempts. Check your email for the unlock link.
              </div>
            )}

            <form onSubmit={handleSubmit} className="mge-auth-form">
              <AuthField
                icon={Mail}
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="Email"
                required
                autoComplete="email"
              />
              <AuthField
                icon={Lock}
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={setPassword}
                placeholder="Password"
                required
                autoComplete="current-password"
                trailing={
                  <button
                    type="button"
                    className="mge-eye"
                    aria-label={showPwd ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPwd(p => !p)}
                  >
                    {showPwd ? <EyeOff /> : <Eye />}
                  </button>
                }
              />

              <button
                type="button"
                className="mge-link-btn"
                onClick={() => {
                  setForgotEmail(email);
                  setForgotOpen(true);
                }}
              >
                Forgot Password?
              </button>

              <button type="submit" disabled={submitting || locked} className="mge-btn mge-btn-primary mge-auth-submit">
                {submitting ? (
                  <>
                    <span className="mge-spinner" /> Logging in...
                  </>
                ) : (
                  <>
                    Login <ArrowRight size={19} />
                  </>
                )}
              </button>
            </form>

            <div className="mge-auth-or">
              <span>or</span>
            </div>
            <button type="button" className="mge-auth-alt" onClick={() => setMode('otp')}>
              <KeyRound size={18} aria-hidden="true" /> Login with OTP
            </button>
          </>
        )}

        {GOOGLE_ENABLED && (
          <>
            <div className="mge-auth-or">
              <span>or</span>
            </div>
            {googleError && (
              <div className="mge-auth-alert" role="alert" style={{ margin: '0 0 12px' }}>
                {googleError}
              </div>
            )}
            <GoogleButton text="continue_with" onCredential={googleLogin} />
          </>
        )}

        <div className="mge-auth-rule" />
        <p className="mge-auth-switch">
          Don't have an account?
          <Link to={ROUTES.signup}>Sign up</Link>
        </p>
      </div>

      {forgotOpen && (
        <AuthModal>
          {forgotSent ? (
            <>
              <div className="mge-modal-icon mge-tile-green">
                <CheckCircle2 size={30} />
              </div>
              <h2>Check your email</h2>
              <p>
                We've sent a reset link to <strong>{forgotEmail}</strong>.
              </p>
              <button
                type="button"
                className="mge-btn mge-btn-primary mge-auth-submit"
                onClick={() => {
                  setForgotOpen(false);
                  setForgotSent(false);
                }}
              >
                Close
              </button>
            </>
          ) : (
            <form onSubmit={submitForgot}>
              <div className="mge-modal-icon mge-tile-blue">
                <Mail size={28} />
              </div>
              <h2>Reset your password</h2>
              <p>Enter your email and we'll send a reset link.</p>
              <AuthField
                icon={Mail}
                type="email"
                value={forgotEmail}
                onChange={setForgotEmail}
                placeholder="Email"
                required
                autoComplete="email"
              />
              <button type="submit" className="mge-btn mge-btn-primary mge-auth-submit">
                Send reset link
              </button>
              <button type="button" className="mge-modal-text-btn" onClick={() => setForgotOpen(false)}>
                Cancel
              </button>
            </form>
          )}
        </AuthModal>
      )}
    </AuthLayout>
  );
}

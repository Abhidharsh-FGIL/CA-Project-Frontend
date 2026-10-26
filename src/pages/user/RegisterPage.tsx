import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  AlertCircle,
  CheckCircle2,
  FileText,
  Gift,
  Mail,
  Phone,
  Target,
  User,
} from 'lucide-react';
import { useUserPortal } from '@/contexts/UserPortalContext';
import { GOOGLE_ENABLED } from '@/config/google';
import { formNameFrom, readGoogleCredential } from '@/lib/google-identity';
import { toast } from 'sonner';
import { ROUTES } from '@/pages/landing/LandingShell';
import { ArtImage, AuthField, AuthLayout, AuthModal } from './auth/AuthShell';
import { GoogleButton } from './auth/GoogleButton';
import { trackCompleteRegistration } from '@/lib/meta-pixel';
import { askAboutReferral } from '@/components/user/ReferralAskHost';
import { cleanReferralInput, clearSavedReferral, refFromSearch, saveReferral, savedReferral, validateReferralCode } from '@/lib/referralApi';

interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
}

/** Where a newly created account lands: the exam list, not the (still empty) dashboard. */
const FIRST_LANDING = '/user/exams';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register, verifyOtp, resendOtp, signInWithGoogle, isAuthenticated } = useUserPortal();
  const location = useLocation();

  /**
   * A Google account this sign-up is being made from: its ID token (which the server checks), and the name
   * and email Google gave. Arrives from the login page when Google was fine but there was no account yet.
   * While set, the email is locked to the Google one and no OTP is needed — Google has verified it.
   */
  const [google, setGoogle] = useState<{ credential: string; email: string; name: string } | null>(
    () => (location.state as { google?: { credential: string; email: string; name: string } } | null)?.google ?? null,
  );

  // A brand-new account lands on the exam list — the first thing an aspirant needs is to pick
  // what to prepare for. Someone who is already signed in and merely opens /register goes to the
  // dashboard as before. `verifyOtp` signs the user in before it returns, so this effect fires
  // mid-verification: the ref tells it which of the two it is looking at.
  const justSignedUp = useRef(false);
  useEffect(() => {
    if (isAuthenticated) navigate(justSignedUp.current ? FIRST_LANDING : '/user/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);

  const [form, setForm] = useState({
    name: google ? formNameFrom(google.name) : '',
    email: google?.email ?? '',
    phone: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  // The optional referral field. A share link (`?ref=CODE`) fills it in, and the code is checked as it is typed.
  // A link's code is kept as well: a Google sign-in can reload the page and lose the `?ref=` from the address.
  const linkRef = useRef(refFromSearch(location.search) ?? savedReferral());
  useEffect(() => {
    const fromAddress = refFromSearch(location.search);
    if (fromAddress) saveReferral(fromAddress);
  }, [location.search]);
  const [referral, setReferral] = useState(linkRef.current ?? '');
  const [referralCheck, setReferralCheck] = useState<
    { state: 'idle' } | { state: 'checking' } | { state: 'ok'; text: string } | { state: 'bad'; text: string }
  >({ state: 'idle' });
  // A Google sign-up with no code is asked once, in a popup, whether a friend referred them.
  const askedReferral = useRef(false);
  const [askReferral, setAskReferral] = useState(false);
  const [askCode, setAskCode] = useState('');
  const [askError, setAskError] = useState<string | null>(null);
  const [askChecking, setAskChecking] = useState(false);
  const cameFromLink = !!linkRef.current && cleanReferralInput(referral).toUpperCase() === linkRef.current.toUpperCase();

  useEffect(() => {
    const code = cleanReferralInput(referral);
    if (!code) {
      setReferralCheck({ state: 'idle' });
      return;
    }
    setReferralCheck({ state: 'checking' });
    let current = true;
    const t = setTimeout(() => {
      validateReferralCode(code)
        .then(r => {
          if (!current) return;
          setReferralCheck(
            r.valid
              ? { state: 'ok', text: `✓ ${r.message || 'Referral verified'}${r.referrer_name ? ` (${r.referrer_name})` : ''}` }
              : { state: 'bad', text: r.message || 'Referral code not found.' },
          );
        })
        // Not being able to check is not a reason to stop someone signing up; the server checks again on register.
        .catch(() => current && setReferralCheck({ state: 'idle' }));
    }, 500);
    return () => {
      current = false;
      clearTimeout(t);
    };
  }, [referral]);

  const [otpModalOpen, setOtpModalOpen] = useState(false);
  /** A sign-up the server turned down — shown in a popup, so it cannot be missed at the bottom of a long form. */
  const [registerError, setRegisterError] = useState<string | null>(null);
  const [otp, setOtp] = useState('');
  const [otpSentTo, setOtpSentTo] = useState('');
  const [otpExpiresIn, setOtpExpiresIn] = useState(300);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    if (!otpModalOpen) return;
    const t = setInterval(() => {
      setOtpExpiresIn(s => Math.max(0, s - 1));
      setResendCooldown(s => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [otpModalOpen]);

  const validate = (): boolean => {
    const e: FormErrors = {};
    if (!form.name.trim() || form.name.trim().length < 2) e.name = 'Name must be at least 2 characters';
    else if (!/^[A-Za-z ]+$/.test(form.name.trim())) e.name = 'Only alphabets and spaces allowed';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Enter a valid email';
    if (!/^\d{10}$/.test(form.phone)) e.phone = 'Enter a valid 10-digit mobile number';

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  /** The code to send with a Google request, when there is one. */
  const referralForGoogle = (override?: string) => {
    const code = cleanReferralInput(override ?? referral);
    return code ? { code, fromLink: cameFromLink && code.toUpperCase() === linkRef.current?.toUpperCase() } : undefined;
  };

  /** A Google sign-up: the server makes the account from the token and these details, and signs it in. */
  const createGoogleAccount = async (code?: string) => {
    if (!google) return;
    setSubmitting(true);
    try {
      justSignedUp.current = true;
      const made = await signInWithGoogle(google.credential, form, referralForGoogle(code));
      if (made.ok) {
        trackCompleteRegistration(form.email || google.email);
        toast.success('Account created successfully!');
        reportReferral(made);
        clearSavedReferral();
        navigate(FIRST_LANDING, { replace: true });
      } else {
        justSignedUp.current = false;
        setRegisterError(made.error || 'Registration failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  /** "No, skip": carry on without a referral. */
  const skipReferral = () => {
    setAskReferral(false);
    void createGoogleAccount('');
  };

  /** "Continue" with a code: check it first, so a typo is caught here rather than after the account is made. */
  const useAskedReferral = async () => {
    const code = cleanReferralInput(askCode);
    if (!code) {
      setAskError('Enter a referral code, or skip.');
      return;
    }
    setAskChecking(true);
    setAskError(null);
    try {
      const r = await validateReferralCode(code);
      if (!r.valid) {
        setAskError(r.message || 'Referral code not found.');
        return;
      }
    } catch {
      // Not being able to check is not a reason to stop: the server checks again, and a wrong code never blocks Google sign-up.
    } finally {
      setAskChecking(false);
    }
    setReferral(code);
    setAskReferral(false);
    void createGoogleAccount(code);
  };

  /** What happened to the code on a Google sign-up: linked, or turned down (the person is in either way). */
  const reportReferral = (r: { referralApplied?: boolean | null; referralMessage?: string | null }) => {
    if (r.referralApplied === true) toast.success('✓ Referral applied');
    else if (r.referralApplied === false && r.referralMessage) toast.info(r.referralMessage);
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) {
      // The form is long; take them to the first thing that needs fixing rather than leaving the
      // error somewhere off screen above the button they just pressed.
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLElement>('.mge-input-error input')
          ?.focus({ preventScroll: false }),
      );
      return;
    }
    if (google) {
      // No code in the field: ask once whether anyone referred them, then make the account from the popup's answer.
      if (!cleanReferralInput(referral) && !askedReferral.current) {
        askedReferral.current = true;
        setAskCode('');
        setAskError(null);
        setAskReferral(true);
        return;
      }
      await createGoogleAccount();
      return;
    }
    setSubmitting(true);
    try {
      const res = await register({
        ...form,
        referralCode: cleanReferralInput(referral),
        referralFromLink: cameFromLink,
      });
      if (res.ok) {
        setOtpSentTo(res.otpSentTo || form.email);
        setOtpModalOpen(true);
        setOtpExpiresIn(300);
        setResendCooldown(60);
        toast.success(`OTP sent to ${res.otpSentTo || form.email}. Check your inbox.`);
      } else {
        setRegisterError(res.error || 'Registration failed. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  /**
   * Google gave a token on the sign-up page. If the account already exists it is simply signed in; if not,
   * the form is filled from Google and the person adds the rest.
   */
  const googleSignUp = async (credential: string) => {
    const res = await signInWithGoogle(credential, undefined, referralForGoogle());
    if (res.ok) {
      // A brand-new account the server made on the spot (it says so) is a registration; an existing one is not.
      if (res.created) trackCompleteRegistration(`google:${credential.slice(-24)}`);
      toast.success(res.created ? 'Account created successfully!' : 'Welcome back!');
      if (res.created) {
        reportReferral(res);
        clearSavedReferral();
        // Google made the account in one step, so there was no form to ask on: ask now, unless a code already linked.
        if (res.referralApplied !== true) askAboutReferral();
      }
      navigate('/user/dashboard', { replace: true });
      return;
    }
    if (res.needsProfile) {
      const claims = readGoogleCredential(credential);
      const email = res.needsProfile.email || claims?.email || '';
      const name = res.needsProfile.name || claims?.name || '';
      setGoogle({ credential, email, name });
      setForm(f => ({ ...f, name: formNameFrom(name) || f.name, email }));
      setErrors({});
      return;
    }
    setRegisterError(res.error || 'Google sign-in failed. Please try again.');
  };

  const handleVerify = async () => {
    if (otp.length !== 6) {
      toast.error('Enter the 6-digit OTP');
      return;
    }
    setVerifying(true);
    justSignedUp.current = true;
    try {
      const res = await verifyOtp(otp);
      if (res.ok) {
        trackCompleteRegistration(form.email);
        toast.success('Account created successfully!');
        clearSavedReferral();
        navigate(FIRST_LANDING, { replace: true });
      } else {
        justSignedUp.current = false;
        toast.error(res.error || 'Invalid OTP');
      }
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    const res = await resendOtp();
    if (res.ok) {
      setResendCooldown(60);
      setOtpExpiresIn(300);
      toast.success(`OTP re-sent to ${otpSentTo}.`);
    } else {
      toast.error(res.error || 'Could not resend OTP');
    }
  };

  return (
    <AuthLayout
      title="Create Your Account | MyGovExams"
      tight
      side={
        <>
          <div className="mge-benefits">
            {BENEFITS.map(b => (
              <div className="mge-benefit" key={b.label}>
                <span className={`mge-tile mge-tile-${b.tone}`}>
                  <b.icon aria-hidden="true" />
                </span>
                {b.label}
              </div>
            ))}
          </div>
          {/* `public/landing/signup.png`; the login artwork if that file is ever missing. */}
          <ArtImage name="signup.png" fallback="hero.png" alt="An aspirant studying for the exam" />
        </>
      }
    >
      <div className="mge-auth-card">
        <h1>Create Your Account</h1>
        <p className="mge-auth-sub">Start your journey towards exam success</p>

        {GOOGLE_ENABLED && !google && (
          <>
            <GoogleButton text="signup_with" onCredential={googleSignUp} />
            <div className="mge-auth-or">
              <span>or sign up with email</span>
            </div>
          </>
        )}
        {google && (
          <div className="mge-google-banner">
            <span>
              Signed in with Google as <strong>{google.email}</strong>. Add the details below to finish.
            </span>
            <button
              type="button"
              className="mge-link-btn"
              onClick={() => {
                setGoogle(null);
                setForm(f => ({ ...f, name: '', email: '' }));
              }}
            >
              Use a different account
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mge-auth-form" noValidate>
          <AuthField
            icon={User}
            value={form.name}
            onChange={v => setForm(f => ({ ...f, name: v }))}
            error={errors.name}
            placeholder="Full Name"
            autoComplete="name"
          />
          <AuthField
            icon={Mail}
            type="email"
            value={form.email}
            onChange={v => setForm(f => ({ ...f, email: v }))}
            error={errors.email}
            placeholder="Email"
            readOnly={!!google}
            autoComplete="email"
          />
          <AuthField
            icon={Phone}
            type="tel"
            inputMode="tel"
            value={form.phone}
            onChange={v => setForm(f => ({ ...f, phone: v.replace(/\D/g, '').slice(0, 10) }))}
            error={errors.phone}
            placeholder="Phone Number"
            maxLength={10}
            autoComplete="tel-national"
          />
          <AuthField
            icon={Gift}
            value={referral}
            onChange={setReferral}
            placeholder="Referral code (optional)"
            autoComplete="off"
            error={referralCheck.state === 'bad' ? referralCheck.text : undefined}
            hint={
              referralCheck.state === 'ok'
                ? referralCheck.text
                : referralCheck.state === 'checking'
                  ? 'Checking…'
                  : 'Code, or your friend’s mobile number or email'
            }
          />

          <button type="submit" disabled={submitting} className="mge-btn mge-btn-primary mge-auth-submit">
            {submitting ? (
              <>
                <span className="mge-spinner" /> Sending OTP...
              </>
            ) : (
              <>
                Sign Up <ArrowRight size={19} />
              </>
            )}
          </button>
          <p className="mge-auth-terms">
            By signing up, you agree to our{' '}
            <Link to="/terms" target="_blank" rel="noopener noreferrer">
              Terms and Conditions
            </Link>{' '}
            and{' '}
            <Link to="/privacy" target="_blank" rel="noopener noreferrer">
              Privacy Policy
            </Link>
            .
          </p>
        </form>

        <p className="mge-auth-switch" style={{ marginTop: 22 }}>
          Already have an account?
          <Link to={ROUTES.login}>Login</Link>
        </p>
      </div>

      {askReferral && (
        <AuthModal>
          <div className="mge-modal-icon mge-tile-orange">
            <Gift size={30} />
          </div>
          <h2>Were you referred by someone?</h2>
          <p>Link your account to the friend who told you about MyGovExams. You can skip this.</p>
          <div style={{ textAlign: 'left', marginBottom: 14 }}>
            <AuthField
              icon={Gift}
              value={askCode}
              onChange={v => {
                setAskCode(v);
                setAskError(null);
              }}
              placeholder="Referral code"
              autoComplete="off"
              error={askError ?? undefined}
              hint="Code, or your friend’s mobile number or email"
            />
          </div>
          <button
            type="button"
            className="mge-btn mge-btn-primary mge-auth-submit"
            onClick={useAskedReferral}
            disabled={askChecking}
            autoFocus
          >
            {askChecking ? 'Checking…' : 'Continue'}
          </button>
          <button
            type="button"
            className="mge-btn mge-auth-submit"
            style={{ marginTop: 10, background: 'transparent', color: 'inherit', boxShadow: 'none' }}
            onClick={skipReferral}
            disabled={askChecking}
          >
            No, skip
          </button>
        </AuthModal>
      )}

      {registerError && (
        <AuthModal>
          <div className="mge-modal-icon mge-tile-orange">
            <AlertCircle size={30} />
          </div>
          <h2>Couldn't create your account</h2>
          <p>{registerError}</p>
          <button type="button" className="mge-btn mge-btn-primary mge-auth-submit" onClick={() => setRegisterError(null)} autoFocus>
            OK
          </button>
        </AuthModal>
      )}

      {otpModalOpen && (
        <AuthModal>
          <div className="mge-modal-icon mge-tile-green">
            <CheckCircle2 size={30} />
          </div>
          <h2>Verify your email</h2>
          <p>
            We sent a 6-digit OTP to <strong style={{ wordBreak: 'break-all' }}>{otpSentTo}</strong>
          </p>

          <input
            className="mge-otp"
            type="text"
            value={otp}
            onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="••••••"
            aria-label="6-digit OTP"
            autoFocus
            maxLength={6}
            inputMode="numeric"
            autoComplete="one-time-code"
          />

          <div className="mge-otp-row">
            <span className={otpExpiresIn === 0 ? 'mge-expired' : undefined}>
              {otpExpiresIn > 0
                ? `Expires in ${Math.floor(otpExpiresIn / 60)}:${String(otpExpiresIn % 60).padStart(2, '0')}`
                : 'OTP expired'}
            </span>
            <button type="button" className="mge-link-btn" onClick={handleResend} disabled={resendCooldown > 0}>
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
            </button>
          </div>

          <button
            type="button"
            className="mge-btn mge-btn-primary mge-auth-submit"
            onClick={handleVerify}
            disabled={verifying || otp.length !== 6 || otpExpiresIn === 0}
          >
            {verifying ? 'Verifying...' : 'Verify & Continue'}
          </button>
          <button type="button" className="mge-modal-text-btn" onClick={() => setOtpModalOpen(false)}>
            Change details
          </button>
        </AuthModal>
      )}
    </AuthLayout>
  );
}

/** What an account gets, beside the sign-up form. */
const BENEFITS = [
  { icon: FileText, label: 'Practice with mock tests', tone: 'blue' },
  { icon: BookOpen, label: 'Learn unit-wise by topic', tone: 'orange' },
  { icon: Target, label: 'Analyse your performance', tone: 'purple' },
  { icon: BarChart3, label: 'Get a personalized study plan', tone: 'green' },
];

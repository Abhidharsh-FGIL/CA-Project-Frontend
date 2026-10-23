import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Calendar,
  AlertCircle,
  CheckCircle2,
  FileText,
  Mail,
  Phone,
  Target,
  User,
  Users,
} from 'lucide-react';
import { useUserPortal } from '@/contexts/UserPortalContext';
import { TNPSC_GROUPS } from '@/config/tnpsc';
import { GOOGLE_ENABLED } from '@/config/google';
import { formNameFrom, readGoogleCredential } from '@/lib/google-identity';
import { UPCOMING_EXAMS, splitExams } from '@/lib/exam-listing';
import { toast } from 'sonner';
import { ROUTES } from '@/pages/landing/LandingShell';
import { ArtImage, AuthField, AuthLayout, AuthModal, AuthSelect } from './auth/AuthShell';
import { GoogleButton } from './auth/GoogleButton';
import { trackCompleteRegistration } from '@/lib/meta-pixel';

/** Today in the person's own calendar, as `YYYY-MM-DD` — the latest birth date the form takes. */
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
  date_of_birth?: string;
  gender?: string;
  student_class?: string;
  section?: string;
  roll_no?: string;
  school_name?: string;
  medium?: string;
  class_teacher?: string;
  academic_year?: string;
  preferred_exam?: string;
}

/** Where a newly created account lands: the exam list, not the (still empty) dashboard. */
const FIRST_LANDING = '/user/exams';

const GENDER_OPTIONS = ['Male', 'Female', 'Other'];
/**
 * Exams an aspirant can register against — the ones that are open (see `exam-listing.ts`), read
 * from the shared catalog rather than hardcoded, so opening another exam offers it here too. The
 * stored value is the group id; the label is what the aspirant reads. An exam that is not open
 * yet is not offered: signing up for it would land on screens that say it is coming soon.
 */
const EXAM_OPTIONS = [
  ...splitExams(TNPSC_GROUPS).open.map(g => ({ value: g.id, label: g.name, disabled: false })),
  // The rest are listed so aspirants see what is coming, but cannot be chosen yet.
  ...splitExams(TNPSC_GROUPS).soon.map(g => ({ value: g.id, label: `${g.name} (Coming soon)`, disabled: true })),
  ...UPCOMING_EXAMS.map(e => ({ value: e.id, label: `${e.name} (Coming soon)`, disabled: true })),
];

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
    date_of_birth: '',
    gender: '',
    student_class: '',
    section: '',
    roll_no: '',
    school_name: '',
    medium: '',
    class_teacher: '',
    academic_year: '',
    // With one exam open there is nothing to choose, so it is already chosen.
    preferred_exam: EXAM_OPTIONS.length === 1 ? EXAM_OPTIONS[0].value : '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

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

    // Aspirant details relevant to competitive exams.
    if (!form.date_of_birth) e.date_of_birth = 'Date of birth is required';
    else if (form.date_of_birth > todayISO()) e.date_of_birth = 'Date of birth cannot be in the future';
    if (!form.gender) e.gender = 'Select a gender';
    if (!form.preferred_exam) e.preferred_exam = 'Select the exam you are preparing for';
    // Class / Section / Roll No. / School / Teacher / Academic Year are not collected for competitive exams.

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) {
      // The form is long; take them to the first thing that needs fixing rather than leaving the
      // error somewhere off screen above the button they just pressed.
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLElement>('.mge-input-error input, .mge-input-error select')
          ?.focus({ preventScroll: false }),
      );
      return;
    }
    setSubmitting(true);
    try {
      if (google) {
        // A Google sign-up: the server makes the account from the token and these details, and signs it in.
        justSignedUp.current = true;
        const made = await signInWithGoogle(google.credential, form);
        if (made.ok) {
          trackCompleteRegistration(form.email || google.email);
          toast.success('Account created successfully!');
          navigate(FIRST_LANDING, { replace: true });
        } else {
          justSignedUp.current = false;
          setRegisterError(made.error || 'Registration failed. Please try again.');
        }
        return;
      }
      const res = await register(form);
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
    const res = await signInWithGoogle(credential);
    if (res.ok) {
      // A brand-new account the server made on the spot (it says so) is a registration; an existing one is not.
      if (res.created) trackCompleteRegistration(`google:${credential.slice(-24)}`);
      toast.success(res.created ? 'Account created successfully!' : 'Welcome back!');
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
            icon={Calendar}
            type="date"
            label="Date of Birth"
            max={todayISO()}
            value={form.date_of_birth}
            onChange={v => setForm(f => ({ ...f, date_of_birth: v }))}
            error={errors.date_of_birth}
            autoComplete="bday"
          />
          <AuthSelect
            icon={Users}
            label="Gender"
            placeholder="Select gender"
            value={form.gender}
            onChange={v => setForm(f => ({ ...f, gender: v }))}
            error={errors.gender}
            options={GENDER_OPTIONS}
          />
          <AuthSelect
            icon={Target}
            label="Preparing for"
            placeholder="Select the exam"
            value={form.preferred_exam}
            onChange={v => setForm(f => ({ ...f, preferred_exam: v }))}
            error={errors.preferred_exam}
            options={EXAM_OPTIONS}
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

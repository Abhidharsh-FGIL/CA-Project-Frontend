import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Calendar,
  CheckCircle2,
  Eye,
  EyeOff,
  FileText,
  Languages,
  Lock,
  Mail,
  Phone,
  Target,
  User,
  Users,
} from 'lucide-react';
import { useUserPortal } from '@/contexts/UserPortalContext';
import { TNPSC_GROUPS } from '@/config/tnpsc';
import { toast } from 'sonner';
import { ROUTES } from '@/pages/landing/LandingShell';
import { ArtImage, AuthField, AuthLayout, AuthModal, AuthSelect } from './auth/AuthShell';

interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
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
 * Exams an aspirant can register against — read from the shared catalog rather
 * than hardcoded, so adding a group to TNPSC_GROUPS also offers it here. The
 * stored value is the group id; the label is what the aspirant reads.
 */
const EXAM_OPTIONS = TNPSC_GROUPS.map(g => ({ value: g.id, label: `${g.name} — ${g.tagline}` }));
const MEDIUM_OPTIONS = ['English', 'Tamil', 'Hindi', 'Telugu', 'Kannada', 'Malayalam', 'Marathi', 'Bengali', 'Gujarati', 'Other'];

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register, verifyOtp, resendOtp, isAuthenticated } = useUserPortal();

  // A brand-new account lands on the exam list — the first thing an aspirant needs is to pick
  // what to prepare for. Someone who is already signed in and merely opens /register goes to the
  // dashboard as before. `verifyOtp` signs the user in before it returns, so this effect fires
  // mid-verification: the ref tells it which of the two it is looking at.
  const justSignedUp = useRef(false);
  useEffect(() => {
    if (isAuthenticated) navigate(justSignedUp.current ? FIRST_LANDING : '/user/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    date_of_birth: '',
    gender: '',
    student_class: '',
    section: '',
    roll_no: '',
    school_name: '',
    medium: '',
    class_teacher: '',
    academic_year: '',
    preferred_exam: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});
  const [showPwd, setShowPwd] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [otpModalOpen, setOtpModalOpen] = useState(false);
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
    if (!/^.{8,}$/.test(form.password)) e.password = 'Minimum 8 characters';
    else if (!/[A-Z]/.test(form.password) || !/\d/.test(form.password) || !/[^A-Za-z0-9]/.test(form.password))
      e.password = 'Must include 1 uppercase, 1 number, 1 special character';
    if (form.password !== form.confirmPassword) e.confirmPassword = 'Passwords do not match';

    // Aspirant details relevant to competitive exams.
    if (!form.date_of_birth) e.date_of_birth = 'Date of birth is required';
    else if (new Date(form.date_of_birth) > new Date()) e.date_of_birth = 'Date of birth cannot be in the future';
    if (!form.gender) e.gender = 'Select a gender';
    if (!form.medium) e.medium = 'Select a medium';
    if (!form.preferred_exam) e.preferred_exam = 'Select the exam you are preparing for';
    // Class / Section / Roll No. / School / Teacher / Academic Year are not collected for competitive exams.

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const res = await register(form);
      if (res.ok) {
        setOtpSentTo(res.otpSentTo || form.email);
        setOtpModalOpen(true);
        setOtpExpiresIn(300);
        setResendCooldown(60);
        toast.success(`OTP sent to ${res.otpSentTo || form.email}. Check your inbox.`);
      } else {
        toast.error(res.error || 'Registration failed');
      }
    } finally {
      setSubmitting(false);
    }
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
            icon={Lock}
            type={showPwd ? 'text' : 'password'}
            value={form.password}
            onChange={v => setForm(f => ({ ...f, password: v }))}
            error={errors.password}
            hint="Min 8 chars, 1 uppercase, 1 number, 1 special character"
            placeholder="Password"
            autoComplete="new-password"
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
          <AuthField
            icon={Lock}
            type={showPwd ? 'text' : 'password'}
            value={form.confirmPassword}
            onChange={v => setForm(f => ({ ...f, confirmPassword: v }))}
            error={errors.confirmPassword}
            placeholder="Confirm Password"
            autoComplete="new-password"
          />
          <AuthField
            icon={Calendar}
            type="date"
            label="Date of Birth"
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
            icon={Languages}
            label="Medium"
            placeholder="Select medium"
            value={form.medium}
            onChange={v => setForm(f => ({ ...f, medium: v }))}
            error={errors.medium}
            options={MEDIUM_OPTIONS}
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

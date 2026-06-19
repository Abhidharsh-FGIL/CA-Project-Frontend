import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { GraduationCap, Eye, EyeOff, CheckCircle2 } from 'lucide-react';
import { useUserPortal } from '@/contexts/UserPortalContext';
import { toast } from 'sonner';

interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
  password?: string;
  confirmPassword?: string;
}

export default function RegisterPage() {
  const navigate = useNavigate();
  const { register, verifyOtp, resendOtp, isAuthenticated } = useUserPortal();

  useEffect(() => {
    if (isAuthenticated) navigate('/user/dashboard', { replace: true });
  }, [isAuthenticated, navigate]);

  const [form, setForm] = useState({ name: '', email: '', phone: '', password: '', confirmPassword: '' });
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
    try {
      const res = await verifyOtp(otp);
      if (res.ok) {
        toast.success('Account created successfully!');
        navigate('/user/dashboard');
      } else {
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
    <div className="h-[100dvh] overflow-y-auto bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-100 dark:from-slate-950 dark:via-indigo-950/60 dark:to-purple-950/60 flex items-center justify-center p-4 py-8 relative">
      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-purple-300/30 dark:bg-purple-700/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-indigo-300/30 dark:bg-indigo-700/20 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full relative z-10 animate-fadeIn">
        <Link to="/" className="flex items-center justify-center gap-2 mb-8 group">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-indigo-900/50 group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <span className="text-lg font-bold gradient-text">FGIL CA Academy</span>
        </Link>

        <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur rounded-2xl shadow-xl shadow-indigo-100/50 dark:shadow-black/40 border border-white dark:border-gray-800 p-5 sm:p-7 animate-scaleIn">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">Create your account</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">Start practising CA Foundation, Inter, Final & more.</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Field
              label="Full Name"
              value={form.name}
              onChange={v => setForm(f => ({ ...f, name: v }))}
              error={errors.name}
              placeholder="John Doe"
            />
            <Field
              label="Email"
              type="email"
              value={form.email}
              onChange={v => setForm(f => ({ ...f, email: v }))}
              error={errors.email}
              placeholder="you@example.com"
            />
            <Field
              label="Phone Number"
              type="tel"
              value={form.phone}
              onChange={v => setForm(f => ({ ...f, phone: v.replace(/\D/g, '').slice(0, 10) }))}
              error={errors.phone}
              placeholder="9876543210"
              maxLength={10}
            />
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={form.password}
                  onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                  placeholder="••••••••"
                  className={`w-full px-4 py-2.5 pr-11 border-2 rounded-xl outline-none transition-all text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 ${
                    errors.password
                      ? 'border-red-300 dark:border-red-800 focus:border-red-500 focus:ring-2 focus:ring-red-100 dark:focus:ring-red-900/40'
                      : 'border-gray-200 dark:border-gray-700 focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/40'
                  }`}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.password ? (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">{errors.password}</p>
              ) : (
                <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">Min 8 chars, 1 uppercase, 1 number, 1 special character</p>
              )}
            </div>
            <Field
              label="Confirm Password"
              type={showPwd ? 'text' : 'password'}
              value={form.confirmPassword}
              onChange={v => setForm(f => ({ ...f, confirmPassword: v }))}
              error={errors.confirmPassword}
              placeholder="••••••••"
            />

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-[length:200%_auto] text-white py-3 rounded-xl font-semibold hover:bg-right-bottom transition-all duration-500 shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-300 disabled:opacity-60 active:scale-[0.98] press"
            >
              {submitting ? (
                <span className="inline-flex items-center gap-2">
                  <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Sending OTP...
                </span>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 dark:text-gray-400 mt-6">
            Already have an account?{' '}
            <Link to="/user/login" className="text-indigo-600 dark:text-indigo-400 font-semibold hover:underline">
              Log in
            </Link>
          </p>
        </div>
      </div>

      {/* OTP Modal */}
      {otpModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fadeIn">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-sm w-full p-7 animate-scaleIn border border-transparent dark:border-gray-800">
            <div className="text-center mb-5">
              <div className="relative w-14 h-14 mx-auto mb-3">
                <div className="absolute inset-0 rounded-full bg-indigo-400/40 animate-pulse-ring" />
                <div className="relative w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-indigo-900/50">
                  <CheckCircle2 className="w-7 h-7 text-white" />
                </div>
              </div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Verify your email</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                We sent a 6-digit OTP to{' '}
                <span className="font-semibold text-gray-700 dark:text-gray-200 break-all">{otpSentTo}</span>
              </p>
            </div>

            <input
              type="text"
              value={otp}
              onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••••"
              autoFocus
              maxLength={6}
              inputMode="numeric"
              className="w-full text-center text-2xl tracking-[0.5em] font-bold py-3 border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-300 dark:placeholder:text-gray-600 rounded-xl focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/40 outline-none transition-all"
            />

            <div className="flex items-center justify-between mt-3 text-xs">
              <span className={otpExpiresIn === 0 ? 'text-red-500 dark:text-red-400' : 'text-gray-500 dark:text-gray-400'}>
                {otpExpiresIn > 0
                  ? `Expires in ${Math.floor(otpExpiresIn / 60)}:${String(otpExpiresIn % 60).padStart(2, '0')}`
                  : 'OTP expired'}
              </span>
              <button
                onClick={handleResend}
                disabled={resendCooldown > 0}
                className="text-indigo-600 dark:text-indigo-400 font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
              </button>
            </div>

            <button
              onClick={handleVerify}
              disabled={verifying || otp.length !== 6 || otpExpiresIn === 0}
              className="w-full mt-5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white py-3 rounded-xl font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all disabled:opacity-50"
            >
              {verifying ? 'Verifying...' : 'Verify & Continue'}
            </button>

            <button
              onClick={() => setOtpModalOpen(false)}
              className="w-full mt-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 py-2"
            >
              Change details
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  error,
  type = 'text',
  placeholder,
  maxLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  type?: string;
  placeholder?: string;
  maxLength?: number;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">{label}</label>
      <input
        type={type}
        value={value}
        maxLength={maxLength}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full px-4 py-2.5 border-2 rounded-xl outline-none transition-all text-sm bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 ${
          error
            ? 'border-red-300 dark:border-red-800 focus:border-red-500 focus:ring-2 focus:ring-red-100 dark:focus:ring-red-900/40'
            : 'border-gray-200 dark:border-gray-700 focus:border-indigo-500 dark:focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/40'
        }`}
      />
      {error && <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>}
    </div>
  );
}

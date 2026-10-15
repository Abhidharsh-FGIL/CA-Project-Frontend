/**
 * "Login with OTP" — the second way into the login card.
 *
 * Two steps in one place: the student gives an email ID or a mobile number, and is sent a
 * six-digit code; then types the code and is signed in. The server keeps the rules (60 seconds
 * between codes, a code lasts 5 minutes, 5 wrong tries cancel it); this form counts the same
 * clocks so the student can see them, and shows the server's own words when it says no.
 */
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { useUserPortal } from '@/contexts/UserPortalContext';
import {
  OTP_VALID_SECONDS,
  RESEND_COOLDOWN_SECONDS,
  clock,
  needsNewOtp,
  otpDigits,
  parseIdentifier,
  secondsToWait,
} from '@/lib/login-otp';
import { AuthField } from './AuthShell';

type Step = 'identify' | 'code';

/** What came of asking for a code. */
type Asked = 'sent' | 'already-sent' | 'refused';

export function LoginOtpForm({
  initialIdentifier = '',
  onUsePassword,
}: {
  /** Whatever the student had already typed in the email box. */
  initialIdentifier?: string;
  /** The way back to the password form. Left out when password login is switched off. */
  onUsePassword?: () => void;
}) {
  const navigate = useNavigate();
  const { sendLoginOtp, loginWithOtp } = useUserPortal();

  const [step, setStep] = useState<Step>('identify');
  const [typed, setTyped] = useState(initialIdentifier);
  const [typedError, setTypedError] = useState('');
  /** The email ID or mobile number the code was asked for — the server wants the same one back. */
  const [identifier, setIdentifier] = useState('');
  /** What the server said about where the code went. */
  const [sentNote, setSentNote] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [expiresIn, setExpiresIn] = useState(0);

  useEffect(() => {
    if (step !== 'code') return;
    const t = setInterval(() => {
      setCooldown(s => Math.max(0, s - 1));
      setExpiresIn(s => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [step]);

  /** Ask for a code. A request inside the 60 seconds is the server saying one is already on its way. */
  const ask = async (who: string): Promise<Asked> => {
    setBusy(true);
    setError('');
    try {
      const res = await sendLoginOtp(who);
      if (res.ok) {
        setSentNote(res.message || 'OTP sent. Enter it below.');
        setOtp('');
        setCooldown(RESEND_COOLDOWN_SECONDS);
        setExpiresIn(OTP_VALID_SECONDS);
        return 'sent';
      }
      const message = res.error || 'Could not send the OTP';
      const wait = secondsToWait(message);
      if (wait === null) {
        setError(message);
        return 'refused';
      }
      // The code sent a moment ago is still good: it was sent (60 - wait) seconds back.
      setCooldown(wait);
      setExpiresIn(OTP_VALID_SECONDS - (RESEND_COOLDOWN_SECONDS - wait));
      return 'already-sent';
    } finally {
      setBusy(false);
    }
  };

  const submitIdentifier = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseIdentifier(typed);
    if ('error' in parsed) {
      setTypedError(parsed.error);
      return;
    }
    setTypedError('');
    const result = await ask(parsed.identifier);
    if (result === 'refused') return;
    setIdentifier(parsed.identifier);
    if (result === 'already-sent') setSentNote('An OTP was sent a moment ago. Check your inbox and enter it below.');
    setStep('code');
  };

  const resend = async () => {
    if (cooldown > 0 || busy) return;
    const result = await ask(identifier);
    if (result === 'sent') toast.success('A new OTP has been sent');
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (otp.length !== 6 || expiresIn === 0 || busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await loginWithOtp(identifier, otp);
      if (res.ok) {
        toast.success('Welcome back!');
        navigate('/user/dashboard');
        return;
      }
      const message = res.error || 'Login failed';
      setError(message);
      if (needsNewOtp(message)) {
        // The server has thrown the code away; the same digits can only fail again.
        setOtp('');
        setExpiresIn(0);
      }
    } finally {
      setBusy(false);
    }
  };

  const changeIdentifier = () => {
    setStep('identify');
    setOtp('');
    setError('');
  };

  if (step === 'identify') {
    return (
      <>
        <p className="mge-auth-sub">Enter your registered email ID or mobile number to get a one-time password</p>

        {error && (
          <div className="mge-auth-alert" role="alert">
            {error}
          </div>
        )}

        <form onSubmit={submitIdentifier} className="mge-auth-form" noValidate>
          <AuthField
            icon={Mail}
            value={typed}
            onChange={v => {
              setTyped(v);
              setTypedError('');
            }}
            placeholder="Email ID or Mobile number"
            error={typedError}
            autoComplete="username"
          />
          <button type="submit" disabled={busy} className="mge-btn mge-btn-primary mge-auth-submit">
            {busy ? (
              <>
                <span className="mge-spinner" /> Sending OTP...
              </>
            ) : (
              <>
                Send OTP <ArrowRight size={19} />
              </>
            )}
          </button>
          {onUsePassword && (
            <button type="button" className="mge-modal-text-btn" onClick={onUsePassword}>
              Login with Password
            </button>
          )}
        </form>
      </>
    );
  }

  const expired = expiresIn === 0;
  return (
    <>
      <p className="mge-auth-sub" style={{ wordBreak: 'break-word' }}>
        {sentNote}
      </p>

      {error && (
        <div className="mge-auth-alert" role="alert">
          {error}
        </div>
      )}

      <form onSubmit={verify} className="mge-auth-form">
        <div>
          <input
            className="mge-otp"
            type="text"
            value={otp}
            onChange={e => setOtp(otpDigits(e.target.value))}
            placeholder="••••••"
            aria-label="6-digit OTP"
            autoFocus
            maxLength={6}
            inputMode="numeric"
            autoComplete="one-time-code"
          />
          <div className="mge-otp-row">
            <span className={expired ? 'mge-expired' : undefined}>
              {expired ? 'OTP expired' : `Expires in ${clock(expiresIn)}`}
            </span>
            <button type="button" className="mge-link-btn" onClick={resend} disabled={cooldown > 0 || busy}>
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend OTP'}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={busy || otp.length !== 6 || expired}
          className="mge-btn mge-btn-primary mge-auth-submit"
        >
          {busy ? (
            <>
              <span className="mge-spinner" /> Verifying...
            </>
          ) : (
            <>
              Verify &amp; Login <ArrowRight size={19} />
            </>
          )}
        </button>
        <button type="button" className="mge-modal-text-btn" onClick={changeIdentifier}>
          Change email / mobile number
        </button>
      </form>
    </>
  );
}

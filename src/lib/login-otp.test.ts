import { describe, expect, it } from 'vitest';
import { clock, needsNewOtp, otpDigits, parseIdentifier, secondsToWait } from '@/lib/login-otp';

describe('parseIdentifier', () => {
  it('takes an email as typed, trimmed', () => {
    expect(parseIdentifier('  ezhilnambi@gmail.com ')).toEqual({ identifier: 'ezhilnambi@gmail.com', kind: 'email' });
  });

  it('asks for something when the box is empty', () => {
    expect(parseIdentifier('')).toEqual({ error: 'Enter your email ID' });
    expect(parseIdentifier('   ')).toEqual({ error: 'Enter your email ID' });
  });

  it('no longer takes a mobile number', () => {
    for (const bad of ['9876543210', '98765 43210', '+919876543210']) {
      expect(parseIdentifier(bad), bad).toHaveProperty('error');
    }
  });

  it('refuses an email that is not one', () => {
    for (const bad of ['abc@', '@gmail.com', 'abc@gmail', 'a b@gmail.com']) {
      expect(parseIdentifier(bad), bad).toHaveProperty('error');
    }
  });

  it('says the same thing the server would when it refuses', () => {
    expect(parseIdentifier('nope')).toEqual({ error: 'Enter a valid email ID' });
  });
});

describe('otpDigits', () => {
  it('keeps the digits and no more than six', () => {
    expect(otpDigits('12a3-4 56789')).toBe('123456');
    expect(otpDigits('')).toBe('');
  });
});

describe('secondsToWait', () => {
  it('reads the wait out of the server message', () => {
    expect(secondsToWait('Please wait 42 seconds before requesting a new OTP')).toBe(42);
    expect(secondsToWait('Please wait 1 second before requesting a new OTP')).toBe(1);
  });

  it('is null for any other message', () => {
    expect(secondsToWait('Invalid or expired OTP')).toBeNull();
    expect(secondsToWait('No account found with this email or mobile number')).toBeNull();
  });
});

describe('needsNewOtp', () => {
  it('knows the code was cancelled after too many wrong tries', () => {
    expect(needsNewOtp('Too many wrong OTPs. Please request a new OTP.')).toBe(true);
  });

  it('does not take an ordinary wrong code for a cancelled one', () => {
    expect(needsNewOtp('Invalid or expired OTP')).toBe(false);
  });
});

describe('clock', () => {
  it('shows minutes and padded seconds', () => {
    expect(clock(300)).toBe('5:00');
    expect(clock(247)).toBe('4:07');
    expect(clock(0)).toBe('0:00');
  });

  it('never goes below zero', () => {
    expect(clock(-3)).toBe('0:00');
  });
});

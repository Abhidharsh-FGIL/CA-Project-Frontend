import { describe, expect, it } from 'vitest';
import { PASSWORD_HINT, confirmError, passwordError, passwordMisses } from '@/lib/password-rules';

describe('passwordMisses', () => {
  it('is empty for a password that meets every part of the rule', () => {
    expect(passwordMisses('Abcdef1!')).toEqual([]);
    expect(passwordMisses('Tn@psc2026')).toEqual([]);
  });

  it('names each part that is missing', () => {
    expect(passwordMisses('abcdefgh')).toEqual(['1 uppercase letter', '1 number', '1 special character']);
    expect(passwordMisses('ABCDEFG1')).toEqual(['1 special character']);
    expect(passwordMisses('Abcdefg!')).toEqual(['1 number']);
    expect(passwordMisses('abcdefg1!')).toEqual(['1 uppercase letter']);
  });

  it('counts a short password as missing its length, as well as anything else', () => {
    expect(passwordMisses('Ab1!')).toEqual(['at least 8 characters']);
    expect(passwordMisses('ab')).toEqual(['at least 8 characters', '1 uppercase letter', '1 number', '1 special character']);
  });

  it('treats a space or an underscore as a special character, and a letter as not one', () => {
    expect(passwordMisses('Abcdef1 ')).toEqual([]);
    expect(passwordMisses('Abcdef1_')).toEqual([]);
    expect(passwordMisses('Abcdefg1')).toEqual(['1 special character']);
  });
});

describe('passwordError', () => {
  it('is null for a good password', () => {
    expect(passwordError('Abcdef1!')).toBeNull();
  });

  it('says what a weak password needs, and only that', () => {
    expect(passwordError('abcdefgh')).toBe('Password needs 1 uppercase letter, 1 number and 1 special character');
    expect(passwordError('ABCDEFG1')).toBe('Password needs 1 special character');
    expect(passwordError('Ab1!')).toBe('Password needs at least 8 characters');
    expect(passwordError('Abcdefg1')).toBe('Password needs 1 special character');
  });

  it('asks for a password when there is none, rather than listing everything', () => {
    expect(passwordError('')).toBe('Enter a password');
  });

  it('the hint and the check name the same rule', () => {
    expect(PASSWORD_HINT).toMatch(/8 chars.*uppercase.*number.*special/);
  });
});

describe('confirmError', () => {
  it('is null when the two match', () => {
    expect(confirmError('Abcdef1!', 'Abcdef1!')).toBeNull();
  });

  it('says so when they differ, including by case or a trailing space', () => {
    expect(confirmError('Abcdef1!', 'Abcdef1?')).toBe('Passwords do not match');
    expect(confirmError('Abcdef1!', 'abcdef1!')).toBe('Passwords do not match');
    expect(confirmError('Abcdef1!', 'Abcdef1! ')).toBe('Passwords do not match');
  });

  it('asks for the confirmation when it is empty', () => {
    expect(confirmError('Abcdef1!', '')).toBe('Confirm your password');
  });
});

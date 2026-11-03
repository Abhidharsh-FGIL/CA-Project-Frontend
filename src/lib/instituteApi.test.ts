import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  forgetInstituteLink,
  instituteLoginUrl,
  instituteSession,
  instituteSignupField,
  instituteSignupUrl,
  instituteSlug,
  rememberInstituteLink,
} from './instituteApi';

// The tests run without a browser, so storage is a plain in-memory map.
const store = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => void store.set(k, v),
  removeItem: (k: string) => void store.delete(k),
});

describe('instituteSlug', () => {
  it('makes an address from the name', () => {
    expect(instituteSlug('Sri Ram Academy')).toBe('sri-ram-academy');
    expect(instituteSlug('  Sri Ram Academy (Chennai) ')).toBe('sri-ram-academy-chennai');
    expect(instituteSlug('A&B  Coaching!!')).toBe('a-b-coaching');
  });

  it('drops accents and gives nothing for a name with no letters or digits it can use', () => {
    expect(instituteSlug('Café Étude')).toBe('cafe-etude');
    expect(instituteSlug('தமிழ்')).toBe('');
  });
});

describe('institute addresses', () => {
  it('puts the institute in the hash route, since the app routes by hash', () => {
    expect(instituteLoginUrl('sri-ram')).toMatch(/#\/institute\/sri-ram$/);
    expect(instituteSignupUrl('sri-ram')).toMatch(/#\/register\?institute=sri-ram$/);
  });
});

describe('the sign-up link', () => {
  beforeEach(() => {
    forgetInstituteLink();
  });

  it('is remembered, and carried on the sign-up call as institute_slug', () => {
    expect(instituteSignupField()).toEqual({});
    rememberInstituteLink('?institute=Sri-Ram');
    expect(instituteSignupField()).toEqual({ institute_slug: 'sri-ram' });
    forgetInstituteLink();
    expect(instituteSignupField()).toEqual({});
  });

  it('ignores an address that is not an institute slug', () => {
    rememberInstituteLink('?institute=../../etc');
    rememberInstituteLink('?ref=ABC123');
    expect(instituteSignupField()).toEqual({});
  });
});

describe('the institute session', () => {
  beforeEach(() => instituteSession.clear());

  it('belongs to one institute: a token for another one does not open this page', () => {
    instituteSession.save('a', 'r', 'sri-ram');
    expect(instituteSession.signedInTo('sri-ram')).toBe(true);
    expect(instituteSession.signedInTo('other-academy')).toBe(false);
    instituteSession.clear();
    expect(instituteSession.signedInTo('sri-ram')).toBe(false);
  });
});

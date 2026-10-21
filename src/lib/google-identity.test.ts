import { describe, expect, it } from 'vitest';
import { formNameFrom, readGoogleCredential } from '@/lib/google-identity';

/** A JWT with the given claims and no real signature — the page only reads it, the server checks it. */
function jwt(claims: Record<string, unknown>): string {
  const b64 = (o: unknown) => btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${b64({ alg: 'RS256' })}.${b64(claims)}.signature`;
}

describe('readGoogleCredential', () => {
  it('reads the email, name and picture', () => {
    expect(readGoogleCredential(jwt({ email: 'reeba@gmail.com', name: 'Reeba S', picture: 'https://x/p.png' }))).toEqual({
      email: 'reeba@gmail.com',
      name: 'Reeba S',
      picture: 'https://x/p.png',
    });
  });

  it('reads a Tamil name intact', () => {
    expect(readGoogleCredential(jwt({ email: 'a@b.co', name: 'ரீபா' }))?.name).toBe('ரீபா');
  });

  it('copes with a token that has no name or picture', () => {
    expect(readGoogleCredential(jwt({ email: 'a@b.co' }))).toEqual({ email: 'a@b.co', name: '', picture: null });
  });

  it('is null when there is no email, or the token is not a token', () => {
    expect(readGoogleCredential(jwt({ name: 'No Email' }))).toBeNull();
    expect(readGoogleCredential('not-a-jwt')).toBeNull();
    expect(readGoogleCredential('a.@@@.c')).toBeNull();
    expect(readGoogleCredential('')).toBeNull();
  });
});

describe('formNameFrom', () => {
  it('keeps letters and single spaces — what the sign-up form accepts', () => {
    expect(formNameFrom('A. Kumar')).toBe('A Kumar');
    expect(formNameFrom("Mary-Ann O'Neil")).toBe('Mary Ann O Neil');
    expect(formNameFrom('  Reeba   S ')).toBe('Reeba S');
  });

  it('keeps Tamil letters, with their vowel signs', () => {
    expect(formNameFrom('ரீபா S')).toBe('ரீபா S');
  });

  it('drops digits and symbols', () => {
    expect(formNameFrom('Student 2026 ✓')).toBe('Student');
  });
});

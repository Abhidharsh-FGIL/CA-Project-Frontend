import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getUserToken } from '@/lib/api';
import { googleAuth, type GoogleSignUpProfile } from '@/lib/userAuthApi';

/**
 * What the page does with the backend's answer to a Google ID token: sign in, ask for the missing details,
 * or create the account from them. The token itself is checked by the server — the page only passes it on.
 */

let store: Map<string, string>;
let fetchMock: ReturnType<typeof vi.fn>;

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });
const bodyOfCall = (i = 0) => JSON.parse(fetchMock.mock.calls[i][1].body as string);

const profile: GoogleSignUpProfile = {
  full_name: 'Reeba S',
  mobile_number: '9876543210',
  date_of_birth: '2000-01-01',
  gender: 'Female',
  medium: 'tamil',
  preferred_exam: 'group-4',
  student_class: '',
  section: '',
  roll_no: '',
  school_name: '',
  class_teacher: '',
  academic_year: '',
};

beforeEach(() => {
  store = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  vi.stubGlobal('window', { location: { href: '' } });
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('googleAuth', () => {
  it('signs an existing account in and keeps its tokens', async () => {
    fetchMock.mockResolvedValue(json(200, { access_token: 'a1', refresh_token: 'r1', token_type: 'bearer' }));
    await expect(googleAuth('google-id-token')).resolves.toMatchObject({ kind: 'signed-in', created: false, referralApplied: null });
    expect(getUserToken()).toBe('a1');
    expect(store.get('user_refresh_token')).toBe('r1');
  });

  it('says when the server made a new account in the same call', async () => {
    fetchMock.mockResolvedValue(json(200, { access_token: 'a', refresh_token: 'r', token_type: 'bearer', is_new_user: true }));
    await expect(googleAuth('google-id-token')).resolves.toMatchObject({ kind: 'signed-in', created: true });
  });

  it('sends the Google token, and nothing else, when there is no profile yet', async () => {
    fetchMock.mockResolvedValue(json(200, { access_token: 'a', refresh_token: 'r', token_type: 'bearer' }));
    await googleAuth('google-id-token');
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/v1/user/auth/google');
    expect(bodyOfCall()).toEqual({ id_token: 'google-id-token' });
  });

  it('sends the referral code with the token, marking one that came from a link', async () => {
    fetchMock.mockResolvedValue(json(200, { access_token: 'a', refresh_token: 'r', token_type: 'bearer' }));
    await googleAuth('google-id-token', profile, { code: 'MGE-A7K92', fromLink: true });
    expect(bodyOfCall()).toMatchObject({ id_token: 'google-id-token', referral_code: 'MGE-A7K92', referral_source: 'link' });
  });

  it('leaves out referral_source for a code that was typed, and the whole pair when there is no code', async () => {
    fetchMock.mockImplementation(async () => json(200, { access_token: 'a', refresh_token: 'r', token_type: 'bearer' }));
    await googleAuth('t', profile, { code: 'MGE-A7K92', fromLink: false });
    expect(bodyOfCall()).not.toHaveProperty('referral_source');
    await googleAuth('t', profile, { code: '', fromLink: true });
    expect(bodyOfCall(1)).not.toHaveProperty('referral_code');
  });

  it('reports whether the code linked, and why not when it did not — the person is signed in either way', async () => {
    fetchMock.mockResolvedValueOnce(
      json(200, { access_token: 'a', refresh_token: 'r', token_type: 'bearer', is_new_user: true, referral_applied: true, referral_message: 'Referral code applied' }),
    );
    await expect(googleAuth('t', profile, { code: 'MGE-A7K92', fromLink: true })).resolves.toMatchObject({
      referralApplied: true,
      referralMessage: 'Referral code applied',
    });
    fetchMock.mockResolvedValueOnce(
      json(200, { access_token: 'a', refresh_token: 'r', token_type: 'bearer', referral_applied: false, referral_message: 'Referral code not found' }),
    );
    await expect(googleAuth('t', profile, { code: 'BAD', fromLink: false })).resolves.toMatchObject({
      kind: 'signed-in',
      referralApplied: false,
      referralMessage: 'Referral code not found',
    });
  });

  it('asks for the missing details when Google is fine but there is no account, and signs nobody in', async () => {
    fetchMock.mockResolvedValue(json(200, { needs_profile: true, email: 'new@gmail.com', name: 'New Person' }));
    await expect(googleAuth('google-id-token')).resolves.toEqual({ kind: 'needs-profile', email: 'new@gmail.com', name: 'New Person' });
    expect(getUserToken()).toBeNull();
  });

  it('sends the sign-up details along with the token to make the account', async () => {
    fetchMock.mockResolvedValue(json(200, { access_token: 'a2', refresh_token: 'r2', token_type: 'bearer' }));
    await googleAuth('google-id-token', profile);
    expect(bodyOfCall()).toEqual({ id_token: 'google-id-token', profile });
    expect(getUserToken()).toBe('a2');
  });

  it('passes the server message up when it refuses the token', async () => {
    fetchMock.mockResolvedValue(json(401, { success: false, error_code: 'UNAUTHORIZED', message: 'Invalid Google token' }));
    await expect(googleAuth('bad-token')).rejects.toThrow('Invalid Google token');
    expect(getUserToken()).toBeNull();
  });

  it('refuses an answer that is neither tokens nor a request for details, rather than guessing', async () => {
    fetchMock.mockResolvedValue(json(200, { something: 'else' }));
    await expect(googleAuth('google-id-token')).rejects.toThrow('did not complete');
    expect(getUserToken()).toBeNull();
  });
});

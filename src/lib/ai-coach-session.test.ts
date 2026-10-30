import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { aiCoachShownKey, resetAiCoachShown } from '@/lib/ai-coach-session';
import { getUserToken, setUserTokens } from '@/lib/api';
import { loginUser, logoutUser } from '@/lib/userAuthApi';

/** The browser's storage, stood in for by a map (as the other API tests do). */
function memoryStorage() {
  const store = new Map<string, string>();
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    key: (i: number) => [...store.keys()][i] ?? null,
    get length() {
      return store.size;
    },
  };
}

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } });
const shown = (exam = 'group-4', stage = 'group-4-written') => sessionStorage.getItem(aiCoachShownKey(exam, stage));
const markShown = (exam = 'group-4', stage = 'group-4-written') => sessionStorage.setItem(aiCoachShownKey(exam, stage), '1');

beforeEach(() => {
  vi.stubGlobal('sessionStorage', memoryStorage());
  vi.stubGlobal('localStorage', memoryStorage());
  vi.stubGlobal('window', { location: { href: '' } });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('whether the AI coach popup was shown this session', () => {
  it('keeps a flag per exam and stage', () => {
    expect(aiCoachShownKey('group-4', 'group-4-written')).toBe('mge:ai-coach-shown:group-4:group-4-written');
    expect(aiCoachShownKey('group-2', 'group-2-prelims')).not.toBe(aiCoachShownKey('group-4', 'group-4-written'));
  });

  it('forgets every exam it was shown for, and leaves other storage alone', () => {
    markShown('group-4', 'group-4-written');
    markShown('group-2', 'group-2-prelims');
    sessionStorage.setItem('mge:ask-referral', '1');
    resetAiCoachShown();
    expect(shown('group-4', 'group-4-written')).toBeNull();
    expect(shown('group-2', 'group-2-prelims')).toBeNull();
    expect(sessionStorage.getItem('mge:ask-referral')).toBe('1');
  });
});

describe('signing in and out starts it afresh', () => {
  it('a new sign-in shows the popup again', async () => {
    markShown();
    vi.stubGlobal('fetch', vi.fn(async () => json({ access_token: 'a', refresh_token: 'r' })));
    await loginUser({ email_address: 'a@b.c', password: 'x' } as never);
    expect(getUserToken()).toBe('a');
    expect(shown()).toBeNull();
  });

  it('a sign-in that gives no tokens (a wrong password, say) changes nothing', async () => {
    markShown();
    vi.stubGlobal('fetch', vi.fn(async () => json({ message: 'check your details' })));
    await loginUser({ email_address: 'a@b.c', password: 'x' } as never);
    expect(getUserToken()).toBeNull();
    expect(shown()).toBe('1');
  });

  it('signing out forgets it too, so the next person on this tab is shown it', async () => {
    setUserTokens('t', 'r');
    markShown();
    vi.stubGlobal('fetch', vi.fn(async () => json({ message: 'ok' })));
    await logoutUser();
    expect(getUserToken()).toBeNull();
    expect(shown()).toBeNull();
  });
});

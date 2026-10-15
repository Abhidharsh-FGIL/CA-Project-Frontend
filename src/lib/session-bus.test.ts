import { afterEach, describe, expect, it, vi } from 'vitest';
import { announceSessionExpired, onSessionExpired, rearmSessionExpired } from '@/lib/session-bus';

const unsubscribers: Array<() => void> = [];
const listen = (fn: (portal: 'user' | 'admin') => void) => {
  const off = onSessionExpired(fn);
  unsubscribers.push(off);
  return off;
};

afterEach(() => {
  unsubscribers.splice(0).forEach(off => off());
  rearmSessionExpired('user');
  rearmSessionExpired('admin');
});

describe('announceSessionExpired', () => {
  it('says nobody took it when nobody is listening, so the caller can redirect', () => {
    expect(announceSessionExpired('user')).toBe(false);
  });

  it('tells every listener which portal lapsed', () => {
    const a = vi.fn();
    const b = vi.fn();
    listen(a);
    listen(b);
    expect(announceSessionExpired('user')).toBe(true);
    expect(a).toHaveBeenCalledWith('user');
    expect(b).toHaveBeenCalledWith('user');
  });

  it('announces a burst of refusals once, and still reports them taken', () => {
    const fn = vi.fn();
    listen(fn);
    expect(announceSessionExpired('user')).toBe(true);
    expect(announceSessionExpired('user')).toBe(true);
    expect(announceSessionExpired('user')).toBe(true);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('keeps the two portals apart', () => {
    const fn = vi.fn();
    listen(fn);
    announceSessionExpired('user');
    announceSessionExpired('admin');
    expect(fn.mock.calls).toEqual([['user'], ['admin']]);
  });

  it('announces again after a new session has begun', () => {
    const fn = vi.fn();
    listen(fn);
    announceSessionExpired('user');
    rearmSessionExpired('user');
    announceSessionExpired('user');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('stops telling a listener that has gone', () => {
    const fn = vi.fn();
    const off = listen(fn);
    off();
    expect(announceSessionExpired('user')).toBe(false);
    expect(fn).not.toHaveBeenCalled();
  });
});

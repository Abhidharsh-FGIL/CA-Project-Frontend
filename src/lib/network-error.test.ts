import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  NETWORK_ERROR_CODE,
  NETWORK_ERROR_MESSAGE,
  NetworkError,
  fetchOrExplain,
  isNetworkFailure,
  isServerFault,
} from '@/lib/network-error';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('isNetworkFailure', () => {
  it('is what every browser rejects fetch with, whatever it says', () => {
    for (const wording of ['Load failed', 'Failed to fetch', 'NetworkError when attempting to fetch resource.', 'ਨੈੱਟਵਰਕ']) {
      expect(isNetworkFailure(new TypeError(wording)), wording).toBe(true);
    }
  });

  it('is not an aborted request — the caller cancelled that', () => {
    expect(isNetworkFailure(new DOMException('The operation was aborted.', 'AbortError'))).toBe(false);
  });

  it('is not an ordinary error', () => {
    expect(isNetworkFailure(new Error('Load failed'))).toBe(false);
    expect(isNetworkFailure('Load failed')).toBe(false);
    expect(isNetworkFailure(undefined)).toBe(false);
  });
});

describe('isServerFault', () => {
  it('is a server that failed to answer, not one that said no', () => {
    expect([500, 502, 503, 504].every(isServerFault)).toBe(true);
    expect([200, 204, 400, 401, 403, 404, 422, 429].some(isServerFault)).toBe(false);
  });
});

describe('NetworkError', () => {
  it('carries the message a person can act on, and a code to branch on', () => {
    const error = new NetworkError(new TypeError('Load failed'));
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe(NETWORK_ERROR_MESSAGE);
    expect(error.code).toBe(NETWORK_ERROR_CODE);
    expect(error.status).toBe(0);
  });

  it('never shows the browser\'s wording', () => {
    expect(NETWORK_ERROR_MESSAGE).not.toMatch(/load failed|failed to fetch|networkerror/i);
  });

  it('keeps what the browser said for whoever is debugging', () => {
    const cause = new TypeError('Load failed');
    expect((new NetworkError(cause) as { cause?: unknown }).cause).toBe(cause);
  });
});

describe('fetchOrExplain', () => {
  it('hands back the response when there is one, whatever its status', async () => {
    const response = new Response('{}', { status: 500 });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
    await expect(fetchOrExplain('https://x.test/a')).resolves.toBe(response);
  });

  it('explains a request that got no reply', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Load failed')));
    const error = await fetchOrExplain('https://x.test/a').catch(e => e);
    expect(error).toBeInstanceOf(NetworkError);
    expect(error.message).toBe(NETWORK_ERROR_MESSAGE);
  });

  it('lets an abort through as it was', async () => {
    const abort = new DOMException('The operation was aborted.', 'AbortError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abort));
    await expect(fetchOrExplain('https://x.test/a')).rejects.toBe(abort);
  });

  it('passes the request on unchanged', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);
    const init = { method: 'POST', body: '{"a":1}' };
    await fetchOrExplain('https://x.test/a', init);
    expect(fetchMock).toHaveBeenCalledWith('https://x.test/a', init);
  });
});

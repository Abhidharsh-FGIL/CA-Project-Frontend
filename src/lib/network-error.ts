/**
 * When a request gets no usable reply.
 *
 * A browser says so with its own words, and they are no help to the person reading them: Safari's
 * "Load failed", Chrome's "Failed to fetch", Firefox's "NetworkError when attempting to fetch
 * resource" — localised, too. All three are a `TypeError` from `fetch`, so that is what is caught,
 * rather than any of the wordings.
 *
 * It is not always the person's connection. A server that crashes answers without the headers the
 * browser needs and the browser throws that answer away, which reads exactly like being offline —
 * so the message does not claim to know which it was.
 */

export const NETWORK_ERROR_MESSAGE = "Couldn't reach the server. Please check your connection and try again.";
export const NETWORK_ERROR_CODE = 'NETWORK_ERROR';

/** The error a caller sees in place of the browser's own. `code` lets a caller branch on it. */
export class NetworkError extends Error {
  readonly code = NETWORK_ERROR_CODE;
  readonly status = 0;
  readonly handled = false;
  constructor(cause?: unknown) {
    super(NETWORK_ERROR_MESSAGE);
    this.name = 'NetworkError';
    if (cause !== undefined) (this as { cause?: unknown }).cause = cause;
  }
}

/**
 * Whether `error` is what `fetch` rejects with when no reply arrived.
 *
 * An aborted request is a `DOMException`, not a `TypeError`, and is deliberately not this: the
 * caller cancelled it, and nobody needs telling the server could not be reached.
 */
export function isNetworkFailure(error: unknown): boolean {
  return error instanceof TypeError;
}

/**
 * Whether a status says the server failed to answer properly (500, 502, 503, 504…), as opposed to
 * answering "no" — which is a decision the caller should read.
 */
export function isServerFault(status: number): boolean {
  return status >= 500;
}

/**
 * `fetch`, except that "no usable reply" arrives as a `NetworkError` with a message a person can
 * act on. Every other failure — an abort, a bad argument — passes through untouched.
 */
export async function fetchOrExplain(input: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch (error) {
    throw isNetworkFailure(error) ? new NetworkError(error) : error;
  }
}

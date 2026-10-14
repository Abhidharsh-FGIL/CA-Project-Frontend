/**
 * Razorpay Standard Checkout, wrapped as a promise.
 *
 * Checkout is a script from Razorpay's own domain that opens a modal and reports
 * back through callbacks. This turns that into something awaitable, with three
 * outcomes that a caller needs to tell apart — paid, walked away, and failed —
 * because they call for three different messages.
 *
 * Nothing here ever sees a secret. The key *id* it uses is public by design and is
 * handed over by the server with each order (`CreateOrderResponse.key_id`); the key
 * *secret* signs orders and verifies payments and exists only on the backend.
 */

const SCRIPT_SRC = 'https://checkout.razorpay.com/v1/checkout.js';

/** What Razorpay hands back after a successful payment. */
export interface RazorpaySuccess {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface CheckoutOptions {
  key: string;
  /** In the smallest currency unit — paise for INR. */
  amount: number;
  currency: string;
  order_id: string;
  name: string;
  description: string;
  prefill?: { name?: string; email?: string; contact?: string };
  theme?: { color: string };
}

/** The customer closed the window without paying. Not an error. */
export class CheckoutDismissed extends Error {
  constructor() {
    super('Checkout was closed before payment.');
    this.name = 'CheckoutDismissed';
  }
}

/** Razorpay reported a failed payment and the customer did not recover from it. */
export class PaymentFailed extends Error {
  constructor(
    message: string,
    readonly reason?: string,
  ) {
    super(message);
    this.name = 'PaymentFailed';
  }
}

/** The checkout script could not be loaded — an ad-blocker or no network. */
export class CheckoutUnavailable extends Error {
  constructor() {
    super('The payment window could not be loaded. Check your connection or any ad-blocker and try again.');
    this.name = 'CheckoutUnavailable';
  }
}

interface RazorpayInstance {
  open(): void;
  on(event: 'payment.failed', cb: (r: { error?: { description?: string; reason?: string } }) => void): void;
}
type RazorpayCtor = new (opts: Record<string, unknown>) => RazorpayInstance;

declare global {
  interface Window {
    Razorpay?: RazorpayCtor;
  }
}

let loading: Promise<void> | null = null;

/**
 * Load the checkout script once.
 *
 * Memoised so opening checkout twice does not inject two scripts, and cleared on
 * failure so a retry after the network comes back actually retries rather than
 * returning the same rejected promise forever.
 */
export function loadRazorpay(): Promise<void> {
  if (typeof window !== 'undefined' && window.Razorpay) return Promise.resolve();
  if (loading) return loading;

  loading = new Promise<void>((resolve, reject) => {
    const el = document.createElement('script');
    el.src = SCRIPT_SRC;
    el.async = true;
    el.onload = () => (window.Razorpay ? resolve() : reject(new CheckoutUnavailable()));
    el.onerror = () => {
      el.remove();
      reject(new CheckoutUnavailable());
    };
    document.head.appendChild(el);
  }).catch(err => {
    loading = null;
    throw err;
  });

  return loading;
}

/**
 * Open the checkout window and wait for how it ends.
 *
 * Razorpay lets a customer retry inside the same window after a failure, so a
 * `payment.failed` event is *not* the end: it is remembered, and only reported if
 * the window then closes without a payment going through. Rejecting on the first
 * failure would tell someone their payment failed a moment before they succeed.
 */
export async function openCheckout(options: CheckoutOptions): Promise<RazorpaySuccess> {
  await loadRazorpay();
  const Razorpay = window.Razorpay;
  if (!Razorpay) throw new CheckoutUnavailable();

  return new Promise<RazorpaySuccess>((resolve, reject) => {
    let lastFailure: { description?: string; reason?: string } | null = null;
    let settled = false;

    const rzp = new Razorpay({
      ...options,
      handler: (response: RazorpaySuccess) => {
        settled = true;
        resolve(response);
      },
      modal: {
        // Ask before closing, so a stray click does not abandon a payment in flight.
        confirm_close: true,
        ondismiss: () => {
          if (settled) return;
          settled = true;
          if (lastFailure) {
            reject(
              new PaymentFailed(
                lastFailure.description || 'The payment did not go through.',
                lastFailure.reason,
              ),
            );
          } else {
            reject(new CheckoutDismissed());
          }
        },
      },
    });

    rzp.on('payment.failed', response => {
      lastFailure = response?.error ?? { description: 'The payment did not go through.' };
    });

    rzp.open();
  });
}

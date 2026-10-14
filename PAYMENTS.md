# Payments — Razorpay

Buying a plan goes through Razorpay Standard Checkout. The backend owns the money;
the frontend opens the payment window and hands back what Razorpay returns.

```
 Browser                          Backend                          Razorpay
    │  POST /user/payment/order      │                                 │
    │  {plan_id, billing, promo}  →  │  price it, apply promo,         │
    │                                │  create an order            →   │
    │  ←  {key_id, order_id,         │                                 │
    │      amount (paise), …}        │                                 │
    │                                                                  │
    │  open checkout with that order ─────────────────────────────→    │
    │  ←  {order_id, payment_id, signature} ───────────────────────    │
    │                                                                  │
    │  POST /user/payment/verify     │  check the signature with       │
    │  {the three values}         →  │  the SECRET, activate the plan  │
    │  ←  {status, invoice_no, …}    │                                 │
    │                                │  ←── webhook: order.paid ───────│
```

The **webhook is a second path to the same result**, not a duplicate. If the browser
closes or loses signal after paying, the webhook still activates the plan, which is
why `verify` can answer `already_processed`.

## What goes where

| | Where | Why |
|---|---|---|
| **Key id** (`rzp_test_…`) | Backend config. Returned to the browser in each order as `key_id`. | Public by design — it only identifies the account. The frontend takes it from the order and never hardcodes one, so switching test → live is a server change only. |
| **Key secret** | Backend only. **Never** in the frontend, a repo, or a chat. | It signs orders and verifies payments. Anyone holding it can mark payments as paid. |
| **Webhook secret** | Backend only. | Authenticates Razorpay's callbacks. |

You pasted a key id, which is safe. If you have the matching secret, it goes in the
backend environment alongside it — not here.

## What the backend must have configured

1. **Key id and key secret** for the test account, in the server environment.
2. **Webhook** added in the Razorpay dashboard (Settings → Webhooks), pointing at
   `…/api/v1/webhooks/razorpay`, subscribed to `order.paid`, `payment.captured` and
   `payment.failed`, with its secret set on the server.

**Until both are set the order endpoint answers 200 with an empty `key_id` and
`order_id`** (those are the schema's defaults). The portal detects that and says
*"Online payments are not set up on the server yet. Nothing was charged."* rather than
opening a broken payment window — so if you see that message, it is configuration, not
a bug in the flow.

## How a purchase can end, and what the customer is told

| Outcome | Cause | Message |
|---|---|---|
| **Paid** | Verified | "Payment successful — Standard is active until 8 Nov 2026. Invoice INV-…" |
| **Free** | Nothing owed (free plan, 100% promo); server already activated | "Standard activated." |
| **Cancelled** | Closed the window | "Payment cancelled — you have not been charged." Checkout stays open to retry. |
| **Failed** | Declined, or the order was refused | The reason, and "You have not been charged." |
| **Unconfirmed** | Paid, but `verify` could not complete and the webhook has not landed yet | "Your payment went through, but we could not confirm your plan yet. **Please do not pay again** — …" with the payment id |

**Unconfirmed is the one that matters.** Telling that customer "payment failed" invites
a second payment. Before giving up, the portal looks up the current subscription up to
three times, and counts it as theirs only if its `payment_ref` is *this* payment or
order — a renewal customer already has an active plan from an earlier payment, and
treating that as confirmation would be wrong.

## Things the frontend deliberately does not do

- **Never computes a price it then charges.** The amount sent to Razorpay is the
  order's `amount`, in paise, from the server. The price on screen and the promo
  preview are previews.
- **Does not open checkout when plans did not load.** The offline fallback has no plan
  ids on purpose; Pay is disabled and says why.
- **Does not record a guessed payment method.** Razorpay's callback does not say which
  instrument was used, so the local history shows "online" rather than inventing one.

## Testing in test mode

With test keys no real money moves. Razorpay's published test instruments (check their
current docs, they change): UPI id `success@razorpay` succeeds and `failure@razorpay`
fails; cards need any future expiry and CVV, with the OTP step accepting any value in
test mode. Try all five outcomes above — especially **close the window** and **fail
once, then succeed in the same window**, which Razorpay allows and which the portal
handles by reporting a failure only if the window then closes unpaid.

## Not covered

- **Switching to a cheaper plan or to Free** still calls a local-only `upgradeSubscription`
  that changes the tier in the browser and tells the server nothing. Paid purchases are
  real; downgrades are not yet.
- **Refunds** are admin-side (`POST /admin/payments/{txn_id}/refund`) and have no
  customer-facing screen.
- **The payment history page** is the session's local record, not the server's. The
  server has no user-facing payments list in its API.

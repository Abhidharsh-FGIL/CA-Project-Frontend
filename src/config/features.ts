/**
 * Product features that are deliberately switched off.
 *
 * A flag rather than deleted code: these surfaces are "not needed as of now",
 * not wrong. Deleting them would mean rebuilding the subscription page, the
 * payment history, the plan badges and every upgrade call-to-action from
 * scratch when they are wanted again; a flag means flipping one line.
 */

/**
 * Plans, subscriptions, payments and every upgrade prompt in the aspirant
 * portal.
 *
 * While false:
 *   - the header's Upgrade button, the plan label under the user's name, and
 *     the Free Plan card in the mobile drawer do not render;
 *   - Subscription and Payment History leave the account menu, and their
 *     routes redirect to the dashboard so a bookmarked or typed URL cannot
 *     reach them either;
 *   - the dashboard's upgrade promo and the profile's plan badge are hidden;
 *   - a test the backend still reports as locked shows a plain "Locked" chip
 *     instead of an Upgrade link, and test prices are not shown — a lock that
 *     advertises a way to unlock it, with the way to unlock it hidden, is
 *     worse than either.
 *
 * Nothing about what a user can actually attempt changes: tier gating lives on
 * the backend, and this flag does not touch it.
 */
export const BILLING_ENABLED = false;

/**
 * A way for the code that starts a test to ask for the plan popup without owning it.
 *
 * The popup needs the signed-in person's plan and the router, so it lives inside the user portal
 * (`PlanNoticeHost`). The API layer, the pages and the query client's error handler are outside of
 * that and only know that a call failed — they hand the error here, and get back whether a popup took
 * it. When none did (the admin side, a test, nobody listening) the caller shows its usual toast.
 */
import { planErrorFacts, type PlanErrorFacts } from '@/lib/plan-notice';

type Listener = (facts: PlanErrorFacts) => void;

const listeners = new Set<Listener>();

/** Subscribe the popup. Returns the unsubscribe. */
export function onPlanNotice(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Show the popup for facts a screen already has — a row that knows its attempts are spent. False when none is listening. */
export function showPlanNotice(facts: PlanErrorFacts): boolean {
  if (listeners.size === 0) return false;
  listeners.forEach(listener => listener(facts));
  return true;
}

/**
 * Show the plan popup for this error. True when it was a plan refusal (or spent attempts) and a
 * popup took it — the caller then shows no toast of its own.
 */
export function announcePlanNotice(error: unknown): boolean {
  const facts = planErrorFacts(error);
  return facts ? showPlanNotice(facts) : false;
}

/**
 * Run a call that may be refused by the plan. A refusal opens the popup and is rethrown marked
 * `handled`, so a catch that would toast `error.message` can tell it already has been told.
 */
export async function withPlanNotice<T>(call: Promise<T>): Promise<T> {
  try {
    return await call;
  } catch (error) {
    if (announcePlanNotice(error) && typeof error === 'object' && error !== null) {
      (error as { handled?: boolean }).handled = true;
    }
    throw error;
  }
}

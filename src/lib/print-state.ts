/**
 * Whether the page is being printed (saved as a PDF) right now.
 *
 * A report folds things away on screen - a subject's units, say - that a printed copy should show open. The
 * pieces that fold read this, and open themselves while it is true. It follows the browser's own `beforeprint` /
 * `afterprint`, so it works for the "Download report" button and for Ctrl+P alike.
 */
import { useSyncExternalStore } from 'react';

let printing = false;
const listeners = new Set<() => void>();
let wired = false;

function set(next: boolean) {
  if (printing === next) return;
  printing = next;
  listeners.forEach(l => l());
}

function wire() {
  if (wired || typeof window === 'undefined') return;
  wired = true;
  window.addEventListener('beforeprint', () => set(true));
  window.addEventListener('afterprint', () => set(false));
}

function subscribe(listener: () => void) {
  wire();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** True while the page is being printed. */
export function usePrinting(): boolean {
  return useSyncExternalStore(subscribe, () => printing, () => false);
}

/** Back to the normal, folded page. */
export function endPrinting(): void {
  set(false);
}

/** Mark printing on, before the browser asks for it, and wait for the page to draw the open version. */
export async function beginPrinting(): Promise<void> {
  wire();
  set(true);
  // Two frames: the first to render the change, the second to be sure it has been painted.
  await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
}

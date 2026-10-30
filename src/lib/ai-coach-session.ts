/**
 * Whether the AI coach's popup has already opened in this browser session.
 *
 * It opens once when the dashboard first has picks to show, then not again however often the aspirant comes back
 * to the dashboard. A new sign-in is a new start — logging out and in again, in the same tab, shows it again — so
 * signing in (or out) forgets what was shown.
 */
const PREFIX = 'mge:ai-coach-shown:';

export const aiCoachShownKey = (exam: string, stage: string) => `${PREFIX}${exam}:${stage}`;

/** Forget that the popup was shown, for every exam. Storage can be blocked; then there is nothing to forget. */
export function resetAiCoachShown(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i += 1) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach(k => sessionStorage.removeItem(k));
  } catch {
    /* private window or blocked storage */
  }
}

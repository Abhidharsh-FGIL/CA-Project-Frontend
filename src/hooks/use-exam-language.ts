import { useUserPortal } from '@/contexts/UserPortalContext';
import { examLanguageOf, type ExamLanguage } from '@/lib/exam-language';

/**
 * The language paper the signed-in aspirant sits — General Tamil or General English — or null when
 * they have not said (an account from before the question, or one that answered another language).
 * Null means show everything, as the portal always did.
 */
export function useExamLanguage(): ExamLanguage | null {
  const { user } = useUserPortal();
  return examLanguageOf(user?.medium);
}

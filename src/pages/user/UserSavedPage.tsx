import { Link } from 'react-router-dom';
import { BookMarked, NotebookPen } from 'lucide-react';
import { UserShell } from '@/components/user/UserShell';
import { useT } from '@/content/useText';

/**
 * Bookmarks and Notes.
 *
 * Both are in the nav because the design calls for them, but neither has a
 * backend yet — there is no endpoint to store a bookmarked question or a note
 * against one. The empty state says so plainly rather than pretending the
 * feature works and silently losing what the aspirant saves.
 * See TNPSC_DASHBOARD_API.md §4.
 */
export default function UserSavedPage({ kind }: { kind: 'bookmarks' | 'notes' }) {
  const isBookmarks = kind === 'bookmarks';
  const t = useT();

  return (
    <UserShell>
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
        {isBookmarks ? t('exams.saved.bookmarks.title') : t('exams.saved.notes.title')}
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-6">
        {isBookmarks ? t('exams.saved.bookmarks.text') : t('exams.saved.notes.text')}
      </p>

      <div className="rounded-2xl border border-dashed border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 py-16 px-6 text-center">
        <span className="inline-flex w-12 h-12 rounded-2xl bg-gray-50 dark:bg-gray-800 items-center justify-center mb-3">
          {isBookmarks ? (
            <BookMarked className="w-5 h-5 text-gray-400" />
          ) : (
            <NotebookPen className="w-5 h-5 text-gray-400" />
          )}
        </span>
        <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">
          {t('exams.saved.empty')}
        </p>
        <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
          {isBookmarks ? t('exams.saved.bookmarks.note') : t('exams.saved.notes.note')}
        </p>
        <Link
          to="/user/exams"
          className="inline-block mt-4 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline"
        >
          {t('exams.saved.link')}
        </Link>
      </div>
    </UserShell>
  );
}

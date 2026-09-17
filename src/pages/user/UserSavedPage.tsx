import { Link } from 'react-router-dom';
import { BookMarked, NotebookPen } from 'lucide-react';
import { UserShell } from '@/components/user/UserShell';

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

  return (
    <UserShell>
      <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100">
        {isBookmarks ? 'Bookmarks' : 'Notes'}
      </h1>
      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 mb-6">
        {isBookmarks
          ? 'Questions and topics you save while practising will collect here.'
          : 'Your own notes against questions and topics will collect here.'}
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
          Nothing saved yet
        </p>
        <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
          {isBookmarks
            ? 'Saving is not switched on yet — it needs the bookmarks endpoint. Once it is live, the bookmark control appears while you take a test and in your reports.'
            : 'Notes are not switched on yet — they need the notes endpoint. Once live, you can write against any question from its report.'}
        </p>
        <Link
          to="/user/exams"
          className="inline-block mt-4 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
        >
          Go to Exams
        </Link>
      </div>
    </UserShell>
  );
}

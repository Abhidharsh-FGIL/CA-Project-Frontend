import { Link } from 'react-router-dom';
import { UserShell } from '@/components/user/UserShell';
import { useUserPortal } from '@/contexts/UserPortalContext';
import { ChevronRight, Layers, FileText } from 'lucide-react';

export default function CourseListPage() {
  const { courses } = useUserPortal();
  const totalTests = courses.reduce((sum, c) => sum + (c.total_tests ?? 0), 0);

  return (
    <UserShell>
      {/* Hero header */}
      <div className="mb-6 animate-fadeIn">
        <div className="relative overflow-hidden rounded-2xl border border-indigo-100 dark:border-indigo-900 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 dark:from-indigo-950/50 dark:via-purple-950/50 dark:to-pink-950/50 bg-[length:200%_auto] animate-gradient-x p-5 sm:p-6">
          <div className="absolute -top-16 -right-16 w-48 h-48 bg-purple-300/30 dark:bg-purple-700/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-indigo-300/30 dark:bg-indigo-700/20 rounded-full blur-3xl pointer-events-none" />
          <div className="relative flex items-end justify-between gap-3 flex-wrap">
            <div>
              <p className="text-[10px] uppercase tracking-[0.25em] text-indigo-700 dark:text-indigo-300 font-bold mb-2">
                Your Library
              </p>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">
                Your <span className="gradient-text-animated">Courses</span>
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1.5">
                {courses.length} CA & accounting course{courses.length !== 1 ? 's' : ''} available · {totalTests} test{totalTests !== 1 ? 's' : ''} ready to take.
              </p>
            </div>
            <div className="flex gap-2.5 flex-wrap">
              <Pill icon={<Layers className="w-3 h-3" />} label="Courses" value={courses.length} />
              <Pill icon={<FileText className="w-3 h-3" />} label="Tests" value={totalTests} />
            </div>
          </div>
        </div>
      </div>

      {courses.length === 0 ? (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-12 text-center animate-fadeIn">
          <FileText className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-500 dark:text-gray-400">No courses available yet. Check back soon.</p>
        </div>
      ) : (
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {courses.map((c, i) => (
            <Link
              key={c.course_id}
              to={`/user/courses/${c.course_id}`}
              className="group bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden hover:shadow-xl hover:shadow-indigo-100/50 dark:hover:shadow-black/50 hover:border-indigo-200 dark:hover:border-indigo-800 transition-all duration-300 animate-slideUp hover-lift card-shine"
              style={{ animationDelay: `${i * 0.06}s` }}
            >
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-950/40 dark:to-purple-950/40 border-b border-indigo-100 dark:border-indigo-900/40 px-3 py-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-base font-bold text-gray-900 dark:text-gray-100 truncate leading-tight">
                    {c.subject ?? c.name}
                  </p>
                  {c.exam_body && (
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mt-0.5">
                      {c.exam_body}
                    </p>
                  )}
                </div>
              </div>
              <div className="p-4">
                <p className="text-base font-bold text-gray-900 dark:text-gray-100 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {c.name}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">{c.description}</p>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                  <span className="text-[11px] text-gray-500 dark:text-gray-400 font-semibold">
                    {c.total_tests} test{c.total_tests !== 1 ? 's' : ''}
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-400 dark:text-gray-500 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
                </div>
              </div>
            </Link>
        ))}
      </div>
      )}
    </UserShell>
  );
}

function Pill({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: number; accent?: boolean }) {
  return (
    <div
      className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold backdrop-blur transition-all ${
        accent
          ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-sm shadow-emerald-200 dark:shadow-emerald-900/40 animate-bounce-soft'
          : 'bg-white/80 dark:bg-gray-900/60 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
      }`}
    >
      <span className={accent ? 'text-white' : 'text-indigo-600 dark:text-indigo-400'}>{icon}</span>
      <span>
        <span className="tabular-nums font-bold">{value}</span>{' '}
        <span className={accent ? 'opacity-90' : 'text-gray-500 dark:text-gray-400 font-normal uppercase tracking-wider text-[10px]'}>{label}</span>
      </span>
    </div>
  );
}

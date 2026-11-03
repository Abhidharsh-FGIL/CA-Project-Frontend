import { useQuery } from '@tanstack/react-query';
import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Building2, CalendarDays, LogOut, Mail, Phone, Users } from 'lucide-react';
import { InstituteReportView } from '@/components/institute/InstituteReportView';
import { UserHistoryDetail } from '@/pages/org/AdminUserHistoryPage';
import { UserHistoryList } from '@/pages/org/AdminHistoryPage';
import { DASH, formatDate } from '@/lib/admin-history-format';
import { instituteHistory, instituteMe, instituteSession, logoutInstitute } from '@/lib/instituteApi';

/**
 * The institute's own page: who it is, and the students tied to it with their test history. Nothing here reads
 * anyone outside the institute: the server answers only for the institute whose token this is.
 * The student being looked at lives in the address (`?student=…`), so Back returns to the list.
 */
export default function InstitutePortalPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const student = params.get('student');
  const attempt = params.get('attempt');

  const signedIn = instituteSession.signedInTo(slug);
  const { data: institute, isError, error } = useQuery({
    queryKey: ['institute-me', slug],
    queryFn: instituteMe,
    enabled: signedIn,
    staleTime: 60 * 1000,
  });

  // Signed out, blocked, or signed in to a different institute: back to this one's sign-in page.
  if (!signedIn || (isError && [401, 403].includes((error as { status?: number })?.status ?? 0))) {
    return <Navigate to={`/institute/${slug}`} replace />;
  }

  const signOut = async () => {
    await logoutInstitute();
    navigate(`/institute/${slug}`, { replace: true });
  };

  // The app locks the page itself (every screen scrolls inside its own frame), so this one does too.
  return (
    <div className="h-[100dvh] overflow-y-auto overflow-x-hidden bg-gray-50 dark:bg-gray-950">
      <header className="border-b border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="flex w-full items-center justify-between gap-3 px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-orange-500 text-white">
              <Building2 className="h-5 w-5" />
            </span>
            <span className="truncate text-sm font-bold text-gray-900 dark:text-gray-100">{institute?.name ?? 'Institute'}</span>
          </div>
          <button
            type="button"
            onClick={signOut}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </header>

      <main className="w-full space-y-4 px-4 py-5 sm:px-6">
        {student && attempt ? (
          <InstituteReportView attemptId={attempt} onBack={() => setParams({ student })} />
        ) : student ? (
          <UserHistoryDetail
            userId={student}
            source={instituteHistory}
            hidePromos
            onBack={() => setParams({})}
            // Every finished attempt has a report here, not only an assessment one.
            reportable={a => a.status !== 'in_progress'}
            onOpenAttempt={a => setParams({ student, attempt: a.attempt_id })}
          />
        ) : (
          <>
            <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">Institute details</p>
              <h1 className="mt-0.5 text-xl font-bold text-gray-900 dark:text-gray-100">{institute?.name ?? DASH}</h1>
              <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <Detail icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={institute?.email} />
                <Detail icon={<Phone className="h-3.5 w-3.5" />} label="Contact number" value={institute?.contact_number} />
                <Detail icon={<Users className="h-3.5 w-3.5" />} label="Students" value={institute?.student_count?.toLocaleString('en-IN')} />
                <Detail icon={<CalendarDays className="h-3.5 w-3.5" />} label="Member since" value={institute?.created_at ? formatDate(institute.created_at) : undefined} />
              </dl>
            </section>

            <div>
              <h2 className="mb-2 text-sm font-bold text-gray-900 dark:text-gray-100">Your students</h2>
              <UserHistoryList source={instituteHistory} hidePromos showPlan onOpen={u => setParams({ student: u.user_id })} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Detail({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-[11px] font-semibold text-gray-500 dark:text-gray-400">
        {icon}
        {label}
      </dt>
      <dd className="mt-0.5 truncate font-semibold text-gray-900 dark:text-gray-100">{value || DASH}</dd>
    </div>
  );
}

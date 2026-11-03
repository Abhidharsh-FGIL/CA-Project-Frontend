import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Building2, CalendarDays, KeyRound, Mail, Pencil, Phone, Users } from 'lucide-react';
import { GenVerseShell } from '@/components/layout/GenVerseShell';
import { InstituteFormDialog, ResetPasswordDialog } from '@/components/institute/InstituteDialogs';
import { InstituteUrls } from '@/components/institute/InstituteUrls';
import { useAdminInstitute, useAdminInstituteActions } from '@/hooks/use-admin-institutes';
import { adminInstituteHistory } from '@/lib/instituteApi';
import { historyApi } from '@/lib/adminHistoryApi';
import { formatDate, DASH } from '@/lib/admin-history-format';
import { UserHistoryList } from '@/pages/org/AdminHistoryPage';
import { IconButton, StatusSwitch } from '@/pages/org/AdminInstitutesPage';

/** Admin → one institute: who it is, the two addresses to give it, and its students' history. */
export default function AdminInstituteDetailPage() {
  const { instituteId } = useParams<{ instituteId: string }>();
  const navigate = useNavigate();
  const { data: institute, isLoading, isError, error } = useAdminInstitute(instituteId);
  const { update } = useAdminInstituteActions();
  const [editing, setEditing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const source = useMemo(() => adminInstituteHistory(instituteId ?? '', historyApi), [instituteId]);
  const notFound = isError && (error as { status?: number })?.status === 404;

  return (
    <GenVerseShell>
      <div className="space-y-4 pb-6">
        <Link to="/org/institutes" className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200">
          <ArrowLeft className="h-3.5 w-3.5" /> All institutes
        </Link>

        {notFound || isError ? (
          <div className="rounded-2xl border border-gray-100 bg-white py-16 text-center dark:border-gray-800 dark:bg-gray-900">
            <Building2 className="mx-auto mb-3 h-10 w-10 text-gray-300" />
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-200">{notFound ? 'Institute not found' : 'Could not load this institute'}</p>
            {!notFound && <p className="mt-1 text-xs text-gray-500">{(error as Error)?.message}</p>}
          </div>
        ) : isLoading || !institute ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-brand-600 dark:border-blue-900" />
          </div>
        ) : (
          <>
            <section className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex min-w-0 items-center gap-3.5">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl bg-orange-500 text-lg font-bold text-white">
                    {(institute.name || '?')[0].toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h1 className="truncate text-xl font-bold text-gray-900 dark:text-gray-100">{institute.name}</h1>
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
                      <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" aria-hidden />{institute.email}</span>
                      <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" aria-hidden />{institute.contact_number || DASH}</span>
                      <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" aria-hidden />Added {formatDate(institute.created_at)}</span>
                      <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5" aria-hidden />{institute.student_count ?? 0} students</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <StatusSwitch institute={institute} busy={update.isPending} onToggle={() => update.mutate({ id: institute.institute_id, body: { is_active: !institute.is_active } })} />
                  <IconButton label="Edit" onClick={() => setEditing(true)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </IconButton>
                  <IconButton label="Change password" onClick={() => setResetting(true)}>
                    <KeyRound className="h-3.5 w-3.5" />
                  </IconButton>
                </div>
              </div>
              <div className="mt-5 border-t border-gray-100 pt-4 dark:border-gray-800">
                <InstituteUrls slug={institute.slug} />
              </div>
            </section>

            <div>
              <h2 className="mb-2 text-sm font-bold text-gray-900 dark:text-gray-100">Students</h2>
              <UserHistoryList source={source} onOpen={u => navigate(`/org/history/${u.user_id}`)} />
            </div>

            <InstituteFormDialog open={editing} onOpenChange={setEditing} institute={institute} />
            <ResetPasswordDialog institute={resetting ? institute : null} onOpenChange={o => !o && setResetting(false)} />
          </>
        )}
      </div>
    </GenVerseShell>
  );
}

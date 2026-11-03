import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, ChevronLeft, ChevronRight, KeyRound, Loader2, Pencil, Plus, Search } from 'lucide-react';
import { GenVerseShell } from '@/components/layout/GenVerseShell';
import { PageHeader } from '@/components/layout/AppShell';
import { InstituteFormDialog, ResetPasswordDialog } from '@/components/institute/InstituteDialogs';
import { useAdminInstituteActions, useAdminInstitutes } from '@/hooks/use-admin-institutes';
import { instituteLoginUrl, type Institute } from '@/lib/instituteApi';
import { formatDate } from '@/lib/admin-history-format';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 20;

function useDebounced<T>(value: T, ms = 350): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Admin → Institutes: add an institute, give it a sign-in address, and see who it is and how many students it has. */
export default function AdminInstitutesPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const search = useDebounced(query.trim());
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [search]);

  const { data, isLoading, isFetching, isError, error, refetch } = useAdminInstitutes({ search, page, limit: PAGE_SIZE });
  const { update } = useAdminInstituteActions();
  const items = data?.items ?? [];
  const pages = Math.max(1, data?.pages ?? 1);

  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<Institute | null>(null);
  const [resetting, setResetting] = useState<Institute | null>(null);
  const open = (i: Institute) => navigate(`/org/institutes/${i.institute_id}`);

  return (
    <GenVerseShell>
      <PageHeader
        title="Institutes"
        description="Each institute gets its own sign-in page and sees only its own students."
        breadcrumbs={[{ label: 'Dashboard', href: '/org/dashboard' }, { label: 'Institutes' }]}
        actions={
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" /> Add institute
          </button>
        }
      />

      <div className="space-y-4 pb-6">
        <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by name, email or contact number…"
              aria-label="Search institutes"
              className="w-full rounded-lg border border-gray-200 bg-white py-2 pl-9 pr-9 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-300 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
            {isFetching && <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-gray-400" aria-hidden />}
          </div>
          {data && (
            <p className="mt-2 text-[11px] text-gray-500 dark:text-gray-400">
              {data.total.toLocaleString('en-IN')} institute{data.total === 1 ? '' : 's'}
              {search && ` matching “${search}”`}
            </p>
          )}
        </div>

        {isError ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-950/20">
            <p className="text-sm font-semibold text-red-700 dark:text-red-300">Could not load institutes</p>
            <p className="mt-1 text-xs text-red-600/80 dark:text-red-300/70">{(error as Error)?.message}</p>
            <button type="button" onClick={() => refetch()} className="mt-3 text-xs font-semibold text-red-700 underline dark:text-red-300">
              Try again
            </button>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-200 border-t-brand-600 dark:border-blue-900" />
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-gray-100 bg-white py-16 text-center dark:border-gray-800 dark:bg-gray-900">
            <Building2 className="mx-auto mb-3 h-10 w-10 text-gray-300 dark:text-gray-700" />
            <p className="text-sm text-gray-500 dark:text-gray-400">{search ? 'No institutes match your search.' : 'No institutes yet.'}</p>
            {!search && (
              <button type="button" onClick={() => setAdding(true)} className="mt-3 text-sm font-semibold text-brand-600 underline">
                Add the first one
              </button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900 md:block">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b border-gray-100 bg-gray-50 dark:border-gray-800 dark:bg-gray-800/60">
                    <tr className="text-left text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      <th className="px-4 py-3">Institute</th>
                      <th className="px-4 py-3">Contact number</th>
                      <th className="px-4 py-3">Email</th>
                      <th className="px-4 py-3 text-center">Students</th>
                      <th className="px-4 py-3">Added</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map(i => (
                      <tr
                        key={i.institute_id}
                        onClick={() => open(i)}
                        className="cursor-pointer border-b border-gray-50 transition-colors last:border-0 hover:bg-orange-50/40 dark:border-gray-800 dark:hover:bg-gray-800/40"
                      >
                        <td className="px-4 py-3">
                          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{i.name}</p>
                          <p className="max-w-[260px] truncate text-[11px] text-gray-500 dark:text-gray-400">{instituteLoginUrl(i.slug)}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-700 dark:text-gray-200">{i.contact_number || '—'}</td>
                        <td className="max-w-[220px] truncate px-4 py-3 text-xs text-gray-700 dark:text-gray-200">{i.email}</td>
                        <td className="px-4 py-3 text-center text-sm font-bold tabular-nums text-gray-900 dark:text-gray-100">
                          {i.student_count ?? '—'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-700 dark:text-gray-200">{formatDate(i.created_at)}</td>
                        <td className="px-4 py-3">
                          <StatusSwitch institute={i} busy={update.isPending} onToggle={() => update.mutate({ id: i.institute_id, body: { is_active: !i.is_active } })} />
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            <IconButton label="Edit" onClick={() => setEditing(i)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </IconButton>
                            <IconButton label="Change password" onClick={() => setResetting(i)}>
                              <KeyRound className="h-3.5 w-3.5" />
                            </IconButton>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile */}
            <div className="space-y-2.5 md:hidden">
              {items.map(i => (
                <div key={i.institute_id} className="rounded-2xl border border-gray-100 bg-white p-3.5 shadow-sm dark:border-gray-800 dark:bg-gray-900">
                  <button type="button" onClick={() => open(i)} className="flex w-full items-start justify-between gap-2 text-left">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{i.name}</p>
                      <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">{i.email}</p>
                      <p className="text-[11px] text-gray-500 dark:text-gray-400">{i.contact_number}</p>
                    </div>
                    <ChevronRight className="mt-1 h-4 w-4 flex-shrink-0 text-gray-300" />
                  </button>
                  <div className="mt-2.5 flex items-center justify-between">
                    <span className="text-[11px] text-gray-500 dark:text-gray-400">{i.student_count ?? 0} students</span>
                    <div className="flex items-center gap-2">
                      <StatusSwitch institute={i} busy={update.isPending} onToggle={() => update.mutate({ id: i.institute_id, body: { is_active: !i.is_active } })} />
                      <IconButton label="Edit" onClick={() => setEditing(i)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </IconButton>
                      <IconButton label="Change password" onClick={() => setResetting(i)}>
                        <KeyRound className="h-3.5 w-3.5" />
                      </IconButton>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {pages > 1 && (
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] tabular-nums text-gray-500 dark:text-gray-400">
                  Page {data?.page ?? page} of {pages}
                </p>
                <div className="flex items-center gap-1.5">
                  <IconButton label="Previous page" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>
                    <ChevronLeft className="h-4 w-4" />
                  </IconButton>
                  <IconButton label="Next page" disabled={page >= pages} onClick={() => setPage(p => Math.min(pages, p + 1))}>
                    <ChevronRight className="h-4 w-4" />
                  </IconButton>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <InstituteFormDialog open={adding} onOpenChange={setAdding} onSaved={open} />
      <InstituteFormDialog open={!!editing} onOpenChange={o => !o && setEditing(null)} institute={editing} />
      <ResetPasswordDialog institute={resetting} onOpenChange={o => !o && setResetting(null)} />
    </GenVerseShell>
  );
}

export function StatusSwitch({ institute, busy, onToggle }: { institute: Institute; busy?: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={e => {
        e.stopPropagation();
        onToggle();
      }}
      title={institute.is_active ? 'Active: click to block sign-in' : 'Blocked: click to allow sign-in'}
      className={cn(
        'rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset disabled:opacity-60',
        institute.is_active
          ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900'
          : 'bg-gray-100 text-gray-500 ring-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700',
      )}
    >
      {institute.is_active ? 'Active' : 'Blocked'}
    </button>
  );
}

export function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:bg-gray-800"
    >
      {children}
    </button>
  );
}

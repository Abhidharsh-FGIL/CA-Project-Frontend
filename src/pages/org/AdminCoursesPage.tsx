import { useMemo, useState } from 'react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { GenVerseShell } from '@/components/layout/GenVerseShell';
import { PageHeader } from '@/components/layout/AppShell';
import { useInfiniteList } from '@/hooks/use-infinite-list';
import {
  Search,
  Plus,
  Edit2,
  Archive,
  ArchiveRestore,
  Layers,
  Users,
  ClipboardCheck,
  Filter,
  X,
  BookOpen,
  Calendar,
  GraduationCap,
  Trash2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAdminCourses, useAdminCourseActions } from '@/hooks/use-admin-courses';
import { type AdminCourseOut, type CourseStatus } from '@/lib/adminApi';

type AdminCourse = AdminCourseOut;

const STATUS_META: Record<CourseStatus, { label: string; cls: string }> = {
  active: {
    label: 'Active',
    cls: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900',
  },
  draft: {
    label: 'Draft',
    cls: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900',
  },
  archived: {
    label: 'Archived',
    cls: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700',
  },
};

const EXAM_BODIES: string[] = ['ICAI', 'ICMAI', 'ICSI', 'Other'];

export default function AdminCoursesPage() {
  const { data: coursesData, isLoading: coursesLoading } = useAdminCourses(1, 100);
  const courses: AdminCourse[] = coursesData?.items ?? [];
  const { create, update, archive, restore, deleteCourse } = useAdminCourseActions();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CourseStatus | 'all'>('all');
  const [editing, setEditing] = useState<AdminCourse | 'new' | null>(null);
  const [courseToDelete, setCourseToDelete] = useState<AdminCourse | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return courses
      .filter(c => statusFilter === 'all' || c.status === statusFilter)
      .filter(c => !q || c.name.toLowerCase().includes(q) || (c.subject ?? '').toLowerCase().includes(q));
  }, [courses, search, statusFilter]);

  const { visible: visibleCourses, sentinelRef: coursesSentinelRef, hasMore: coursesHasMore, shown: coursesShown, total: coursesTotal } = useInfiniteList<AdminCourse>(filtered, 24);

  const stats = useMemo(() => {
    return {
      active: courses.filter(c => c.status === 'active').length,
      draft: courses.filter(c => c.status === 'draft').length,
      archived: courses.filter(c => c.status === 'archived').length,
      totalEnrolled: courses.reduce((s, c) => s + (c.enrolled_users || 0), 0),
    };
  }, [courses]);

  const handleSave = (course: AdminCourse) => {
    const isNew = !courses.some(c => c.course_id === course.course_id);
    if (isNew) {
      create.mutate({
        name: course.name,
        description: course.description ?? undefined,
        subject: course.subject ?? undefined,
        exam_body: course.exam_body ?? undefined,
        thumbnail_color: course.thumbnail_color ?? undefined,
        status: course.status,
      });
    } else {
      update.mutate({
        courseId: course.course_id,
        payload: {
          name: course.name,
          description: course.description ?? undefined,
          subject: course.subject ?? undefined,
          exam_body: course.exam_body ?? undefined,
          thumbnail_color: course.thumbnail_color ?? undefined,
          status: course.status,
        },
      });
    }
    setEditing(null);
  };

  const handleArchive = (course: AdminCourse) => {
    if (course.status === 'archived') {
      restore.mutate(course.course_id);
    } else {
      archive.mutate(course.course_id);
    }
  };

  const handleDelete = (course: AdminCourse) => {
    setCourseToDelete(course);
  };

  const confirmDelete = () => {
    if (!courseToDelete) return;
    deleteCourse.mutate(courseToDelete.course_id);
    setCourseToDelete(null);
  };

  return (
    <GenVerseShell>
      <PageHeader
        title="Course Management"
        description="Create, edit, and archive courses."
        breadcrumbs={[{ label: 'Dashboard', href: '/org/dashboard' }, { label: 'Courses' }]}
        actions={
          <button
            onClick={() => setEditing('new')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-3 py-2 rounded-lg shadow-md shadow-indigo-200/40 dark:shadow-indigo-950/40 press"
          >
            <Plus className="w-3.5 h-3.5" /> New Course
          </button>
        }
      />

      <div className="space-y-5 pb-6">
        {coursesLoading && (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 border-4 border-indigo-200 dark:border-indigo-900 border-t-indigo-600 dark:border-t-indigo-400 rounded-full animate-spin" />
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatChip icon={<Layers />} label="Active" value={stats.active} tone="emerald" />
          <StatChip icon={<BookOpen />} label="Draft" value={stats.draft} tone="amber" />
          <StatChip icon={<Archive />} label="Archived" value={stats.archived} tone="gray" />
          <StatChip
            icon={<Users />}
            label="Total Enrolled"
            value={stats.totalEnrolled.toLocaleString('en-IN')}
            tone="indigo"
          />
        </div>

        {/* Filters */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4">
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search by name or subject…"
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-700"
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Filter className="w-4 h-4 text-gray-400" />
              <Chip active={statusFilter === 'all'} onClick={() => setStatusFilter('all')}>All</Chip>
              <Chip active={statusFilter === 'active'} onClick={() => setStatusFilter('active')}>Active</Chip>
              <Chip active={statusFilter === 'draft'} onClick={() => setStatusFilter('draft')}>Draft</Chip>
              <Chip active={statusFilter === 'archived'} onClick={() => setStatusFilter('archived')}>Archived</Chip>
            </div>
          </div>
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-12 text-center">
            <BookOpen className="w-10 h-10 text-gray-300 dark:text-gray-700 mx-auto mb-3" />
            <p className="text-sm text-gray-500 dark:text-gray-400">No courses match the filters.</p>
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {visibleCourses.map(course => (
              <CourseCard
                key={course.course_id}
                course={course}
                onEdit={() => setEditing(course)}
                onArchive={() => handleArchive(course)}
                onDelete={() => handleDelete(course)}
              />
            ))}
          </div>
        )}

        {filtered.length > 0 && (
          <>
            <div ref={coursesSentinelRef} className="h-1" />
            <p className="text-center text-xs text-gray-500 dark:text-gray-400 py-2">
              {coursesHasMore ? `Loading more… (${coursesShown} of ${coursesTotal})` : `All ${coursesTotal} courses loaded`}
            </p>
          </>
        )}
      </div>

      {editing && (
        <CourseEditor
          course={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!courseToDelete} onOpenChange={open => !open && setCourseToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Course?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">"{courseToDelete?.name}"</span> will be
              permanently removed. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete Course
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </GenVerseShell>
  );
}

function CourseCard({
  course,
  onEdit,
  onArchive,
  onDelete,
}: {
  course: AdminCourse;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
}) {
  const meta = STATUS_META[course.status];
  return (
    <div
      className={cn(
        'bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden transition-all hover:shadow-lg hover:shadow-indigo-100/40 dark:hover:shadow-indigo-950/40 hover:border-indigo-200 dark:hover:border-indigo-800 hover-lift',
        course.status === 'archived' && 'opacity-75',
      )}
    >
      <div className="p-4">
        {/* Course name + status badge */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100 line-clamp-1 leading-tight">{course.name}</h3>
          <span
            className={cn(
              'inline-flex items-center text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded border flex-shrink-0 mt-0.5',
              meta.cls,
            )}
          >
            {meta.label}
          </span>
        </div>

        {/* Subject + exam body */}
        <p className="text-[11px] text-indigo-600 dark:text-indigo-400 font-semibold mb-1">
          {[course.subject, course.exam_body].filter(Boolean).join(' · ')}
        </p>

        <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-3 leading-relaxed">
          {course.description}
        </p>

        <div className="flex items-center gap-3 text-[11px] text-gray-500 dark:text-gray-400 mb-3">
          <span className="inline-flex items-center gap-1">
            <Users className="w-3 h-3" />
            {(course.enrolled_users || 0).toLocaleString('en-IN')}
          </span>
          <span className="inline-flex items-center gap-1">
            <ClipboardCheck className="w-3 h-3" />
            {course.total_tests || 0} tests
          </span>
          <span className="inline-flex items-center gap-1 ml-auto">
            <Calendar className="w-3 h-3" />
            {new Date(course.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          </span>
        </div>

        <div className="flex items-center gap-1.5 pt-3 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={onEdit}
            className="flex-1 inline-flex items-center justify-center gap-1 text-xs font-semibold bg-gray-50 dark:bg-gray-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40 text-gray-700 dark:text-gray-300 hover:text-indigo-700 dark:hover:text-indigo-300 px-2 py-1.5 rounded-lg transition-colors"
          >
            <Edit2 className="w-3 h-3" /> Edit
          </button>
          <button
            onClick={onArchive}
            className="flex-1 inline-flex items-center justify-center gap-1 text-xs font-semibold bg-gray-50 dark:bg-gray-800 hover:bg-amber-50 dark:hover:bg-amber-950/40 text-gray-700 dark:text-gray-300 hover:text-amber-700 dark:hover:text-amber-300 px-2 py-1.5 rounded-lg transition-colors"
          >
            {course.status === 'archived' ? (
              <>
                <ArchiveRestore className="w-3 h-3" /> Restore
              </>
            ) : (
              <>
                <Archive className="w-3 h-3" /> Archive
              </>
            )}
          </button>
          <button
            onClick={onDelete}
            className="inline-flex items-center justify-center gap-1 text-xs font-semibold bg-gray-50 dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-950/40 text-gray-400 hover:text-red-600 dark:hover:text-red-400 px-2 py-1.5 rounded-lg transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}

function CourseEditor({
  course,
  onClose,
  onSave,
}: {
  course: AdminCourse | null;
  onClose: () => void;
  onSave: (c: AdminCourse) => void;
}) {
  const isNew = !course;
  const [form, setForm] = useState<AdminCourse>(
    course || {
      course_id: `crs_${Date.now().toString(36)}`,
      name: '',
      description: '',
      subject: '',
      status: 'draft',
      created_by: null,
      created_at: new Date().toISOString(),
      updated_at: null,
      is_active: true,
      enrolled_users: 0,
      total_tests: 0,
      thumbnail_color: 'from-indigo-500 to-purple-500',
      exam_body: 'ICAI',
    },
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !(form.subject ?? '').trim() || !(form.description ?? '').trim()) {
      toast.error('Name, subject, and description are required');
      return;
    }
    onSave(form);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-xl bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden animate-scaleIn max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="relative p-4 bg-gradient-to-br from-indigo-500 to-purple-500 text-white bg-[length:200%_auto] animate-gradient-x">
          <div className="absolute inset-0 bg-soft-dots opacity-15" />
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-7 h-7 rounded-full bg-white/15 hover:bg-white/25 backdrop-blur flex items-center justify-center"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="relative">
            <p className="text-[10px] uppercase tracking-[0.25em] font-bold opacity-90">
              {isNew ? 'New Course' : 'Edit Course'}
            </p>
            <h2 className="text-lg font-bold mt-0.5 inline-flex items-center gap-2">
              <GraduationCap className="w-5 h-5" />
              {form.name || 'Untitled Course'}
            </h2>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <FormField label="Course Name *">
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              maxLength={200}
              placeholder="e.g. CA Foundation"
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-700"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Subject *">
              <input
                type="text"
                value={form.subject ?? ''}
                onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                placeholder="e.g. Accounting"
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-700"
              />
            </FormField>
            <FormField label="Exam Body">
              <select
                value={form.exam_body || 'ICAI'}
                onChange={e => setForm(f => ({ ...f, exam_body: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-700"
              >
                {EXAM_BODIES.map(b => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </FormField>
          </div>

          <FormField label="Description *">
            <textarea
              value={form.description ?? ''}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              rows={3}
              placeholder="Brief description of what this course covers…"
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 dark:focus:ring-indigo-700 resize-none"
            />
          </FormField>

          <FormField label="Status">
            <div className="flex gap-2">
              {(['draft', 'active', 'archived'] as CourseStatus[]).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, status: s }))}
                  className={cn(
                    'flex-1 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider border transition-all',
                    form.status === s
                      ? STATUS_META[s].cls
                      : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:border-indigo-300',
                  )}
                >
                  {STATUS_META[s].label}
                </button>
              ))}
            </div>
          </FormField>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100 dark:border-gray-800">
            <button
              type="button"
              onClick={onClose}
              className="text-xs font-semibold text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100 px-3 py-2 rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 text-xs font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-4 py-2 rounded-lg shadow-md press"
            >
              {isNew ? 'Create Course' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 block mb-1.5">
        {label}
      </label>
      {children}
    </div>
  );
}

function StatChip({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  tone: 'emerald' | 'amber' | 'gray' | 'indigo';
}) {
  const TONE: Record<typeof tone, string> = {
    emerald: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400',
    amber: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400',
    gray: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
    indigo: 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400',
  };
  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-3 hover-lift">
      <div className="flex items-center gap-2 mb-1">
        <div className={cn('w-6 h-6 rounded-lg flex items-center justify-center [&>svg]:w-3.5 [&>svg]:h-3.5', TONE[tone])}>
          {icon}
        </div>
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</p>
      </div>
      <p className="text-xl font-bold text-gray-900 dark:text-gray-100 tabular-nums">{value}</p>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-2.5 py-1 rounded-lg text-xs font-semibold transition-all border',
        active
          ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-transparent shadow-sm'
          : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:border-indigo-300 dark:hover:border-indigo-700',
      )}
    >
      {children}
    </button>
  );
}

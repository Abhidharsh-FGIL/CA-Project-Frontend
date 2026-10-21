import { CurrentPlanCard } from '@/components/user/CurrentPlanCard';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { UserShell } from '@/components/user/UserShell';
import { useUserPortal } from '@/contexts/UserPortalContext';
import { User, Lock, Bell, Monitor, Trash2, Crown, Mail, Phone, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getPlan } from '@/data/userPortalSampleData';
import { TNPSC_GROUPS } from '@/config/tnpsc';
import { EXAM_LANGUAGE_OPTIONS, examLanguageLabel, examLanguageOf } from '@/lib/exam-language';
import { PASSWORD_HINT, confirmError, passwordError } from '@/lib/password-rules';

/**
 * Exams the portal can prepare for.
 *
 * Derived from the catalog rather than hardcoded, exactly as the registration
 * form does it, so adding a group to TNPSC_GROUPS offers it in both places. The
 * stored value is always the group id — never the label — so renaming a group
 * does not orphan everyone's profile.
 */
const EXAM_OPTIONS = TNPSC_GROUPS.map(g => ({ value: g.id, label: g.name }));

const examLabel = (id: string) => TNPSC_GROUPS.find(g => g.id === id)?.name ?? id;

/** General Tamil or General English — stored in `medium`; see `exam-language.ts`. */
const LANGUAGE_OPTIONS = EXAM_LANGUAGE_OPTIONS.map(o => ({ value: o.value, label: o.label }));

const GENDER_OPTIONS = [
  { value: 'Male', label: 'Male' },
  { value: 'Female', label: 'Female' },
  { value: 'Other', label: 'Other' },
];

export default function UserProfilePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = 'profile';
  const { user, updateProfile, changePassword, history } = useUserPortal();

  if (!user) return null;

  const setTab = (t: typeof tab) => setSearchParams({ tab: t });
  const plan = getPlan(user.subscription_tier);
  const memberSince = new Date(user.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  return (
    <UserShell>
      {/* Hero profile cover */}
      <div className="mb-6 animate-fadeIn">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-500 via-brand-400 to-pink-500 bg-[length:200%_auto] animate-gradient-x h-24 sm:h-32 md:h-40">
          <div className="absolute inset-0 bg-soft-dots opacity-20" />
          <div className="absolute -top-16 -right-16 w-48 h-48 bg-white/15 rounded-full blur-3xl" />
          <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-black/10 rounded-full blur-3xl" />
        </div>
        <div className="relative px-3 sm:px-6 -mt-10 sm:-mt-14 pb-2">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3 sm:gap-4 min-w-0">
              <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-2xl bg-gradient-to-br from-brand-500 via-brand-400 to-pink-500 flex items-center justify-center text-white text-3xl sm:text-4xl md:text-5xl font-bold shadow-xl ring-4 ring-white dark:ring-gray-950 flex-shrink-0">
                {user.name[0].toUpperCase()}
              </div>
              <div className="sm:pb-2 min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-gray-100 truncate">
                  {user.name}
                </h1>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  Member since {memberSince}
                </p>
              </div>
            </div>
          </div>

          {/* Quick info pills */}
          <div className="flex flex-wrap gap-x-4 sm:gap-x-5 gap-y-2 mt-4 text-xs text-gray-600 dark:text-gray-400">
            <span className="inline-flex items-center gap-1.5 min-w-0">
              <Mail className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
              <span className="truncate">{user.email}</span>
            </span>
            {/* No number given: no "+91" with nothing after it. */}
            {user.phone?.replace(/\D/g, '') && (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" /> +91 {user.phone}
              </span>
            )}
            <span className="hidden sm:inline-flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" /> Joined {memberSince}
            </span>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-[220px_1fr] gap-4 lg:gap-6">
        {/* Side nav — vertical on lg, horizontal scrollable on mobile */}
        <nav className="lg:space-y-1 -mx-4 px-4 lg:mx-0 lg:px-0 flex lg:block gap-2 overflow-x-auto pb-1 lg:overflow-visible scrollbar-thin">
          <TabBtn icon={<User className="w-4 h-4" />} label="Profile" active={tab === 'profile'} onClick={() => setTab('profile')} />
        </nav>

        <div>
          <CurrentPlanCard />
          {tab === 'profile' && (
            <ProfileSection
              user={user}
              updateProfile={updateProfile}
              autoEdit={searchParams.get('edit') === '1' && !user.preferred_exam}
            />
          )}
        </div>
      </div>
    </UserShell>
  );
}

function TabBtn({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex-shrink-0 lg:w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
        active
          ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-brand-300'
          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/60 bg-white dark:bg-gray-900 lg:bg-transparent dark:lg:bg-transparent border border-gray-200 dark:border-gray-700 lg:border-0 dark:lg:border-0',
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function ProfileSection({
  user,
  updateProfile,
  autoEdit,
}: {
  user: ReturnType<typeof useUserPortal>['user'];
  updateProfile: ReturnType<typeof useUserPortal>['updateProfile'];
  /** Opened straight into edit mode — set when sent here to pick an exam. */
  autoEdit: boolean;
}) {
  const initialForm = {
    name: user!.name,
    email: user!.email,
    phone: user!.phone,
    date_of_birth: user!.date_of_birth ?? '',
    gender: user!.gender ?? '',
    medium: user!.medium ?? '',
    preferred_exam: user!.preferred_exam ?? '',
  };
  const [form, setForm] = useState(initialForm);
  const [editing, setEditing] = useState(autoEdit);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    // The number is optional: blank is fine, but one that is given has to be complete.
    if (form.phone && !/^\d{10}$/.test(form.phone)) {
      toast.error('Phone must be 10 digits');
      return;
    }
    if (!form.preferred_exam) {
      toast.error('Choose the exam you are preparing for');
      return;
    }
    setSaving(true);
    // Email is immutable here; all other fields are forwarded.
    const res = await updateProfile({
      name: form.name,
      phone: form.phone,
      date_of_birth: form.date_of_birth,
      gender: form.gender,
      medium: form.medium,
      preferred_exam: form.preferred_exam,
    });
    setSaving(false);
    if (res.ok) {
      setEditing(false);
      toast.success('Profile updated');
    } else {
      toast.error(res.error || 'Could not update profile');
    }
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 sm:p-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100">Personal Information</h2>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline"
          >
            Edit
          </button>
        )}
      </div>

      <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100 dark:border-gray-800">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-brand-500 to-brand-400 flex items-center justify-center text-white text-2xl font-bold">
          {user!.name[0].toUpperCase()}
        </div>
        <div>
          <p className="text-base font-bold text-gray-900 dark:text-gray-100">{user!.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Member since {new Date(user!.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <FormRow
          label="Full Name"
          value={form.name}
          editing={editing}
          onChange={v => setForm(f => ({ ...f, name: v }))}
        />
        <FormRow
          label="Email"
          value={form.email}
          editing={false}
          onChange={v => setForm(f => ({ ...f, email: v }))}
          hint={editing ? 'Email cannot be changed here.' : undefined}
        />
        <FormRow
          label="Phone"
          value={form.phone}
          editing={editing}
          onChange={v => setForm(f => ({ ...f, phone: v.replace(/\D/g, '').slice(0, 10) }))}
        />
        <FormRow
          label="Date of Birth"
          type="date"
          value={form.date_of_birth}
          editing={editing}
          onChange={v => setForm(f => ({ ...f, date_of_birth: v }))}
        />
        <FormRow
          label="Gender"
          value={form.gender}
          editing={editing}
          onChange={v => setForm(f => ({ ...f, gender: v }))}
          options={GENDER_OPTIONS}
        />

        {/* Preparation — the two fields the rest of the portal actually reads.
            `preferred_exam` decides which syllabus the Exams screens and the
            study plan work from, so it is the one field here that is required. */}
        <div className="pt-4 mt-4 border-t border-gray-100 dark:border-gray-800">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 mb-4">
            Preparation
          </p>
          <div className="space-y-4">
            {!form.preferred_exam && !editing && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50/70 dark:bg-amber-950/30 px-3 py-2.5 mb-1">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-300">
                  You haven't chosen an exam yet
                </p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-amber-600 dark:text-amber-400">
                  Your study plan can't be built without one — it needs to know whose syllabus to
                  work from. Tap Edit above to set it.
                </p>
              </div>
            )}
            <FormRow
              label="Preparing for"
              value={form.preferred_exam}
              editing={editing}
              onChange={v => setForm(f => ({ ...f, preferred_exam: v }))}
              options={EXAM_OPTIONS}
              placeholder="Select the exam…"
              display={examLabel(form.preferred_exam)}
              hint={
                editing
                  ? 'Your mock tests, reports and study plan are all built from this exam’s syllabus.'
                  : undefined
              }
            />
            <FormRow
              label="Language paper"
              value={form.medium}
              editing={editing}
              onChange={v => setForm(f => ({ ...f, medium: v }))}
              options={LANGUAGE_OPTIONS}
              placeholder="Select General Tamil or General English…"
              display={examLanguageOf(form.medium) ? examLanguageLabel(examLanguageOf(form.medium)!) : 'Not chosen yet'}
              hint={
                editing
                  ? 'You sit one of the two. Your mock tests, practice sets, syllabus and study plan show only this paper.'
                  : undefined
              }
            />
          </div>
        </div>
      </div>

      {editing && (
        <div className="flex gap-2 mt-5 pt-5 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={() => {
              setForm(initialForm);
              setEditing(false);
            }}
            className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/60"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-semibold hover:bg-brand-700 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      )}
    </div>
  );
}

function FormRow({
  label,
  value,
  editing,
  onChange,
  hint,
  type = 'text',
  options,
  placeholder,
  display,
}: {
  label: string;
  value: string;
  editing: boolean;
  onChange: (v: string) => void;
  hint?: string;
  type?: string;
  /** Renders a select instead of a text input — a closed set of valid answers. */
  options?: { value: string; label: string }[];
  placeholder?: string;
  /** What to show when not editing, where the stored value is an id, not a label. */
  display?: string;
}) {
  const field = cn(
    'w-full px-3 py-2 border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:border-brand-500 dark:focus:border-blue-400',
  );

  return (
    <div className="grid sm:grid-cols-[140px_1fr] gap-2 items-center">
      <label className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</label>
      <div>
        {editing ? (
          options ? (
            <select value={value} onChange={e => onChange(e.target.value)} className={field}>
              <option value="">{placeholder ?? 'Select…'}</option>
              {options.map(o => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={type}
              // A date of birth cannot be in the future.
              max={type === 'date' ? new Date().toLocaleDateString('en-CA') : undefined}
              value={value}
              onChange={e => onChange(e.target.value)}
              className={field}
            />
          )
        ) : (
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
            {display || value || '—'}
          </p>
        )}
        {hint && <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">{hint}</p>}
      </div>
    </div>
  );
}

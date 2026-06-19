import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { UserShell } from '@/components/user/UserShell';
import { useUserPortal } from '@/contexts/UserPortalContext';
import { User, Lock, Bell, Monitor, Trash2, Crown, Mail, Phone, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { getPlan } from '@/data/userPortalSampleData';

export default function UserProfilePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = (searchParams.get('tab') as 'profile' | 'security' | 'settings') || 'profile';
  const { user, updateProfile, changePassword, history } = useUserPortal();

  if (!user) return null;

  const setTab = (t: typeof tab) => setSearchParams({ tab: t });
  const plan = getPlan(user.subscription_tier);
  const memberSince = new Date(user.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  return (
    <UserShell>
      {/* Hero profile cover */}
      <div className="mb-6 animate-fadeIn">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-600 to-pink-500 bg-[length:200%_auto] animate-gradient-x h-24 sm:h-32 md:h-40">
          <div className="absolute inset-0 bg-soft-dots opacity-20" />
          <div className="absolute -top-16 -right-16 w-48 h-48 bg-white/15 rounded-full blur-3xl" />
          <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-black/10 rounded-full blur-3xl" />
        </div>
        <div className="relative px-3 sm:px-6 -mt-10 sm:-mt-14 pb-2">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 sm:gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3 sm:gap-4 min-w-0">
              <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-2xl bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex items-center justify-center text-white text-3xl sm:text-4xl md:text-5xl font-bold shadow-xl ring-4 ring-white dark:ring-gray-950 flex-shrink-0">
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
            <div className="flex gap-2 flex-wrap sm:pb-2">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold',
                  user.subscription_tier === 'premium'
                    ? 'bg-gradient-to-r from-amber-200 via-yellow-100 to-amber-200 bg-[length:200%_auto] animate-gradient-x text-amber-900 border border-amber-300 dark:border-amber-700'
                    : user.subscription_tier === 'ultimate'
                    ? 'bg-gradient-to-r from-indigo-100 to-purple-100 dark:from-indigo-900/40 dark:to-purple-900/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800'
                    : user.subscription_tier === 'standard'
                    ? 'bg-gradient-to-r from-blue-100 to-cyan-100 dark:from-blue-900/40 dark:to-cyan-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700',
                )}
              >
                {user.subscription_tier === 'premium' && <Crown className="w-3 h-3" />}
                {plan.name} Plan
              </span>
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                {history.length} tests taken
              </span>
            </div>
          </div>

          {/* Quick info pills */}
          <div className="flex flex-wrap gap-x-4 sm:gap-x-5 gap-y-2 mt-4 text-xs text-gray-600 dark:text-gray-400">
            <span className="inline-flex items-center gap-1.5 min-w-0">
              <Mail className="w-3.5 h-3.5 text-indigo-500 flex-shrink-0" />
              <span className="truncate">{user.email}</span>
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" /> +91 {user.phone}
            </span>
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
          <TabBtn icon={<Lock className="w-4 h-4" />} label="Security" active={tab === 'security'} onClick={() => setTab('security')} />
          <TabBtn icon={<Bell className="w-4 h-4" />} label="Settings" active={tab === 'settings'} onClick={() => setTab('settings')} />
        </nav>

        <div>
          {tab === 'profile' && <ProfileSection user={user} updateProfile={updateProfile} />}
          {tab === 'security' && <SecuritySection changePassword={changePassword} />}
          {tab === 'settings' && <SettingsSection />}
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
          ? 'bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300'
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
}: {
  user: ReturnType<typeof useUserPortal>['user'];
  updateProfile: ReturnType<typeof useUserPortal>['updateProfile'];
}) {
  const [form, setForm] = useState({ name: user!.name, email: user!.email, phone: user!.phone });
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!/^\d{10}$/.test(form.phone)) {
      toast.error('Phone must be 10 digits');
      return;
    }
    setSaving(true);
    // Backend profile endpoint only accepts name + phone — email is immutable here.
    const res = await updateProfile({ name: form.name, phone: form.phone });
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
            className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
          >
            Edit
          </button>
        )}
      </div>

      <div className="flex items-center gap-4 mb-6 pb-6 border-b border-gray-100 dark:border-gray-800">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold">
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
      </div>

      {editing && (
        <div className="flex gap-2 mt-5 pt-5 border-t border-gray-100 dark:border-gray-800">
          <button
            onClick={() => {
              setForm({ name: user!.name, email: user!.email, phone: user!.phone });
              setEditing(false);
            }}
            className="px-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/60"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-60"
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
}: {
  label: string;
  value: string;
  editing: boolean;
  onChange: (v: string) => void;
  hint?: string;
}) {
  return (
    <div className="grid sm:grid-cols-[140px_1fr] gap-2 items-center">
      <label className="text-sm font-medium text-gray-500 dark:text-gray-400">{label}</label>
      <div>
        {editing ? (
          <input
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            className="w-full px-3 py-2 border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg text-sm focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400"
          />
        ) : (
          <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{value}</p>
        )}
        {hint && <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1">{hint}</p>}
      </div>
    </div>
  );
}

function SecuritySection({
  changePassword,
}: {
  changePassword: ReturnType<typeof useUserPortal>['changePassword'];
}) {
  const [form, setForm] = useState({ old: '', newPwd: '', confirm: '' });
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (form.newPwd.length < 8) return toast.error('Password must be 8+ characters');
    if (form.newPwd !== form.confirm) return toast.error('Passwords do not match');
    setSubmitting(true);
    try {
      const res = await changePassword(form.old, form.newPwd);
      if (res.ok) {
        toast.success('Password updated');
        setForm({ old: '', newPwd: '', confirm: '' });
      } else toast.error(res.error || 'Failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 sm:p-6">
        <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">Change Password</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
          Choose a strong password — min 8 chars, 1 uppercase, 1 number, 1 special character.
        </p>
        <div className="space-y-3 max-w-md">
          <input
            type="password"
            value={form.old}
            onChange={e => setForm(f => ({ ...f, old: e.target.value }))}
            placeholder="Current password"
            className="w-full px-3 py-2.5 border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-lg text-sm focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400"
          />
          <input
            type="password"
            value={form.newPwd}
            onChange={e => setForm(f => ({ ...f, newPwd: e.target.value }))}
            placeholder="New password"
            className="w-full px-3 py-2.5 border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-lg text-sm focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400"
          />
          <input
            type="password"
            value={form.confirm}
            onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
            placeholder="Confirm new password"
            className="w-full px-3 py-2.5 border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 rounded-lg text-sm focus:outline-none focus:border-indigo-500 dark:focus:border-indigo-400"
          />
          <button
            onClick={submit}
            disabled={submitting}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
          >
            {submitting ? 'Updating...' : 'Update Password'}
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-900 rounded-2xl border border-red-200 dark:border-red-900 p-6">
        <h2 className="text-lg font-bold text-red-700 dark:text-red-300 mb-1 flex items-center gap-2">
          <Trash2 className="w-4 h-4" /> Danger Zone
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
          Permanently delete your account and all associated data. You can also request a data export.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => toast.info('Data export requested — you will receive an email with your data.')}
            className="px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 text-xs font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/60"
          >
            Request Data Export
          </button>
          <button
            onClick={() => toast.error('Account deletion confirmation flow — stub.')}
            className="px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900 text-xs font-semibold text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30"
          >
            Delete Account
          </button>
        </div>
      </div>
    </div>
  );
}

function SettingsSection() {
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [inAppNotifs, setInAppNotifs] = useState(true);
  const [smsNotifs, setSmsNotifs] = useState(false);

  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 sm:p-6">
      <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-5 flex items-center gap-2">
        <Monitor className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /> Preferences
      </h2>
      <p className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">Notification preferences</p>
      <div className="space-y-1">
        <ToggleRow label="In-app notifications" value={inAppNotifs} onChange={setInAppNotifs} />
        <ToggleRow label="Email notifications" value={emailNotifs} onChange={setEmailNotifs} />
        <ToggleRow label="SMS notifications" value={smsNotifs} onChange={setSmsNotifs} />
      </div>
    </div>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (b: boolean) => void }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-800 last:border-0">
      <p className="text-sm text-gray-700 dark:text-gray-300">{label}</p>
      <button
        onClick={() => onChange(!value)}
        className={cn(
          'relative inline-flex h-6 w-11 rounded-full transition-colors',
          value ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700',
        )}
      >
        <span
          className={cn(
            'inline-block h-5 w-5 transform rounded-full bg-white shadow-md transition-transform mt-0.5',
            value ? 'translate-x-5' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  );
}

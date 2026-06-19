import { useState } from 'react';
import { GenVerseShell } from '@/components/layout/GenVerseShell';
import { PageHeader } from '@/components/layout/AppShell';
import {
  User,
  Lock,
  Bell,
  ShieldCheck,
  Clock,
  Save,
  Eye,
  EyeOff,
  Crown,
  AlertTriangle,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAdminSettings, useAdminSettingsActions } from '@/hooks/use-admin-settings';

type Tab = 'profile' | 'security' | 'policy' | 'notifications';

const TABS: { key: Tab; label: string; icon: typeof User }[] = [
  { key: 'profile', label: 'Profile', icon: User },
  { key: 'security', label: 'Security', icon: Lock },
  { key: 'policy', label: 'System Policy', icon: ShieldCheck },
  { key: 'notifications', label: 'Notifications', icon: Bell },
];

export default function AdminSettingsPage() {
  const [tab, setTab] = useState<Tab>('profile');
  const { data: settingsData, isLoading: settingsLoading } = useAdminSettings();
  const { updateProfile, changePassword: changePasswordMutation, updatePolicy, updateNotifications } = useAdminSettingsActions();

  // Profile local state — seeded from API data
  const [localName, setLocalName] = useState('');
  const [localEmail, setLocalEmail] = useState('');

  // Sync local profile fields when data loads (only once)
  const [profileSynced, setProfileSynced] = useState(false);
  if (settingsData?.profile && !profileSynced) {
    setLocalName(settingsData.profile.name);
    setLocalEmail(settingsData.profile.email);
    setProfileSynced(true);
  }

  // Policy local state
  const [maxFailedLogins, setMaxFailedLogins] = useState(5);
  const [sessionTimeout, setSessionTimeout] = useState(30);
  const [otpExpiry, setOtpExpiry] = useState(10);
  const [policySynced, setPolicySynced] = useState(false);
  if (settingsData?.policy && !policySynced) {
    if (settingsData.policy.max_failed_login_attempts != null)
      setMaxFailedLogins(settingsData.policy.max_failed_login_attempts as number);
    if (settingsData.policy.session_timeout_minutes != null)
      setSessionTimeout(settingsData.policy.session_timeout_minutes as number);
    if (settingsData.policy.otp_expiry_minutes != null)
      setOtpExpiry(settingsData.policy.otp_expiry_minutes as number);
    setPolicySynced(true);
  }

  // Notifications local state
  const [emailOnNewUser, setEmailOnNewUser] = useState(false);
  const [emailOnSubscription, setEmailOnSubscription] = useState(false);
  const [emailOnTestAttempt, setEmailOnTestAttempt] = useState(false);
  const [emailOnAiReport, setEmailOnAiReport] = useState(false);
  const [notifSynced, setNotifSynced] = useState(false);
  if (settingsData?.notifications && !notifSynced) {
    if (settingsData.notifications.email_on_new_user != null)
      setEmailOnNewUser(settingsData.notifications.email_on_new_user as boolean);
    if (settingsData.notifications.email_on_subscription != null)
      setEmailOnSubscription(settingsData.notifications.email_on_subscription as boolean);
    if (settingsData.notifications.email_on_test_attempt != null)
      setEmailOnTestAttempt(settingsData.notifications.email_on_test_attempt as boolean);
    if (settingsData.notifications.email_on_ai_report != null)
      setEmailOnAiReport(settingsData.notifications.email_on_ai_report as boolean);
    setNotifSynced(true);
  }

  const [showPassword, setShowPassword] = useState(false);
  const [pwd, setPwd] = useState({ current: '', next: '', confirm: '' });

  const saveProfile = () => {
    updateProfile.mutate({ name: localName });
  };

  const handleChangePassword = () => {
    if (!pwd.current || !pwd.next || !pwd.confirm) {
      toast.error('All password fields are required');
      return;
    }
    if (pwd.next.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (!/[A-Z]/.test(pwd.next) || !/[0-9]/.test(pwd.next) || !/[!@#$%^&*]/.test(pwd.next)) {
      toast.error('Password must include uppercase, number, and special character');
      return;
    }
    if (pwd.next !== pwd.confirm) {
      toast.error('Passwords do not match');
      return;
    }
    changePasswordMutation.mutate({ current_password: pwd.current, new_password: pwd.next });
    setPwd({ current: '', next: '', confirm: '' });
  };

  const savePolicy = () => {
    updatePolicy.mutate({
      max_failed_login_attempts: maxFailedLogins,
      session_timeout_minutes: sessionTimeout,
      otp_expiry_minutes: otpExpiry,
    });
  };

  const saveNotifications = () => {
    updateNotifications.mutate({
      email_on_new_user: emailOnNewUser,
      email_on_subscription: emailOnSubscription,
      email_on_test_attempt: emailOnTestAttempt,
      email_on_ai_report: emailOnAiReport,
    });
  };

  return (
    <GenVerseShell>
      <PageHeader
        title="Admin Settings"
        description="Profile, security, system policy, and notification preferences."
        breadcrumbs={[{ label: 'Dashboard', href: '/org/dashboard' }, { label: 'Settings' }]}
      />

      {settingsLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      ) : (
      <div className="grid lg:grid-cols-[220px_1fr] gap-5 pb-6">
        {/* Sidebar */}
        <aside className="space-y-1">
          {TABS.map(t => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  'w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all',
                  tab === t.key
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-200/40'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800',
                )}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {t.label}
              </button>
            );
          })}
        </aside>

        {/* Content */}
        <div className="space-y-5 min-w-0">
          {tab === 'profile' && (
            <SettingsCard
              title="Admin Profile"
              description="Your personal information visible across audit logs."
            >
              <div className="grid sm:grid-cols-2 gap-4">
                <FormField label="Name">
                  <input
                    type="text"
                    value={localName}
                    onChange={e => setLocalName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  />
                </FormField>
                <FormField label="Email">
                  <input
                    type="email"
                    value={localEmail}
                    readOnly
                    className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 rounded-lg cursor-not-allowed select-none"
                  />
                </FormField>
              </div>
              <FormField label="Role">
                <div className="inline-flex items-center gap-2 bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-950/60 dark:to-orange-950/60 text-amber-700 dark:text-amber-300 px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider">
                  <Crown className="w-3.5 h-3.5" />
                  {(settingsData?.profile.role ?? 'admin').replace('_', ' ')}
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2">
                  Role-based access differentiates Super Admin from Content Admin.
                </p>
              </FormField>

              <ActionButton onClick={saveProfile}>Save Profile</ActionButton>
            </SettingsCard>
          )}

          {tab === 'security' && (
            <>
              <SettingsCard
                title="Change Password"
                description="Password must be at least 8 characters with uppercase, number, and special character."
              >
                <FormField label="Current Password">
                  <PasswordInput
                    value={pwd.current}
                    show={showPassword}
                    onChange={v => setPwd(p => ({ ...p, current: v }))}
                    onToggle={() => setShowPassword(s => !s)}
                  />
                </FormField>
                <div className="grid sm:grid-cols-2 gap-4">
                  <FormField label="New Password">
                    <PasswordInput
                      value={pwd.next}
                      show={showPassword}
                      onChange={v => setPwd(p => ({ ...p, next: v }))}
                      onToggle={() => setShowPassword(s => !s)}
                    />
                  </FormField>
                  <FormField label="Confirm Password">
                    <PasswordInput
                      value={pwd.confirm}
                      show={showPassword}
                      onChange={v => setPwd(p => ({ ...p, confirm: v }))}
                      onToggle={() => setShowPassword(s => !s)}
                    />
                  </FormField>
                </div>
                <ActionButton onClick={handleChangePassword}>Change Password</ActionButton>
              </SettingsCard>

              <SettingsCard
                title="Session"
                description="Idle timeout for the admin portal."
              >
                <NumberRow
                  icon={<Clock />}
                  label="Session Timeout"
                  value={sessionTimeout}
                  suffix="minutes"
                  min={5}
                  max={120}
                  onChange={v => setSessionTimeout(v)}
                />
                <ActionButton onClick={savePolicy}>Save Session Settings</ActionButton>
              </SettingsCard>
            </>
          )}

          {tab === 'policy' && (
            <>
              <SettingsCard
                title="OTP & Sign-in Policy"
                description="Controls for user registration and login flow."
              >
                <NumberRow
                  icon={<Clock />}
                  label="OTP Expiry"
                  value={otpExpiry}
                  suffix="minutes"
                  min={1}
                  max={30}
                  onChange={v => setOtpExpiry(v)}
                />
                <NumberRow
                  icon={<AlertTriangle />}
                  label="Max Failed Login Attempts"
                  value={maxFailedLogins}
                  suffix="attempts"
                  min={3}
                  max={10}
                  onChange={v => setMaxFailedLogins(v)}
                  helper="Account is locked when this threshold is reached."
                />
                <ActionButton onClick={savePolicy}>Save Sign-in Policy</ActionButton>
              </SettingsCard>

              <SettingsCard
                title="Session Policy"
                description="Idle timeout for active admin sessions."
              >
                <NumberRow
                  icon={<ShieldCheck />}
                  label="Session Timeout"
                  value={sessionTimeout}
                  suffix="minutes"
                  min={5}
                  max={480}
                  onChange={v => setSessionTimeout(v)}
                  helper="Admin portal session will expire after this idle period."
                />
                <ActionButton onClick={savePolicy}>Save Session Policy</ActionButton>
              </SettingsCard>
            </>
          )}

          {tab === 'notifications' && (
            <SettingsCard
              title="Email Notifications"
              description="Choose when the platform emails you."
            >
              <ToggleRow
                icon={<User />}
                label="New User Registrations"
                description="Get an email whenever a new user verifies their account."
                value={emailOnNewUser}
                onChange={v => setEmailOnNewUser(v)}
              />
              <ToggleRow
                icon={<AlertTriangle />}
                label="New Subscriptions"
                description="Get an email when a user subscribes to a plan."
                value={emailOnSubscription}
                onChange={v => setEmailOnSubscription(v)}
              />
              <ToggleRow
                icon={<ShieldCheck />}
                label="Test Attempts"
                description="Get an email whenever a user submits a test attempt."
                value={emailOnTestAttempt}
                onChange={v => setEmailOnTestAttempt(v)}
              />
              <ToggleRow
                icon={<Sparkles />}
                label="AI Report Generated"
                description="Get an email when an AI analysis report is generated."
                value={emailOnAiReport}
                onChange={v => setEmailOnAiReport(v)}
              />
              <ActionButton onClick={saveNotifications}>Save Notification Settings</ActionButton>
            </SettingsCard>
          )}
        </div>
      </div>
      )}
    </GenVerseShell>
  );
}

function SettingsCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 space-y-4">
      <div>
        <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">{title}</h2>
        {description && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>}
      </div>
      {children}
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

function PasswordInput({
  value,
  show,
  onChange,
  onToggle,
}: {
  value: string;
  show: boolean;
  onChange: (v: string) => void;
  onToggle: () => void;
}) {
  return (
    <div className="relative">
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full pl-3 pr-9 py-2 text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300"
      />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  );
}

function NumberRow({
  icon,
  label,
  value,
  suffix,
  min,
  max,
  step = 1,
  helper,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  suffix: string;
  min?: number;
  max?: number;
  step?: number;
  helper?: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50/60 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800">
      <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0 [&>svg]:w-4 [&>svg]:h-4">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{label}</p>
        {helper && <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{helper}</p>}
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => onChange(parseFloat(e.target.value) || 0)}
          className="w-20 px-2 py-1 text-sm font-bold text-right border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-300 tabular-nums"
        />
        <span className="text-xs text-gray-500 dark:text-gray-400">{suffix}</span>
      </div>
    </div>
  );
}

function ToggleRow({
  icon,
  label,
  description,
  value,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-xl bg-gray-50/60 dark:bg-gray-800/40 border border-gray-100 dark:border-gray-800">
      <div className="w-8 h-8 rounded-lg bg-indigo-100 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center flex-shrink-0 [&>svg]:w-4 [&>svg]:h-4">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{label}</p>
        <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={cn(
          'inline-block w-10 h-5 rounded-full relative transition-colors flex-shrink-0',
          value ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-gray-600',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all shadow-sm',
            value ? 'left-5' : 'left-0.5',
          )}
        />
      </button>
    </div>
  );
}

function ActionButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <div className="pt-2 border-t border-gray-100 dark:border-gray-800 flex justify-end">
      <button
        onClick={onClick}
        className="inline-flex items-center gap-1.5 text-xs font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-4 py-2 rounded-lg shadow-md press"
      >
        <Save className="w-3.5 h-3.5" /> {children}
      </button>
    </div>
  );
}

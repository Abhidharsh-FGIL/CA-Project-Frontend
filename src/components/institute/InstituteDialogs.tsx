import { useEffect, useState } from 'react';
import { Eye, EyeOff, Loader2, Wand2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useAdminInstituteActions } from '@/hooks/use-admin-institutes';
import { instituteLoginUrl, instituteSlug, type Institute } from '@/lib/instituteApi';
import { PASSWORD_HINT, passwordError } from '@/lib/password-rules';

const FIELD =
  'w-full px-3.5 py-2.5 border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 rounded-xl focus:border-brand-500 outline-none text-sm';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Ten digits, with an optional +91 or 0 in front: what an Indian contact number looks like. */
const PHONE = /^(\+?91[\s-]?|0)?[6-9]\d{9}$/;

/** A password that meets the rule, for an admin who would rather not invent one. */
function suggestPassword(): string {
  const pick = (chars: string) => chars[crypto.getRandomValues(new Uint32Array(1))[0] % chars.length];
  const all = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*';
  const body = Array.from({ length: 8 }, () => pick(all));
  return [pick('ABCDEFGHJKLMNPQRSTUVWXYZ'), pick('abcdefghijkmnpqrstuvwxyz'), pick('23456789'), pick('!@#$%&*'), ...body].join('');
}

function Field({ label, error, hint, children }: { label: string; error?: string | null; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">{label}</label>
      {children}
      {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : hint ? <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">{hint}</p> : null}
    </div>
  );
}

function PasswordField({
  value,
  onChange,
  error,
  label = 'Password',
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string | null;
  label?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <Field label={label} error={error} hint={PASSWORD_HINT}>
      <div className="relative">
        <input
          type={show ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          autoComplete="new-password"
          className={`${FIELD} pr-20`}
        />
        <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-1">
          <button
            type="button"
            onClick={() => {
              onChange(suggestPassword());
              setShow(true);
            }}
            title="Suggest a password"
            aria-label="Suggest a password"
            className="rounded-md p-1.5 text-gray-400 hover:text-brand-600"
          >
            <Wand2 className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'} className="rounded-md p-1.5 text-gray-400 hover:text-gray-600">
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </Field>
  );
}

/** Add an institute, or change its name, contact number and email. The password is set once, when adding. */
export function InstituteFormDialog({
  open,
  onOpenChange,
  institute,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present when editing. */
  institute?: Institute | null;
  onSaved?: (institute: Institute) => void;
}) {
  const { create, update } = useAdminInstituteActions();
  const editing = !!institute;
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tried, setTried] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(institute?.name ?? '');
    setContact(institute?.contact_number ?? '');
    setEmail(institute?.email ?? '');
    setPassword('');
    setTried(false);
  }, [open, institute]);

  const errors = {
    name: name.trim().length < 2 ? 'Enter the institute name' : null,
    contact: PHONE.test(contact.replace(/[\s()-]/g, '')) ? null : 'Enter a 10-digit contact number',
    email: EMAIL.test(email.trim()) ? null : 'Enter a valid email address',
    password: editing ? null : passwordError(password),
  };
  const invalid = Object.values(errors).some(Boolean);
  const busy = create.isPending || update.isPending;
  const slug = instituteSlug(name);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (invalid) return;
    const body = { name: name.trim(), contact_number: contact.replace(/[\s()-]/g, ''), email: email.trim().toLowerCase() };
    try {
      const saved = editing
        ? await update.mutateAsync({ id: institute!.institute_id, body })
        : await create.mutateAsync({ ...body, password });
      onSaved?.(saved);
      onOpenChange(false);
    } catch {
      /* the mutation's own handler has already shown why it failed; the form stays open */
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit institute' : 'Add an institute'}</DialogTitle>
          <DialogDescription>
            {editing ? 'The sign-in address stays the same.' : 'The institute signs in with this email and password, at an address made from its name.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3.5">
          <Field label="Institute name" error={tried ? errors.name : null}>
            <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Sri Ram Academy" className={FIELD} autoFocus />
          </Field>
          {!editing && slug && (
            <p className="-mt-1.5 break-all text-[11px] text-gray-500 dark:text-gray-400">
              Sign-in address: <span className="font-semibold text-gray-700 dark:text-gray-200">{instituteLoginUrl(slug)}</span>
            </p>
          )}
          <Field label="Contact number" error={tried ? errors.contact : null}>
            <input value={contact} onChange={e => setContact(e.target.value)} inputMode="tel" placeholder="98765 43210" className={FIELD} />
          </Field>
          <Field label="Email ID" error={tried ? errors.email : null}>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="office@institute.com" className={FIELD} />
          </Field>
          {!editing && <PasswordField value={password} onChange={setPassword} error={tried ? errors.password : null} />}
          <DialogFooter>
            <button type="button" onClick={() => onOpenChange(false)} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200">
              Cancel
            </button>
            <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
              {busy && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? 'Save changes' : 'Add institute'}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Set a new password for an institute that has lost its own. */
export function ResetPasswordDialog({
  institute,
  onOpenChange,
}: {
  institute: Institute | null;
  onOpenChange: (open: boolean) => void;
}) {
  const { resetPassword } = useAdminInstituteActions();
  const [password, setPassword] = useState('');
  const [tried, setTried] = useState(false);
  useEffect(() => {
    setPassword('');
    setTried(false);
  }, [institute]);
  const error = passwordError(password);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTried(true);
    if (error || !institute) return;
    try {
      await resetPassword.mutateAsync({ id: institute.institute_id, password });
      onOpenChange(false);
    } catch {
      /* already shown by the mutation's handler */
    }
  };

  return (
    <Dialog open={!!institute} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
          <DialogDescription>{institute?.name} will sign in with the new password. Share it with them yourself.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3.5">
          <PasswordField label="New password" value={password} onChange={setPassword} error={tried ? error : null} />
          <DialogFooter>
            <button type="button" onClick={() => onOpenChange(false)} className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 dark:border-gray-700 dark:text-gray-200">
              Cancel
            </button>
            <button type="submit" disabled={resetPassword.isPending} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
              {resetPassword.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Change password
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

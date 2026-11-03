import { useState } from 'react';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { instituteLoginUrl, instituteSignupUrl } from '@/lib/instituteApi';

/** One address with a Copy button, for the institute's sign-in page and its students' sign-up link. */
function CopyField({ label, hint, url }: { label: string; hint: string; url: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* clipboard blocked: the address is selectable on the page */
    }
  };
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">{label}</p>
      <div className="mt-1 flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
          {url}
        </code>
        <button
          type="button"
          onClick={copy}
          aria-label={`Copy ${label}`}
          className="inline-flex h-8 flex-shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
        >
          {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          aria-label={`Open ${label}`}
          className="inline-flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
      <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">{hint}</p>
    </div>
  );
}

/** The two addresses an institute is given: where it signs in, and where its students sign up. */
export function InstituteUrls({ slug }: { slug: string }) {
  return (
    <div className="space-y-3.5">
      <CopyField label="Institute sign-in page" hint="The institute signs in here with its email and password." url={instituteLoginUrl(slug)} />
      <CopyField
        label="Student sign-up link"
        hint="Students who register from this link are tied to the institute and appear in its history."
        url={instituteSignupUrl(slug)}
      />
    </div>
  );
}

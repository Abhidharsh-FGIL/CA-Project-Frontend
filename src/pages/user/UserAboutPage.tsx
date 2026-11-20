import { UserShell } from '@/components/user/UserShell';
import { useT } from '@/content/useText';
import type { ContentKey } from '@/content/registry';
import { BarChart3, BookOpen, ClipboardCheck, FileText, Lightbulb, LineChart, Target } from 'lucide-react';

/** The About Us page, in the words the company has written for it. */

const OFFERS: Array<{ icon: typeof FileText; title: ContentKey; body: ContentKey }> = [
  { icon: FileText, title: 'exams.about.offer1.title', body: 'exams.about.offer1.body' },
  { icon: BookOpen, title: 'exams.about.offer2.title', body: 'exams.about.offer2.body' },
  { icon: ClipboardCheck, title: 'exams.about.offer3.title', body: 'exams.about.offer3.body' },
  { icon: Lightbulb, title: 'exams.about.offer4.title', body: 'exams.about.offer4.body' },
  { icon: BarChart3, title: 'exams.about.offer5.title', body: 'exams.about.offer5.body' },
  { icon: LineChart, title: 'exams.about.offer6.title', body: 'exams.about.offer6.body' },
];

export default function UserAboutPage() {
  const t = useT();
  return (
    <UserShell>
      <div className="mx-auto max-w-4xl space-y-6 animate-fadeIn">
        <section className="rounded-2xl border border-gray-200 border-t-4 border-t-orange-500 bg-white p-6 dark:border-gray-800 dark:bg-gray-900 sm:p-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-orange-600 dark:text-orange-400">{t('exams.about.eyebrow')}</p>
          <h1 className="mt-2 text-2xl font-extrabold text-gray-900 dark:text-gray-100 sm:text-3xl">
            {t('exams.about.title')}
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            {t('exams.about.intro1')}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            {t('exams.about.intro2')}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            {t('exams.about.intro3')}
          </p>
        </section>

        <section>
          <h2 className="mb-3 border-l-4 border-orange-500 pl-3 text-xl font-extrabold text-gray-900 dark:text-gray-100">{t('exams.about.offer.title')}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {OFFERS.map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{t(title)}</p>
                  <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-400">{t(body)}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="text-lg font-extrabold text-gray-900 dark:text-gray-100">{t('exams.about.exams.title')}</h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            {t('exams.about.exams.text')}
          </p>
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-2 flex items-center gap-2">
              <Target className="h-4 w-4 text-orange-600 dark:text-orange-400" aria-hidden />
              <h2 className="text-lg font-extrabold text-gray-900 dark:text-gray-100">{t('exams.about.mission.title')}</h2>
            </div>
            <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
              {t('exams.about.mission.text')}
            </p>
          </section>
          <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-2 flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-orange-600 dark:text-orange-400" aria-hidden />
              <h2 className="text-lg font-extrabold text-gray-900 dark:text-gray-100">{t('exams.about.vision.title')}</h2>
            </div>
            <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
              {t('exams.about.vision.text')}
            </p>
          </section>
        </div>

        <section className="rounded-2xl bg-gray-900 p-6 text-white sm:p-8">
          <p className="text-lg font-extrabold">{t('exams.about.closing.title')}</p>
          <p className="mt-2 text-sm leading-relaxed text-gray-300">
            {t('exams.about.closing.text')}
          </p>
          <p className="mt-4 text-sm font-semibold text-orange-300">{t('exams.about.closing.cta')}</p>
        </section>
      </div>
    </UserShell>
  );
}

import { UserShell } from '@/components/user/UserShell';
import { BarChart3, BookOpen, ClipboardCheck, FileText, Lightbulb, LineChart, Target } from 'lucide-react';

/** The About Us page, in the words the company has written for it. */

const OFFERS = [
  { icon: FileText, title: 'Previous Year Question Papers', body: 'Practice questions from previous examinations to understand exam patterns and improve preparation.' },
  { icon: BookOpen, title: 'Syllabus-Wise Practice Tests', body: 'Strengthen your knowledge through topic-wise and unit-wise practice at different difficulty levels.' },
  { icon: ClipboardCheck, title: 'Full-Length Mock Tests', body: 'Experience exam-style assessments to improve accuracy, speed, and time management.' },
  { icon: Lightbulb, title: 'Detailed Explanations', body: 'Understand the concepts and reasoning behind answers.' },
  { icon: BarChart3, title: 'AI-Powered Performance Analysis', body: 'Identify your strengths, weaknesses, and areas that need improvement.' },
  { icon: LineChart, title: 'Progress Tracking', body: 'Monitor your preparation journey and work towards continuous improvement.' },
];

export default function UserAboutPage() {
  return (
    <UserShell>
      <div className="mx-auto max-w-4xl space-y-6 animate-fadeIn">
        <section className="rounded-2xl border border-gray-200 border-t-4 border-t-orange-500 bg-white p-6 dark:border-gray-800 dark:bg-gray-900 sm:p-8">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-orange-600 dark:text-orange-400">About Us</p>
          <h1 className="mt-2 text-2xl font-extrabold text-gray-900 dark:text-gray-100 sm:text-3xl">
            My Gov Exams – Your Partner in Government Job Success
          </h1>
          <p className="mt-4 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            At My Gov Exams, we believe that the right preparation, guidance, and resources can make a meaningful difference
            in achieving your government job aspirations.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            My Gov Exams, an initiative by FutureGen Innovation Lab, is an online exam preparation platform designed to help
            students prepare for government competitive examinations with confidence.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            Our platform brings together previous-year question papers, syllabus-wise practice tests, full-length mock
            examinations, detailed explanations, AI-powered performance insights — all in one place.
          </p>
        </section>

        <section>
          <h2 className="mb-3 border-l-4 border-orange-500 pl-3 text-xl font-extrabold text-gray-900 dark:text-gray-100">What We Offer</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {OFFERS.map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex items-start gap-3 rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-gray-900">
                <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-orange-50 text-orange-600 dark:bg-orange-950/40 dark:text-orange-400">
                  <Icon className="h-5 w-5" aria-hidden />
                </span>
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-gray-100">{title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-gray-600 dark:text-gray-400">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
          <h2 className="text-lg font-extrabold text-gray-900 dark:text-gray-100">Exams Available</h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-700 dark:text-gray-300">
            We currently focus on TNPSC Group 2/2A and TNPSC Group 4 examinations, with plans to expand our offerings to other
            government competitive examinations.
          </p>
        </section>

        <div className="grid gap-4 sm:grid-cols-2">
          <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-2 flex items-center gap-2">
              <Target className="h-4 w-4 text-orange-600 dark:text-orange-400" aria-hidden />
              <h2 className="text-lg font-extrabold text-gray-900 dark:text-gray-100">Our Mission</h2>
            </div>
            <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
              To make government exam preparation more accessible, structured, and effective through technology-driven learning
              and personalized guidance.
            </p>
          </section>
          <section className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-2 flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-orange-600 dark:text-orange-400" aria-hidden />
              <h2 className="text-lg font-extrabold text-gray-900 dark:text-gray-100">Our Vision</h2>
            </div>
            <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
              To become a trusted one-stop preparation platform for government job aspirants across India.
            </p>
          </section>
        </div>

        <section className="rounded-2xl bg-gray-900 p-6 text-white sm:p-8">
          <p className="text-lg font-extrabold">Your Preparation. Your Progress. Your Success.</p>
          <p className="mt-2 text-sm leading-relaxed text-gray-300">
            Whether you are starting your preparation or revising before an examination, My Gov Exams helps you practice smarter,
            understand better, and move closer to your goals.
          </p>
          <p className="mt-4 text-sm font-semibold text-orange-300">Start your preparation today at www.mygovexams.com.</p>
        </section>
      </div>
    </UserShell>
  );
}

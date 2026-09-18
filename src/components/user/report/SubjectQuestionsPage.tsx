/**
 * "Question Insights (Subject-wise)" (mockup screen 4), reached from a subject's
 * Deep Dive screen ("Open the N questions" link, or its Question Insights tab).
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Landmark, Lightbulb, Search } from 'lucide-react';
import type { AttemptReportModel, SubjectNode } from '@/lib/attempt-report';
import type { QuestionReviewItem } from '@/lib/userPortalApi';
import { ReportCard, subjectHue } from '@/components/user/report-ui';
import { cn } from '@/lib/utils';

type ResultFilter = 'all' | 'correct' | 'incorrect' | 'skipped';

export function isAttempted(q: QuestionReviewItem): boolean {
  return q.user_answer != null && String(q.user_answer).trim() !== '';
}

/** The single-letter answer the mockup shows, however the raw value arrived —
 * already a letter, a numeric option index, or the option's own text. */
export function answerLetter(key: string | null, options: string[] | null): string {
  if (key == null || String(key).trim() === '') return '—';
  const k = String(key).trim();
  if (options?.length) {
    const byLetter = k.length === 1 ? k.toUpperCase().charCodeAt(0) - 65 : -1;
    if (byLetter >= 0 && byLetter < options.length) return k.toUpperCase();
    const idx = Number(k);
    if (Number.isFinite(idx) && options[idx] != null) return String.fromCharCode(65 + idx);
    const matchIdx = options.findIndex(o => o === k);
    if (matchIdx >= 0) return String.fromCharCode(65 + matchIdx);
  }
  return k.length <= 2 ? k.toUpperCase() : `${k.slice(0, 1).toUpperCase()}…`;
}

function stripHtml(s: string): string {
  return (s ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export function SubjectQuestionsPage({ model, subject }: { model: AttemptReportModel; subject: SubjectNode }) {
  const navigate = useNavigate();
  const attemptId = model.meta.attemptId;
  const index = model.subjects.findIndex(s => s.subjectId === subject.subjectId);

  const [topic, setTopic] = useState('all');
  const [result, setResult] = useState<ResultFilter>('all');
  const [search, setSearch] = useState('');

  const questions = useMemo(
    () => model.questions.filter(q => subject.questionIds.includes(q.question_id)),
    [model.questions, subject.questionIds],
  );

  const topicOptions = useMemo(() => {
    const names = new Set<string>();
    for (const t of subject.topics) names.add(t.name);
    return [...names];
  }, [subject.topics]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return questions.filter(item => {
      if (topic !== 'all' && (item.topic ?? '') !== topic) return false;
      if (result === 'correct' && !(isAttempted(item) && item.is_correct)) return false;
      if (result === 'incorrect' && !(isAttempted(item) && !item.is_correct)) return false;
      if (result === 'skipped' && isAttempted(item)) return false;
      if (q && !stripHtml(item.body).toLowerCase().includes(q)) return false;
      return true;
    });
  }, [questions, topic, result, search]);

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
      <button
        onClick={() => navigate(`/user/report/${attemptId}/subjects/${subject.subjectId}`)}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Subject
      </button>

      <ReportCard className="flex items-center gap-3">
        <span
          className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-white"
          style={{ background: subjectHue(Math.max(index, 0)) }}
        >
          <Landmark className="w-5 h-5" />
        </span>
        <p className="text-lg font-extrabold text-[#1e2a5a] dark:text-gray-100">{subject.name}</p>
      </ReportCard>

      <ReportCard>
        <div className="flex flex-wrap items-center gap-2.5 mb-3">
          <select
            value={topic}
            onChange={e => setTopic(e.target.value)}
            className="text-[12px] font-medium rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-gray-700 dark:text-gray-200"
          >
            <option value="all">All Topics</option>
            {topicOptions.map(t => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            value={result}
            onChange={e => setResult(e.target.value as ResultFilter)}
            className="text-[12px] font-medium rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2.5 py-1.5 text-gray-700 dark:text-gray-200"
          >
            <option value="all">All Results</option>
            <option value="correct">Correct</option>
            <option value="incorrect">Incorrect</option>
            <option value="skipped">Skipped</option>
          </select>
          <div className="relative flex-1 min-w-[160px]">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search questions..."
              className="w-full text-[12px] rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 pl-8 pr-2.5 py-1.5 text-gray-700 dark:text-gray-200 placeholder:text-gray-400"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <p className="text-[12px] text-gray-400 py-6 text-center">No questions match these filters.</p>
        ) : (
          <div className="overflow-x-auto -mx-4 sm:-mx-5">
            <table className="w-full text-[11px] min-w-[560px]">
              <thead>
                <tr className="bg-indigo-50/60 dark:bg-indigo-950/25 text-left">
                  <th className="px-3 py-2 font-semibold text-[#1e2a5a] dark:text-gray-300">Q No.</th>
                  <th className="px-3 py-2 font-semibold text-[#1e2a5a] dark:text-gray-300">Topic</th>
                  <th className="px-3 py-2 font-semibold text-[#1e2a5a] dark:text-gray-300">Your Answer</th>
                  <th className="px-3 py-2 font-semibold text-[#1e2a5a] dark:text-gray-300">Correct Answer</th>
                  <th className="px-3 py-2 font-semibold text-[#1e2a5a] dark:text-gray-300">Result</th>
                  <th className="px-3 py-2 font-semibold text-[#1e2a5a] dark:text-gray-300">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(q => {
                  const attempted = isAttempted(q);
                  return (
                    <tr key={q.question_id} className="border-b border-gray-50 dark:border-gray-800/60">
                      <td className="px-3 py-2 text-gray-600 dark:text-gray-300">{q.number}</td>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-200 truncate max-w-[9rem]" title={q.topic ?? ''}>
                        {q.topic ?? '—'}
                      </td>
                      <td className="px-3 py-2 font-semibold text-gray-700 dark:text-gray-200">
                        {answerLetter(q.user_answer, q.options)}
                      </td>
                      <td className="px-3 py-2 font-semibold text-gray-700 dark:text-gray-200">
                        {answerLetter(q.correct_answer, q.options)}
                      </td>
                      <td
                        className={cn(
                          'px-3 py-2 font-bold',
                          !attempted
                            ? 'text-gray-400'
                            : q.is_correct
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400',
                        )}
                      >
                        {!attempted ? 'Skipped' : q.is_correct ? 'Correct' : 'Incorrect'}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() =>
                            navigate(`/user/report/${attemptId}/subjects/${subject.subjectId}/questions/${q.question_id}`)
                          }
                          className="text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 bg-white dark:bg-gray-900 rounded-lg px-2.5 py-1 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </ReportCard>

      <div className="rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900 p-3.5">
        <p className="inline-flex items-center gap-1.5 text-[12px] font-bold text-indigo-700 dark:text-indigo-300 mb-2">
          <Lightbulb className="w-3.5 h-3.5" /> What can you do here?
        </p>
        <ul className="space-y-1 text-[11px] text-indigo-900/80 dark:text-indigo-200">
          <li>• See all questions from this subject.</li>
          <li>• Filter by correct/incorrect and topic.</li>
          <li>• Click 'View' to see detailed explanation and learning points.</li>
        </ul>
      </div>
    </div>
  );
}

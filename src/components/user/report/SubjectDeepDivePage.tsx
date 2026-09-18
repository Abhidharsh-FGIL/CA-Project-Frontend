/**
 * "Subject Deep Dive" (mockup screen 3), reached from a subject row on the
 * Overview/All Subjects screens.
 *
 * The Topic Analysis tab is built fresh to match the mockup's compact 6-column
 * table exactly (# / Topic-Subtopic / Qns / Correct / Accuracy / AI Analysis) —
 * visually different enough from the existing 9-column admin table
 * (`AttemptDiagnosticReport.tsx`'s inline `SubjectDeepDive`) that reusing it
 * wholesale wouldn't match. Question Insights and Comparison & Trends (kept per
 * the approved plan, beyond what the mockup itself shows) reuse the same helpers
 * the existing inline version uses — `topicNarrative`/`comparisonNarrative`/
 * `STATUS_TONE`/`CONFIDENCE_TONE` are now exported from AttemptDiagnosticReport.tsx
 * for exactly this reuse, so there is still only one definition of each.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Landmark, Lightbulb } from 'lucide-react';
import type { AttemptReportModel, SubjectNode, TopicNode } from '@/lib/attempt-report';
import { ISSUE_LABEL } from '@/lib/attempt-report';
import {
  isOtherNode,
  topicAiAnalysis,
  topicNarrative,
  comparisonNarrative,
  CONFIDENCE_TONE,
} from '@/components/user/AttemptDiagnosticReport';
import { ReportCard, StatTile, UnderlineTabs, MeterRow, WhatThisMeans, NotAvailable, subjectHue } from '@/components/user/report-ui';
import { cn } from '@/lib/utils';

type DiveTab = 'topics' | 'questions' | 'trends';

export function SubjectDeepDivePage({ model, subject }: { model: AttemptReportModel; subject: SubjectNode }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<DiveTab>('topics');
  const m = subject.metrics;
  const attemptId = model.meta.attemptId;
  const index = model.subjects.findIndex(s => s.subjectId === subject.subjectId);

  // Flatten to one level for the mockup's flat, numbered table — a topic with
  // sub-topics is represented by its sub-topics, not by itself and its children.
  const rows: TopicNode[] = subject.topics.flatMap(t => (t.subtopics.length > 0 ? t.subtopics : [t]));
  const diagnosisBullets = subject.diagnosis.split(/(?<=[.!?])\s+/).filter(Boolean);

  const tabs: Array<{ value: DiveTab; label: string }> = [
    { value: 'topics', label: 'Topic Analysis' },
    { value: 'questions', label: 'Question Insights' },
    { value: 'trends', label: 'Comparison & Trends' },
  ];

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
      <button
        onClick={() => navigate(`/user/report/${attemptId}`)}
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
      >
        <ArrowLeft className="w-4 h-4" /> Back to Report
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

      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5">
        <StatTile value={m.questions} label="Questions" accent="indigo" />
        <StatTile value={m.attempted} label="Attempted" accent="violet" />
        <StatTile value={m.correct} label="Correct" accent="emerald" />
        <StatTile value={m.incorrect} label="Incorrect" accent="rose" />
        <StatTile value={m.skipped} label="Skipped" accent="slate" />
        <StatTile
          value={m.accuracy == null ? '—' : `${m.accuracy}%`}
          label="Accuracy"
          accent={m.accuracy == null ? 'slate' : m.accuracy >= 70 ? 'emerald' : m.accuracy >= 40 ? 'amber' : 'rose'}
          emphasis
        />
      </div>

      <ReportCard>
        <UnderlineTabs<DiveTab> value={tab} onChange={setTab} options={tabs} />

        <div className="pt-3">
          {tab === 'topics' &&
            (rows.length > 0 ? (
              <>
                <p className="text-[12px] font-bold text-gray-700 dark:text-gray-200 mb-2">Topic &amp; Sub-topic Performance</p>
                <div className="overflow-x-auto -mx-4 sm:-mx-5">
                  <table className="w-full text-[11px] min-w-[520px]">
                    <thead>
                      <tr className="bg-indigo-50/60 dark:bg-indigo-950/25 text-left">
                        <th className="px-3 py-2 font-semibold text-[#1e2a5a] dark:text-gray-300 w-8">#</th>
                        <th className="px-3 py-2 font-semibold text-[#1e2a5a] dark:text-gray-300">Topic / Sub-topic</th>
                        <th className="px-3 py-2 font-semibold text-[#1e2a5a] dark:text-gray-300 text-right">Qns</th>
                        <th className="px-3 py-2 font-semibold text-[#1e2a5a] dark:text-gray-300 text-right">Correct</th>
                        <th className="px-3 py-2 font-semibold text-[#1e2a5a] dark:text-gray-300 text-right">Accuracy</th>
                        <th className="px-3 py-2 font-semibold text-[#1e2a5a] dark:text-gray-300">AI Analysis</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((node, i) => (
                        <tr key={node.topicId} className="border-b border-gray-50 dark:border-gray-800/60">
                          <td className="px-3 py-2 text-gray-400">{i + 1}</td>
                          <td
                            className={cn(
                              'px-3 py-2 truncate max-w-[10rem]',
                              isOtherNode(node)
                                ? 'italic text-gray-400 dark:text-gray-500'
                                : 'font-semibold text-gray-900 dark:text-gray-100',
                            )}
                            title={node.name}
                          >
                            {node.name}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-gray-600 dark:text-gray-300">
                            {node.metrics.questions}
                          </td>
                          <td className="px-3 py-2 text-right tabular-nums text-emerald-600 dark:text-emerald-400">
                            {node.metrics.correct}
                          </td>
                          <td
                            className={cn(
                              'px-3 py-2 text-right tabular-nums font-bold',
                              node.metrics.accuracy == null
                                ? 'text-gray-400 font-normal'
                                : node.metrics.accuracy >= 70
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : node.metrics.accuracy >= 40
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-rose-600 dark:text-rose-400',
                            )}
                          >
                            {node.metrics.accuracy == null ? '—' : `${node.metrics.accuracy}%`}
                          </td>
                          <td className="px-3 py-2 text-indigo-700 dark:text-indigo-300">{topicAiAnalysis(node, i)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <WhatThisMeans>{topicNarrative(subject)}</WhatThisMeans>

                <div className="mt-4 rounded-2xl bg-indigo-50/70 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900 p-3.5">
                  <p className="inline-flex items-center gap-1.5 text-[12px] font-bold text-indigo-700 dark:text-indigo-300 mb-2">
                    <Lightbulb className="w-3.5 h-3.5" /> AI Diagnosis for this Subject
                  </p>
                  <ul className="space-y-1">
                    {diagnosisBullets.map((b, i) => (
                      <li key={i} className="flex items-start gap-2 text-[11px] text-indigo-900/80 dark:text-indigo-200">
                        <span className="flex-shrink-0 mt-1.5 w-1 h-1 rounded-full bg-indigo-400" />
                        {b}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <p className="text-[11px] leading-relaxed text-gray-700 dark:text-gray-200">{subject.diagnosis}</p>
                <NotAvailable reason="No question in this subject carries a topic tag, so the breakdown stops at subject level." />
              </div>
            ))}

          {tab === 'questions' && (
            <div className="space-y-2.5">
              <p className="text-[11px] leading-relaxed text-gray-700 dark:text-gray-200">{subject.diagnosis}</p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Main issue: <span className="font-semibold">{ISSUE_LABEL[subject.primaryIssue]}</span>
              </p>
              <p className={cn('text-[11px]', CONFIDENCE_TONE[subject.confidence])}>
                {subject.confidence === 'HIGH'
                  ? 'Enough questions here to read these figures as reliable.'
                  : subject.confidence === 'MEDIUM'
                    ? 'A small set of questions — read these figures as an early signal, not a settled level.'
                    : 'Too few questions answered here to draw a conclusion yet.'}
              </p>
              {m.questions > 0 && (
                <button
                  type="button"
                  onClick={() => navigate(`/user/report/${attemptId}/subjects/${subject.subjectId}/questions`)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Open the {m.questions} {subject.name} questions
                  <ArrowRight className="w-3 h-3" />
                </button>
              )}
            </div>
          )}

          {tab === 'trends' && (
            <div className="space-y-3">
              <div className="space-y-2">
                <MeterRow
                  label={`${subject.name} accuracy`}
                  value={m.accuracy}
                  right={m.accuracy == null ? 'Not assessed' : `${m.accuracy}%`}
                />
                <MeterRow
                  label="Whole paper accuracy"
                  value={model.summary.accuracy}
                  right={model.summary.accuracy == null ? 'Not assessed' : `${model.summary.accuracy}%`}
                />
                <MeterRow
                  label={`${subject.name} coverage`}
                  value={m.coverage}
                  right={`${m.attempted} of ${m.questions} reached`}
                />
                <MeterRow
                  label="Whole paper coverage"
                  value={model.summary.attemptRate}
                  right={`${model.summary.attempted} of ${model.summary.totalQuestions} reached`}
                />
              </div>
              <WhatThisMeans>{comparisonNarrative(subject, model)}</WhatThisMeans>
            </div>
          )}
        </div>
      </ReportCard>
    </div>
  );
}

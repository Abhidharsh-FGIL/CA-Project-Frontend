import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { HistoryUser, HistoryUserDetail } from '@/lib/adminHistoryApi';

/** The shell needs the signed-in admin; these pages are about what is inside it. */
vi.mock('@/components/layout/GenVerseShell', () => ({ GenVerseShell: ({ children }: any) => <div>{children}</div> }));
vi.mock('@/components/layout/AppShell', () => ({
  PageHeader: ({ title, actions }: any) => (
    <div>
      <h1>{title}</h1>
      {actions}
    </div>
  ),
}));
vi.mock('@/components/evaluation/EvalReportsList', () => ({ EvalReportsList: () => <div>ASSESSMENT-LIST</div> }));
vi.mock('@/components/evaluation/EvalAssessmentReport', () => ({
  EvalAssessmentReport: ({ assessmentId }: any) => <div>ASSESSMENT-REPORT-{assessmentId}</div>,
  AttemptDetailView: ({ assessmentId, attemptId }: any) => (
    <div>
      ATTEMPT-VIEW-{assessmentId}-{attemptId}
    </div>
  ),
}));

const user: HistoryUser = {
  user_id: 'u1',
  name: 'Priya',
  email: 'priya@gmail.com',
  phone: '9800000000',
  subscription_tier: 'ultimate',
  joined_at: '2026-09-02T10:15:00',
  mock_attempts: 4,
  practice_attempts: 27,
  total_attempts: 31,
  last_attempt_at: '2026-10-22T19:40:11+05:30',
  promo_codes_used: ['DIWALI50', 'FREEMOCK'],
};

const detail: HistoryUserDetail = {
  ...user,
  attempts: [
    {
      attempt_id: 'a1',
      test_id: 't1',
      source: 'test',
      test_name: 'Group 4 Full Mock 1',
      mode: 'mock',
      status: 'submitted',
      start_time: '2026-10-22T19:40:11+05:30',
      end_time: '2026-10-22T22:40:02+05:30',
      time_taken_seconds: 10791,
      score: 142.5,
      percentage: 71.25,
      auto_submitted: false,
    },
    {
      attempt_id: 'a2',
      test_id: 't2',
      source: 'assessment',
      test_name: 'இலக்கணம்',
      mode: 'practice',
      status: 'in_progress',
      start_time: '2026-10-22T10:00:00+05:30',
      end_time: null,
      time_taken_seconds: null,
      score: null,
      percentage: null,
      auto_submitted: false,
    },
  ],
  promo_redemptions: [{ code: 'DIWALI50', scope: 'subscription', discount_pct: 50, redeemed_at: '2026-10-20T11:02:00' }],
};

let listData: any = { items: [user], total: 1, page: 1, limit: 20, pages: 1 };
let detailData: any = detail;

vi.mock('@/hooks/use-admin-history', () => ({
  useAdminHistoryUsers: () => ({ data: listData, isLoading: false, isFetching: false, isError: false, error: null, refetch: () => {} }),
  useAdminHistoryUser: () => ({ data: detailData, isLoading: false, isFetching: false, isError: false, error: null }),
}));

// Where each assessment sits, as the Evaluation Hub's list says: a Group 2 practice set in Unit II of Aptitude.
vi.mock('@/hooks/use-eval-assessments', () => ({
  useEvalAssessments: () => ({
    data: [{ id: 'asmt-g2', title: 'TNPSC Group 2 Prelims — Reasoning · Mixed', group_id: 'group-2', stage_id: 'group-2-prelims', track: 'practice', scope: 'unit', unit_id: 'g2-apt-reasoning' }],
  }),
}));

import AdminHistoryPage from '@/pages/org/AdminHistoryPage';
import AdminUserHistoryPage from '@/pages/org/AdminUserHistoryPage';

const list = (url = '/org/history') =>
  renderToStaticMarkup(
    <MemoryRouter initialEntries={[url]}>
      <AdminHistoryPage />
    </MemoryRouter>,
  );
const page = (url = '/org/history/u1') =>
  renderToStaticMarkup(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/org/history/:userId" element={<AdminUserHistoryPage />} />
      </Routes>
    </MemoryRouter>,
  );

describe('Admin → User History list', () => {
  it('has the columns the handoff asks for', () => {
    const html = list();
    for (const h of ['Name', 'Email', 'Mock attended', 'Practice attended', 'Last attempt', 'Promo codes used', 'View']) {
      expect(html).toContain(h);
    }
  });

  it('shows the person, their counts, the last attempt in IST and their promo codes', () => {
    const html = list();
    expect(html).toContain('Priya');
    expect(html).toContain('priya@gmail.com');
    expect(html).toContain('22 Oct 2026, 7:40 PM');
    expect(html).toContain('DIWALI50');
    expect(html).toContain('FREEMOCK');
  });

  it('shows a dash for a user who never attended a test and used no code', () => {
    listData = { ...listData, items: [{ ...user, last_attempt_at: null, promo_codes_used: [], mock_attempts: 0, practice_attempts: 0, total_attempts: 0 }] };
    const html = list();
    expect(html).toContain('—');
    expect(html).not.toContain('null');
    listData = { items: [user], total: 1, page: 1, limit: 20, pages: 1 };
  });

  it('says so when nobody matches', () => {
    listData = { items: [], total: 0, page: 1, limit: 20, pages: 1 };
    expect(list()).toContain('No users');
    listData = { items: [user], total: 1, page: 1, limit: 20, pages: 1 };
  });
});

describe('Admin → one user’s history', () => {
  it('has the header, the tests table and the promo table', () => {
    const html = page();
    expect(html).toContain('Priya');
    expect(html).toContain('9800000000');
    expect(html).toContain('Tests attended');
    expect(html).toContain('Promo codes used');
    for (const tab of ['All', 'Mock', 'Practice']) expect(html).toContain(`>${tab}<`);
  });

  it('shows each attempt’s time taken, score, percentage and status in the handoff’s words', () => {
    const html = page();
    expect(html).toContain('Group 4 Full Mock 1');
    expect(html).toContain('2h 59m');
    expect(html).toContain('142.5');
    expect(html).toContain('71.3%');
    expect(html).toContain('Completed');
    expect(html).toContain('In progress');
  });

  it('shows dashes, not nulls, for the attempt still in progress', () => {
    const html = page();
    expect(html).not.toContain('null');
    expect(html).not.toContain('NaN');
  });

  it('shows the promo redemption with its type, discount and date', () => {
    const html = page();
    expect(html).toContain('Subscription');
    expect(html).toContain('50%');
    expect(html).toContain('20 Oct 2026, 11:02 AM');
  });

  it('says when there is nothing to list', () => {
    detailData = { ...detail, attempts: [], promo_redemptions: [] };
    const html = page();
    expect(html).toContain('has not attended any test');
    expect(html).toContain('No promo codes used');
    detailData = detail;
  });
});

describe('Admin → History: by user or by assessment', () => {
  it('offers both, and opens on the user view', () => {
    const html = list();
    expect(html).toContain('By user');
    expect(html).toContain('By assessment');
    expect(html).toContain('Priya');
    expect(html).not.toContain('ASSESSMENT-LIST');
  });

  it('shows the assessments, and not the users, in the assessment view', () => {
    const html = list('/org/history?view=assessment');
    expect(html).toContain('ASSESSMENT-LIST');
    expect(html).not.toContain('priya@gmail.com');
  });

  it('opens an assessment’s results from the address, so Back and a shared link land on it', () => {
    const html = list('/org/history?view=assessment&assessment=abc');
    expect(html).toContain('ASSESSMENT-REPORT-abc');
    expect(html).not.toContain('ASSESSMENT-LIST');
  });

  it('ignores an assessment id when the user view is chosen', () => {
    expect(list('/org/history?assessment=abc')).not.toContain('ASSESSMENT-REPORT-abc');
  });
});

describe('Admin → one user’s history: assessment attempts', () => {
  const withAssessment = () => {
    detailData = {
      ...detail,
      attempts: [
        { ...detail.attempts[0], attempt_id: 'x1', test_id: 'asmt-1', source: 'assessment', test_name: 'TNPSC Group 4 — Mock' },
        { ...detail.attempts[0], attempt_id: 'x2', test_id: 'test-2', source: 'test', test_name: 'Plain test' },
        { ...detail.attempts[1], attempt_id: 'x3', test_id: 'asmt-3', source: 'assessment', test_name: 'Unfinished assessment' },
      ],
    };
  };
  const reset = () => (detailData = detail);

  it('offers a Report only for a finished assessment attempt', () => {
    withAssessment();
    const html = page();
    expect(html).toContain('Report');
    // One button: the finished assessment. The plain test and the in-progress assessment get a dash.
    expect(html.match(/>\s*Report\s*</g)?.length ?? 0).toBeGreaterThan(0);
    expect((html.match(/<button[^>]*>(?:(?!<\/button>).)*Report<\/button>/g) ?? []).length).toBe(1);
    reset();
  });

  it('opens that attempt’s report from the address', () => {
    withAssessment();
    const html = page('/org/history/u1?assessment=asmt-1&attempt=x1');
    expect(html).toContain('ATTEMPT-VIEW-asmt-1-x1');
    expect(html).not.toContain('Tests attended');
    reset();
  });

  it('still lists attempts from a server that does not say where they came from', () => {
    const { source: _s, ...bare } = detail.attempts[0];
    void _s;
    detailData = { ...detail, attempts: [bare] };
    const html = page();
    expect(html).toContain('Group 4 Full Mock 1');
    expect((html.match(/<button[^>]*>(?:(?!<\/button>).)*Report<\/button>/g) ?? []).length).toBe(0);
    reset();
  });
});

describe('Admin → one user’s history: where each test sits', () => {
  it('names the unit under the test, and drops the exam prefix from the name', () => {
    detailData = {
      ...detail,
      attempts: [{ ...detail.attempts[0], attempt_id: 'g1', test_id: 'asmt-g2', source: 'assessment', test_name: 'TNPSC Group 2 Prelims — Reasoning · Mixed' }],
    };
    const html = page();
    expect(html).toContain('>Reasoning · Mixed<');
    expect(html).toContain('TNPSC Group 2 · Aptitude &amp; Mental Ability › Unit II · Reasoning');
    detailData = detail;
  });
});

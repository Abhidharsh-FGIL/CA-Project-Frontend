import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '@/lib/adminApi';
import {
  type AdminMetric,
  type AdminRecentTest,
  type DailyAttempts,
  type SubscriptionDistribution,
  type TopCourse,
} from '@/data/adminDashboardSampleData';

// ─── Metrics / Stats ───────────────────────────────────────────────────────

function buildMetrics(m: {
  total_questions: number;
  total_papers: number;
  active_tests: number;
  total_users: number;
  active_subscriptions: number;
  total_attempts_month: number;
}): AdminMetric[] {
  return [
    { key: 'questions', label: 'Questions in Bank', value: m.total_questions, displayValue: m.total_questions.toLocaleString('en-IN'), icon: 'bank', tone: 'indigo' },
    { key: 'papers', label: 'Total Collections', value: m.total_papers, displayValue: m.total_papers.toLocaleString('en-IN'), icon: 'paper', tone: 'blue' },
    { key: 'tests', label: 'Active Tests', value: m.active_tests, displayValue: m.active_tests.toLocaleString('en-IN'), icon: 'test', tone: 'amber' },
    { key: 'users', label: 'Total Users', value: m.total_users, displayValue: m.total_users.toLocaleString('en-IN'), icon: 'users', tone: 'rose' },
    { key: 'subscriptions', label: 'Active Subscriptions', value: m.active_subscriptions, displayValue: m.active_subscriptions.toLocaleString('en-IN'), icon: 'subscription', tone: 'emerald' },
    { key: 'attempts', label: 'Attempts This Month', value: m.total_attempts_month, displayValue: m.total_attempts_month.toLocaleString('en-IN'), icon: 'attempts', tone: 'purple' },
  ];
}

const ZERO_METRICS = buildMetrics({
  total_questions: 0,
  total_papers: 0,
  active_tests: 0,
  total_users: 0,
  active_subscriptions: 0,
  total_attempts_month: 0,
});

export function useDashboardMetrics(): AdminMetric[] {
  const { data } = useQuery({
    queryKey: ['admin-dashboard-metrics'],
    queryFn: () => dashboardApi.getMetrics(),
    staleTime: 2 * 60 * 1000,
  });
  if (!data) return ZERO_METRICS;
  return buildMetrics(data);
}

// ─── Subscription distribution ─────────────────────────────────────────────

export function useDashboardSubscriptions(): SubscriptionDistribution[] {
  const { data } = useQuery({
    queryKey: ['admin-dashboard-subscription-dist'],
    queryFn: () => dashboardApi.getSubscriptionDistribution(),
    staleTime: 2 * 60 * 1000,
  });
  if (!data) return [];
  return data.distribution as SubscriptionDistribution[];
}

// ─── Recent tests ──────────────────────────────────────────────────────────

export function useDashboardRecentTests(): AdminRecentTest[] {
  const { data } = useQuery({
    queryKey: ['admin-dashboard-recent-tests'],
    queryFn: () => dashboardApi.getRecentTests(5),
    staleTime: 2 * 60 * 1000,
  });
  if (!data) return [];
  return data.items.map(t => ({
    test_id: t.test_id,
    name: t.name,
    course: t.course,
    mode: t.mode,
    link_token: t.link_token,
    created_at: t.created_at,
    attempts_count: t.attempts_count,
    promo_code: t.promo_code ?? undefined,
    status: t.status as 'active' | 'archived',
  }));
}

// ─── Daily attempts ────────────────────────────────────────────────────────

export function useDashboardDailyAttempts(): DailyAttempts[] {
  const { data } = useQuery({
    queryKey: ['admin-dashboard-daily-attempts'],
    queryFn: () => dashboardApi.getDailyAttempts(7),
    staleTime: 2 * 60 * 1000,
  });
  if (!data) return [];
  return data.buckets.map(b => ({
    date: b.date,
    label: b.label,
    practice: b.practice,
    mock: b.mock,
  }));
}

// ─── Recent attempts ───────────────────────────────────────────────────────

export function useDashboardRecentAttempts() {
  return useQuery({
    queryKey: ['admin-dashboard-recent-attempts'],
    queryFn: () => dashboardApi.getRecentAttempts(10),
    staleTime: 60 * 1000,
  });
}

// ─── Top courses ───────────────────────────────────────────────────────────

export function useDashboardTopCourses(): TopCourse[] {
  const { data } = useQuery({
    queryKey: ['admin-dashboard-top-courses'],
    queryFn: () => dashboardApi.getTopCourses(5),
    staleTime: 2 * 60 * 1000,
  });
  if (!data) return [];
  return data.items.map(c => ({
    course_id: c.course_id,
    name: c.name,
    attempts: c.attempts,
    avg_score: c.avg_score,
  }));
}

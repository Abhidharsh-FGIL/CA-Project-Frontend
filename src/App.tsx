import React from "react";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { toast } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HashRouter, Routes, Route, Navigate, useLocation, Link, Outlet } from "react-router-dom";
import { getToken } from "@/lib/api";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { WorkspaceProvider } from "@/contexts/WorkspaceContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { AIContextProvider } from "@/contexts/AIContextProvider";
import { EvaluationHubPage } from "@/pages/org/EvaluationHubPage";
import AdminLoginPage from "@/pages/org/AdminLoginPage";
import AdminDashboardPage from "@/pages/org/AdminDashboardPage";
import AdminPaymentsPage from "@/pages/org/AdminPaymentsPage";
import AdminCoursesPage from "@/pages/org/AdminCoursesPage";
import AdminPromosPage from "@/pages/org/AdminPromosPage";
import AdminPlansPage from "@/pages/org/AdminPlansPage";
import AdminUsersPage from "@/pages/org/AdminUsersPage";
import AdminAuditPage from "@/pages/org/AdminAuditPage";
import AdminSettingsPage from "@/pages/org/AdminSettingsPage";
import { EvalPaperDetailPage } from "@/components/evaluation/EvalPaperDetailPage";
import { EvalGeneratingPage } from "@/pages/org/EvalGeneratingPage";
import TakeAssessmentPage from "@/pages/TakeAssessmentPage";
import { UserPortalProvider, useUserPortal } from "@/contexts/UserPortalContext";
import LoginPage from "@/pages/user/LoginPage";
import RegisterPage from "@/pages/user/RegisterPage";
import ResetPasswordPage from "@/pages/user/ResetPasswordPage";
import UserDashboardPage from "@/pages/user/UserDashboardPage";
import CourseListPage from "@/pages/user/CourseListPage";
import CourseDetailPage from "@/pages/user/CourseDetailPage";
import TestStartPage from "@/pages/user/TestStartPage";
import UserHistoryPage from "@/pages/user/UserHistoryPage";
import UserReportPage from "@/pages/user/UserReportPage";
import UserProfilePage from "@/pages/user/UserProfilePage";
import SubscriptionPage from "@/pages/user/SubscriptionPage";
import NotificationsPage from "@/pages/user/NotificationsPage";
import PaymentHistoryPage from "@/pages/user/PaymentHistoryPage";
import { UserEvalAssessmentPage } from "@/pages/user/UserEvalAssessmentPage";
import TestTakingPage from "@/pages/user/TestTakingPage";
import TestReadyPage from "@/pages/user/TestReadyPage";
import TnpscGroupsPage from "@/pages/user/TnpscGroupsPage";
import TnpscGroupPage from "@/pages/user/TnpscGroupPage";
import TnpscStagePage from "@/pages/user/TnpscStagePage";
import UserTrackPage from "@/pages/user/UserTrackPage";
import UserPerformancePage from "@/pages/user/UserPerformancePage";
import UserProgressPage from "@/pages/user/UserProgressPage";
import UserStudyPlanPage from "@/pages/user/UserStudyPlanPage";
import UserSavedPage from "@/pages/user/UserSavedPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnMount: 'always',
      refetchOnWindowFocus: false,
    },
    mutations: {
      onError: (error: Error) => {
        toast.error(error.message || 'Something went wrong. Please try again.');
      },
    },
  },
});

function AdminGuard() {
  return getToken() ? <Outlet /> : <Navigate to="/adminlogin" replace />;
}

/** Protects all authenticated user-portal routes.
 *  - While session-restore is in progress  → show a spinner (token exists, profile not yet loaded)
 *  - Authenticated                          → render the child route
 *  - Not authenticated                      → redirect to /user/login
 */
function UserGuard() {
  const { isAuthenticated, isLoading } = useUserPortal();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[100dvh] bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-100 dark:from-slate-950 dark:via-indigo-950/60 dark:to-purple-950/60">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
          <p className="text-sm text-gray-500 dark:text-gray-400">Loading…</p>
        </div>
      </div>
    );
  }

  return isAuthenticated ? <Outlet /> : <Navigate to="/user/login" replace />;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  React.useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

function HomePage() {
  return (
    <div className="h-[100dvh] overflow-y-auto flex items-start sm:items-center justify-center bg-gradient-to-br from-orange-50 via-amber-50 to-rose-100 dark:from-stone-950 dark:via-orange-950/50 dark:to-rose-950/40 p-4 sm:p-6 lg:p-8 py-6 sm:py-8 relative">
      <div className="absolute top-1/4 -left-20 w-80 h-80 bg-amber-300/30 dark:bg-amber-700/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-orange-300/30 dark:bg-orange-700/20 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-3xl w-full space-y-5 sm:space-y-6 relative z-10 animate-fadeIn">
        <div className="text-center md:text-left">
          <span className="inline-block bg-white/70 dark:bg-gray-900/70 backdrop-blur border border-orange-100 dark:border-orange-900 text-orange-700 dark:text-orange-300 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full shadow-sm animate-slideUp">
            ✨ AI-Powered · Govt Exam Prep
          </span>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold mt-3 text-gray-900 dark:text-gray-100 animate-slideUp stagger-1">
            BrightLearn <span className="gradient-text-animated">Academy</span>
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 mt-3 animate-slideUp stagger-2">
            UPSC · SSC · Banking · Railways · State PSC — mock tests, practice papers & smart performance reports.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
          <Link
            to="/user/login"
            className="group block p-5 sm:p-6 rounded-2xl border-2 border-orange-500 dark:border-orange-400 bg-white/80 dark:bg-gray-900/80 backdrop-blur hover:bg-white dark:hover:bg-gray-900 hover:shadow-xl hover:shadow-orange-200 dark:hover:shadow-orange-900/40 transition-all duration-300 animate-slideUp stagger-3 hover-lift card-shine relative overflow-hidden"
          >
            <div className="absolute -top-12 -right-12 w-32 h-32 bg-orange-300/30 dark:bg-orange-700/30 rounded-full blur-2xl group-hover:scale-150 transition-transform duration-500" />
            <h2 className="text-lg sm:text-xl font-bold relative">
              <span className="gradient-text">Aspirant Portal</span>
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1 relative">
              Aspirant portal: join your batches, attempt mock tests & practice papers across all subjects, and view AI-powered performance reports.
            </p>
            <p className="text-xs text-orange-600 dark:text-orange-400 mt-2 font-semibold relative inline-flex items-center gap-1">
              Login or register
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </p>
          </Link>
          <Link
            to="/adminlogin"
            className="group block p-5 sm:p-6 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur hover:border-orange-300 dark:hover:border-orange-700 hover:shadow-lg hover:shadow-orange-100/50 dark:hover:shadow-orange-900/30 transition-all duration-300 animate-slideUp stagger-4 hover-lift"
          >
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100">Admin Dashboard</h2>
            <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mt-1">
              Platform overview, recent attempts, subscription mix, and quick links to question bank, tests & reports.
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 font-semibold inline-flex items-center gap-1">
              Open dashboard
              <span className="group-hover:translate-x-1 transition-transform">→</span>
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}

function UserPortalRoutes() {
  return (
    <UserPortalProvider>
      <Routes>
        {/* Public user routes — accessible without a token */}
        <Route index element={<Navigate to="/user/login" replace />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="reset-password" element={<ResetPasswordPage />} />

        {/* Protected user routes — UserGuard redirects to /user/login if not authenticated */}
        <Route element={<UserGuard />}>
          <Route path="dashboard" element={<UserDashboardPage />} />
          {/* TNPSC hierarchy: groups → stages → mock/practice tracks */}
          <Route path="exams" element={<TnpscGroupsPage />} />
          <Route path="exams/:groupId" element={<TnpscGroupPage />} />
          <Route path="exams/:groupId/:stageId" element={<TnpscStagePage />} />
          <Route path="mock-tests" element={<UserTrackPage track="mock" />} />
          <Route path="practice" element={<UserTrackPage track="practice" />} />
          <Route path="performance" element={<UserPerformancePage />} />
          <Route path="progress" element={<UserProgressPage />} />
          <Route path="study-plan/:attemptId" element={<UserStudyPlanPage />} />
          <Route path="bookmarks" element={<UserSavedPage kind="bookmarks" />} />
          <Route path="notes" element={<UserSavedPage kind="notes" />} />
          <Route path="courses" element={<CourseListPage />} />
          <Route path="courses/:courseId" element={<CourseDetailPage />} />
          <Route path="test/:testId/start" element={<TestStartPage />} />
          <Route path="test/:testId/ready" element={<TestReadyPage />} />
          <Route path="test/:testId/take" element={<TestTakingPage />} />
          <Route path="history" element={<UserHistoryPage />} />
          <Route path="report/:attemptId" element={<UserReportPage />} />
          <Route path="profile" element={<UserProfilePage />} />
          <Route path="subscription" element={<SubscriptionPage />} />
          <Route path="notifications" element={<NotificationsPage />} />
          <Route path="billing" element={<PaymentHistoryPage />} />
          <Route path="assessment/:assessmentId" element={<UserEvalAssessmentPage />} />
        </Route>
      </Routes>
    </UserPortalProvider>
  );
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/adminlogin" element={<AdminLoginPage />} />
      <Route element={<AdminGuard />}>
        <Route path="/org/dashboard" element={<AdminDashboardPage />} />
        <Route path="/org/payments" element={<AdminPaymentsPage />} />
        <Route path="/org/courses" element={<AdminCoursesPage />} />
        <Route path="/org/promos" element={<AdminPromosPage />} />
        <Route path="/org/plans" element={<AdminPlansPage />} />
        <Route path="/org/users" element={<AdminUsersPage />} />
        <Route path="/org/audit" element={<AdminAuditPage />} />
        <Route path="/org/settings" element={<AdminSettingsPage />} />
        <Route path="/org/evaluation" element={<EvaluationHubPage />} />
        <Route path="/org/evaluation/paper/:paperId" element={<EvalPaperDetailPage />} />
        <Route path="/org/evaluation/generating/:jobId" element={<EvalGeneratingPage />} />
      </Route>
      <Route path="/take-assessment" element={<TakeAssessmentPage />} />

      {/* User Portal — scoped so UserPortalProvider only mounts on /user/* */}
      <Route path="/user/*" element={<UserPortalRoutes />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

// Dev-only BASE_URL badge is rendered from src/main.tsx (before React mounts)
// so there's no need to also render it inside the React tree.

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <WorkspaceProvider>
          <SubscriptionProvider>
            <AIContextProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <HashRouter>
                  <ScrollToTop />
                  <ErrorBoundary>
                    <AppRoutes />
                  </ErrorBoundary>
                </HashRouter>
              </TooltipProvider>
            </AIContextProvider>
          </SubscriptionProvider>
        </WorkspaceProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;

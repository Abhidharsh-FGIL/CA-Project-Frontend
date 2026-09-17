import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  SUBSCRIPTION_PLANS,
  SAMPLE_USER_TRANSACTIONS,
  SAMPLE_TESTS,
  TIER_ORDER,
  isTierSufficient,
  getPlan,
  nextInvoiceNo,
  randomPaymentMethod,
  type SampleUser,
  type SampleAttempt,
  type SampleTest,
  type SubscriptionTier,
  type SubscriptionPlanInfo,
  type PaymentTransaction,
} from '@/data/userPortalSampleData';
import {
  registerUser,
  verifyUserOtp,
  resendUserOtp,
  loginUser,
  logoutUser,
  forgotUserPassword,
  resetUserPassword,
  getUserProfile,
  updateUserProfile,
  changeUserPassword,
  type UserProfile,
  type StudentDetailFields,
  type UpdateProfilePayload,
} from '@/lib/userAuthApi';
import {
  getUserAssessments,
  getAttemptHistory,
  getNotifications,
  markNotificationReadApi,
  markAllNotificationsReadApi,
  clearAllNotificationsApi,
  type ApiCourse,
  type ApiEvalAssessment,
  type ApiAttempt,
  type ApiNotification,
} from '@/lib/userPortalApi';
import { ApiError, getUserToken } from '@/lib/api';

interface UserPortalContextValue {
  user: SampleUser | null;
  isAuthenticated: boolean;
  /** Loading state — true while initial data fetch is in progress after login/mount. */
  isLoading: boolean;
  notifications: ApiNotification[];
  unreadCount: number;
  history: ApiAttempt[];
  tests: SampleTest[];
  courses: ApiCourse[];
  /** Assessments available to the student (board + grade filtered). Powers the dashboard. */
  assessments: ApiEvalAssessment[];
  plans: SubscriptionPlanInfo[];
  lastLoginAt: string | null;
  redeemedPromoCodes: Set<string>;

  login: (email: string, password: string) => Promise<{ ok: boolean; error?: string }>;
  register: (data: { name: string; email: string; phone: string; password: string } & StudentDetailFields) => Promise<{ ok: boolean; error?: string; otpSentTo?: string }>;
  verifyOtp: (otp: string) => Promise<{ ok: boolean; error?: string }>;
  resendOtp: () => Promise<{ ok: boolean; error?: string }>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<{ ok: boolean; error?: string }>;
  resetPassword: (token: string, newPassword: string) => Promise<{ ok: boolean; error?: string }>;

  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  clearAllNotifications: () => void;

  /** Refresh history from the API (call after a test attempt is submitted). */
  refreshHistory: () => Promise<void>;
  isTestUnlocked: (test: SampleTest) => { unlocked: boolean; reason?: 'tier' | 'monthly_limit' | 'mock_disabled' };
  redeemPromoCode: (testId: string, code: string) => { ok: boolean; error?: string; discountPct?: number };
  upgradeSubscription: (tier: SubscriptionTier) => Promise<{ ok: boolean }>;
  updateProfile: (
    data: Partial<
      Pick<
        SampleUser,
        | 'name'
        | 'email'
        | 'phone'
        | 'date_of_birth'
        | 'gender'
        | 'student_class'
        | 'section'
        | 'roll_no'
        | 'school_name'
        | 'medium'
        | 'class_teacher'
        | 'academic_year'
      >
    >,
  ) => Promise<{ ok: boolean; error?: string }>;
  changePassword: (oldPwd: string, newPwd: string) => Promise<{ ok: boolean; error?: string }>;
  payForSubscription: (
    tier: SubscriptionTier,
    billingCycle: 'monthly' | 'yearly',
    baseAmount: number,
    finalAmount: number,
    promoCode?: string,
  ) => Promise<{ ok: boolean; error?: string }>;

  /** Tests the user has paid for in this session — simulated payment ledger. */
  paidTestIds: Set<string>;
  /** Simulate a payment for a test. Resolves with ok:true after a short delay. */
  payForTest: (
    testId: string,
    amountInr: number,
    options?: { baseAmount?: number; promoCode?: string; testName?: string; mode?: 'practice' | 'mock' },
  ) => Promise<{ ok: boolean; error?: string }>;

  /** All payment transactions for the user (subscriptions + tests). */
  transactions: PaymentTransaction[];

  canDownloadPDF: boolean;
}

const UserPortalContext = createContext<UserPortalContextValue | undefined>(undefined);

// Kept for backwards-compatible re-exports — no longer drive any demo logic.
const DEMO_PASSWORD = '';
const FIXED_OTP = '';

/** Map the backend user shape onto the SampleUser shape used throughout the UI. */
function mapProfileToSampleUser(p: UserProfile): SampleUser {
  return {
    user_id: p.user_id,
    name: p.name,
    email: p.email,
    phone: p.phone,
    subscription_tier: p.subscription_tier,
    subscription_expiry: p.subscription_expiry || new Date(0).toISOString(),
    otp_verified: p.otp_verified,
    created_at: p.created_at,
    usage: { practice_tests_attempted_month: 0, mock_tests_attempted_month: 0, period_start: new Date().toISOString() },
    // Student details (school portal)
    board: p.board,
    date_of_birth: p.date_of_birth,
    gender: p.gender,
    student_class: p.student_class,
    section: p.section,
    roll_no: p.roll_no,
    school_name: p.school_name,
    medium: p.medium,
    class_teacher: p.class_teacher,
    academic_year: p.academic_year,
    // This mapper is a whitelist — a field missing here is silently dropped, which
    // is how the dashboard came to ignore the registered exam entirely. The API
    // returns `target_groups` alongside `preferred_exam`, so accept either.
    preferred_exam: p.preferred_exam ?? p.target_groups?.[0],
  };
}

/** Derive the assessments filter (board + grade) from the mapped student profile. */
function assessmentFilter(u: SampleUser): { board?: string; grade?: number } {
  const grade = u.student_class ? parseInt(u.student_class, 10) : undefined;
  return { board: u.board || undefined, grade: Number.isFinite(grade) ? grade : undefined };
}

/** Fetch all portal data (assessments, history, notifications) after login or mount. */
async function fetchPortalData(u: SampleUser): Promise<{
  assessments: ApiEvalAssessment[];
  history: ApiAttempt[];
  notifications: ApiNotification[];
}> {
  const [assessmentsRes, historyRes, notificationsRes] = await Promise.allSettled([
    getUserAssessments(assessmentFilter(u)),
    getAttemptHistory(1, 50),
    getNotifications(1, 50),
  ]);

  return {
    assessments: assessmentsRes.status === 'fulfilled' ? assessmentsRes.value : [],
    history: historyRes.status === 'fulfilled' ? historyRes.value.items : [],
    notifications: notificationsRes.status === 'fulfilled' ? notificationsRes.value.items : [],
  };
}

function describeApiError(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.message || fallback;
  if (err instanceof Error) return err.message || fallback;
  return fallback;
}

export function UserPortalProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SampleUser | null>(null);
  // Start as true when a token already exists so guards wait for the async
  // session-restore fetch before deciding to redirect to login.
  const [isLoading, setIsLoading] = useState<boolean>(() => !!getUserToken());
  /** Holds the email used during registration — needed for verify-otp / resend-otp. */
  const [pendingRegistrationEmail, setPendingRegistrationEmail] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [history, setHistory] = useState<ApiAttempt[]>([]);
  const [courses] = useState<ApiCourse[]>([]);
  const [assessments, setAssessments] = useState<ApiEvalAssessment[]>([]);
  const [redeemedPromoCodes, setRedeemedPromoCodes] = useState<Set<string>>(new Set());
  const [paidTestIds, setPaidTestIds] = useState<Set<string>>(new Set());
  const [lastLoginAt, setLastLoginAt] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>(SAMPLE_USER_TRANSACTIONS);

  /** On mount, if a user portal token is already in localStorage, restore the session. */
  useEffect(() => {
    if (!getUserToken()) return;
    let cancelled = false;
    (async () => {
      try {
        const profile = await getUserProfile();
        const su = mapProfileToSampleUser(profile);
        const portalData = await fetchPortalData(su);
        if (cancelled) return;
        setUser(su);
        setAssessments(portalData.assessments);
        setHistory(portalData.history);
        setNotifications(portalData.notifications);
        setLastLoginAt(new Date().toISOString());
      } catch {
        // Token invalid / expired — let the user log in again
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    try {
      await loginUser({ email, password });
      setIsLoading(true);
      const profile = await getUserProfile();
      const su = mapProfileToSampleUser(profile);
      const portalData = await fetchPortalData(su);
      setUser(su);
      setAssessments(portalData.assessments);
      setHistory(portalData.history);
      setNotifications(portalData.notifications);
      setLastLoginAt(new Date().toISOString());
      return { ok: true };
    } catch (err) {
      return { ok: false, error: describeApiError(err, 'Login failed') };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const register = useCallback(
    async (data: { name: string; email: string; phone: string; password: string } & StudentDetailFields) => {
      try {
        await registerUser({
          full_name: data.name,
          email_address: data.email,
          mobile_number: data.phone,
          password: data.password,
          date_of_birth: data.date_of_birth,
          gender: data.gender,
          student_class: data.student_class,
          section: data.section,
          roll_no: data.roll_no,
          school_name: data.school_name,
          medium: data.medium,
          class_teacher: data.class_teacher,
          academic_year: data.academic_year,
          preferred_exam: data.preferred_exam,
        });
        setPendingRegistrationEmail(data.email);
        return { ok: true, otpSentTo: data.email };
      } catch (err) {
        return { ok: false, error: describeApiError(err, 'Registration failed') };
      }
    },
    [],
  );

  const verifyOtp = useCallback(
    async (otp: string) => {
      if (!pendingRegistrationEmail) return { ok: false, error: 'No pending registration. Please register again.' };
      try {
        await verifyUserOtp({ email_address: pendingRegistrationEmail, otp });
        setIsLoading(true);
        const profile = await getUserProfile();
        const su = mapProfileToSampleUser(profile);
        const portalData = await fetchPortalData(su);
        setUser(su);
        setAssessments(portalData.assessments);
        setHistory(portalData.history);
        setNotifications(portalData.notifications);
        setLastLoginAt(new Date().toISOString());
        setPendingRegistrationEmail(null);
        return { ok: true };
      } catch (err) {
        return { ok: false, error: describeApiError(err, 'Invalid OTP') };
      } finally {
        setIsLoading(false);
      }
    },
    [pendingRegistrationEmail],
  );

  const resendOtp = useCallback(async () => {
    if (!pendingRegistrationEmail) return { ok: false, error: 'No pending registration' };
    try {
      await resendUserOtp(pendingRegistrationEmail);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: describeApiError(err, 'Could not resend OTP') };
    }
  }, [pendingRegistrationEmail]);

  const logout = useCallback(async () => {
    try {
      await logoutUser();
    } catch {
      /* server-side logout failure is non-fatal — tokens cleared in logoutUser's finally */
    }
    setUser(null);
    setAssessments([]);
    setHistory([]);
    setNotifications([]);
    setLastLoginAt(null);
    setRedeemedPromoCodes(new Set());
  }, []);

  const forgotPassword = useCallback(async (email: string) => {
    try {
      await forgotUserPassword(email);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: describeApiError(err, 'Could not send reset link') };
    }
  }, []);

  const resetPassword = useCallback(async (token: string, newPassword: string) => {
    try {
      await resetUserPassword({ token, new_password: newPassword });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: describeApiError(err, 'Could not reset password') };
    }
  }, []);

  const markNotificationRead = useCallback(async (id: string) => {
    // Optimistic update
    setNotifications(prev => prev.map(n => (n.notification_id === id ? { ...n, is_read: true } : n)));
    try {
      await markNotificationReadApi(id);
    } catch {
      // Revert optimistic update on failure
      setNotifications(prev => prev.map(n => (n.notification_id === id ? { ...n, is_read: false } : n)));
    }
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    // Optimistic update
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    try {
      await markAllNotificationsReadApi();
    } catch {
      // Re-fetch on failure to restore real state
      getNotifications(1, 50)
        .then(res => setNotifications(res.items))
        .catch(() => {});
    }
  }, []);

  const clearAllNotifications = useCallback(async () => {
    // Optimistic update
    setNotifications([]);
    try {
      await clearAllNotificationsApi();
    } catch {
      // Re-fetch on failure to restore real state
      getNotifications(1, 50)
        .then(res => setNotifications(res.items))
        .catch(() => {});
    }
  }, []);

  const isTestUnlocked: UserPortalContextValue['isTestUnlocked'] = useCallback(
    (test) => {
      if (!user) return { unlocked: false, reason: 'tier' };
      if (redeemedPromoCodes.has(test.test_id)) return { unlocked: true };
      const sufficient = isTierSufficient(user.subscription_tier, test.required_tier);
      if (!sufficient) return { unlocked: false, reason: 'tier' };
      const plan = getPlan(user.subscription_tier);
      if (test.mode === 'mock') {
        if (plan.features.mock_tests_per_month === 'none') return { unlocked: false, reason: 'mock_disabled' };
        if (
          typeof plan.features.mock_tests_per_month === 'number' &&
          user.usage.mock_tests_attempted_month >= plan.features.mock_tests_per_month
        )
          return { unlocked: false, reason: 'monthly_limit' };
      }
      if (test.mode === 'practice') {
        if (
          typeof plan.features.practice_tests_per_month === 'number' &&
          user.usage.practice_tests_attempted_month >= plan.features.practice_tests_per_month
        )
          return { unlocked: false, reason: 'monthly_limit' };
      }
      return { unlocked: true };
    },
    [user, redeemedPromoCodes],
  );

  const redeemPromoCode = useCallback(
    (testId: string, code: string) => {
      const test = SAMPLE_TESTS.find(t => t.test_id === testId);
      if (!test) return { ok: false as const, error: 'Test not found' };
      if (!test.promo_code) return { ok: false as const, error: 'No promo code applicable to this test' };
      if (test.promo_code.trim().toUpperCase() !== code.trim().toUpperCase())
        return { ok: false as const, error: 'Invalid or expired promo code' };
      setRedeemedPromoCodes(prev => new Set(prev).add(testId));
      const discountPct = typeof test.promo_discount_pct === 'number' ? test.promo_discount_pct : 100;
      return { ok: true as const, discountPct };
    },
    [],
  );

  const recordTransaction = useCallback((txn: PaymentTransaction) => {
    setTransactions(prev => [txn, ...prev]);
  }, []);

  const payForTest = useCallback(
    async (
      testId: string,
      amountInr: number,
      options?: { baseAmount?: number; promoCode?: string; testName?: string; mode?: 'practice' | 'mock' },
    ) => {
      const baseAmount = options?.baseAmount ?? amountInr;
      const discountAmount = Math.max(0, baseAmount - amountInr);
      // Free → still record (so the user sees zero-amount entries in history)
      if (amountInr <= 0) {
        setPaidTestIds(prev => new Set(prev).add(testId));
        if (baseAmount > 0) {
          // Only log when there was an original price (e.g., 100% promo applied)
          const test = SAMPLE_TESTS.find(t => t.test_id === testId);
          recordTransaction({
            txn_id: `txn_${Date.now()}`,
            type: 'test',
            item_id: testId,
            item_name: options?.testName ?? test?.name ?? testId,
            mode: options?.mode ?? test?.mode,
            base_amount: baseAmount,
            discount_amount: discountAmount,
            final_amount: 0,
            promo_code: options?.promoCode,
            status: 'success',
            payment_method: randomPaymentMethod(),
            invoice_no: nextInvoiceNo(),
            created_at: new Date().toISOString(),
          });
        }
        return { ok: true };
      }
      // Simulate a 900ms payment gateway round-trip
      await new Promise(r => setTimeout(r, 900));
      setPaidTestIds(prev => new Set(prev).add(testId));
      const test = SAMPLE_TESTS.find(t => t.test_id === testId);
      recordTransaction({
        txn_id: `txn_${Date.now()}`,
        type: 'test',
        item_id: testId,
        item_name: options?.testName ?? test?.name ?? testId,
        mode: options?.mode ?? test?.mode,
        base_amount: baseAmount,
        discount_amount: discountAmount,
        final_amount: amountInr,
        promo_code: options?.promoCode,
        status: 'success',
        payment_method: randomPaymentMethod(),
        invoice_no: nextInvoiceNo(),
        created_at: new Date().toISOString(),
      });
      return { ok: true };
    },
    [recordTransaction],
  );

  const upgradeSubscription = useCallback(async (tier: SubscriptionTier) => {
    await new Promise(r => setTimeout(r, 600));
    setUser(prev => (prev ? { ...prev, subscription_tier: tier } : prev));
    return { ok: true };
  }, []);

  const payForSubscription = useCallback(
    async (
      tier: SubscriptionTier,
      billingCycle: 'monthly' | 'yearly',
      baseAmount: number,
      finalAmount: number,
      promoCode?: string,
    ) => {
      // Simulate gateway delay
      await new Promise(r => setTimeout(r, finalAmount > 0 ? 900 : 400));
      setUser(prev => (prev ? { ...prev, subscription_tier: tier } : prev));
      const plan = getPlan(tier);
      recordTransaction({
        txn_id: `txn_${Date.now()}`,
        type: 'subscription',
        item_id: tier,
        item_name: plan.name,
        billing_cycle: billingCycle,
        base_amount: baseAmount,
        discount_amount: Math.max(0, baseAmount - finalAmount),
        final_amount: finalAmount,
        promo_code: promoCode,
        status: 'success',
        payment_method: randomPaymentMethod(),
        invoice_no: nextInvoiceNo(),
        created_at: new Date().toISOString(),
      });
      return { ok: true };
    },
    [recordTransaction],
  );

  const updateProfile = useCallback(
    async (
      data: Partial<
        Pick<
          SampleUser,
          | 'name'
          | 'email'
          | 'phone'
          | 'date_of_birth'
          | 'gender'
          | 'student_class'
          | 'section'
          | 'roll_no'
          | 'school_name'
          | 'medium'
          | 'class_teacher'
          | 'academic_year'
        >
      >,
    ) => {
      // Email is immutable via this endpoint; everything else is forwarded when provided.
      const payload: UpdateProfilePayload = {};
      if (data.name !== undefined) payload.name = data.name;
      if (data.phone !== undefined) payload.phone = data.phone;
      if (data.date_of_birth !== undefined) payload.date_of_birth = data.date_of_birth;
      if (data.gender !== undefined) payload.gender = data.gender;
      if (data.student_class !== undefined) payload.student_class = data.student_class;
      if (data.section !== undefined) payload.section = data.section;
      if (data.roll_no !== undefined) payload.roll_no = data.roll_no;
      if (data.school_name !== undefined) payload.school_name = data.school_name;
      if (data.medium !== undefined) payload.medium = data.medium;
      if (data.class_teacher !== undefined) payload.class_teacher = data.class_teacher;
      if (data.academic_year !== undefined) payload.academic_year = data.academic_year;
      try {
        const profile = await updateUserProfile(payload);
        setUser(mapProfileToSampleUser(profile));
        return { ok: true as const };
      } catch (err) {
        return { ok: false as const, error: describeApiError(err, 'Could not update profile') };
      }
    },
    [],
  );

  const changePassword = useCallback(async (oldPwd: string, newPwd: string) => {
    try {
      await changeUserPassword({ old_password: oldPwd, new_password: newPwd });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: describeApiError(err, 'Could not change password') };
    }
  }, []);

  /** Re-fetch attempt history from the API. Call after a test is submitted. */
  const refreshHistory = useCallback(async () => {
    try {
      const res = await getAttemptHistory(1, 50);
      setHistory(res.items);
    } catch {
      // Non-fatal — stale history is still usable
    }
  }, []);

  const canDownloadPDF = useMemo(
    () => (user ? getPlan(user.subscription_tier).features.download_pdf : false),
    [user],
  );

  const value: UserPortalContextValue = {
    user,
    isAuthenticated: !!user,
    isLoading,
    notifications,
    unreadCount: notifications.filter(n => !n.is_read).length,
    history,
    tests: SAMPLE_TESTS,
    courses,
    assessments,
    plans: SUBSCRIPTION_PLANS,
    lastLoginAt,
    redeemedPromoCodes,
    paidTestIds,
    payForTest,
    transactions,
    login,
    register,
    verifyOtp,
    resendOtp,
    logout,
    forgotPassword,
    resetPassword,
    markNotificationRead,
    markAllNotificationsRead,
    clearAllNotifications,
    refreshHistory,
    isTestUnlocked,
    redeemPromoCode,
    upgradeSubscription,
    payForSubscription,
    updateProfile,
    changePassword,
    canDownloadPDF,
  };

  return <UserPortalContext.Provider value={value}>{children}</UserPortalContext.Provider>;
}

export function useUserPortal() {
  const ctx = useContext(UserPortalContext);
  if (!ctx) throw new Error('useUserPortal must be used inside UserPortalProvider');
  return ctx;
}

export { DEMO_PASSWORD, FIXED_OTP, TIER_ORDER };

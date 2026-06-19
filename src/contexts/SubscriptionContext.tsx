import React, { createContext, useContext, useState } from 'react';

type SubscriptionPlan = 'free' | 'plus' | 'pro' | 'org_basic' | 'org_pro' | 'org_evaluation';

interface Subscription {
  id: string;
  user_id: string | null;
  org_id: string | null;
  plan: SubscriptionPlan;
  status: string;
  trial_ends_at: string | null;
  current_period_start: string;
  current_period_end: string;
  points_balance: number;
  points_monthly_quota: number;
  storage_limit_mb: number;
  max_seats: number | null;
  auto_renew: boolean;
  payment_gateway: string | null;
  created_at: string;
}

interface FeatureLimit {
  feature_key: string;
  enabled: boolean;
  daily_limit: number | null;
  monthly_limit: number | null;
  notes: string | null;
}

interface UsageCounter {
  feature_key: string;
  period: string;
  period_start: string;
  count: number;
}

interface Addon {
  id: string;
  subscription_id: string;
  addon_type: string;
  quantity: number;
  points_added: number;
  purchased_at: string;
  expires_at: string | null;
}

interface OrgModuleOverride {
  id: string;
  org_id: string;
  feature_key: string;
  enabled: boolean;
  access_role: string | null;
  updated_at: string;
}

interface SubscriptionContextValue {
  subscription: Subscription | null;
  plan: SubscriptionPlan;
  planDisplayName: string;
  featureLimits: FeatureLimit[];
  usageCounters: UsageCounter[];
  addons: Addon[];
  isLoading: boolean;
  canAccess: (featureKey: string) => boolean;
  canAccessModule: (moduleKey: string) => boolean;
  canAccessFeature: (moduleKey: string, featureKey: string) => boolean;
  orgModuleOverrides: OrgModuleOverride[];
  getLimit: (featureKey: string) => FeatureLimit | undefined;
  getUsage: (featureKey: string, period?: 'daily' | 'monthly') => number;
  getFeatureNote: (featureKey: string) => string | null;
  pointsBalance: number;
  isTrialing: boolean;
  daysLeft: number;
  autoRenew: boolean;
  nextBillingDate: string | null;
  paymentGateway: string | null;
  showUpgradeModal: boolean;
  upgradeFeature: string | null;
  triggerUpgrade: (featureKey: string) => void;
  dismissUpgrade: () => void;
  isOrgContext: boolean;
  isOrgAdmin: boolean;
}

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeFeature, setUpgradeFeature] = useState<string | null>(null);

  const value: SubscriptionContextValue = {
    subscription: null,
    plan: 'org_evaluation',
    planDisplayName: 'Org Evaluation',
    featureLimits: [],
    usageCounters: [],
    addons: [],
    isLoading: false,
    canAccess: () => true,
    canAccessModule: () => true,
    canAccessFeature: () => true,
    orgModuleOverrides: [],
    getLimit: () => undefined,
    getUsage: () => 0,
    getFeatureNote: () => null,
    pointsBalance: 0,
    isTrialing: false,
    daysLeft: 0,
    autoRenew: true,
    nextBillingDate: null,
    paymentGateway: null,
    showUpgradeModal,
    upgradeFeature,
    triggerUpgrade: (featureKey: string) => {
      setUpgradeFeature(featureKey);
      setShowUpgradeModal(true);
    },
    dismissUpgrade: () => {
      setShowUpgradeModal(false);
      setUpgradeFeature(null);
    },
    isOrgContext: true,
    isOrgAdmin: true,
  };

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export function useSubscription() {
  const context = useContext(SubscriptionContext);
  if (!context) {
    throw new Error('useSubscription must be used within SubscriptionProvider');
  }
  return context;
}

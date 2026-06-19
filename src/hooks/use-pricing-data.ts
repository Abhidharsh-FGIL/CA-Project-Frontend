import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';

export interface PlanDef {
  id: string;
  plan: string;
  display_name: string;
  price_inr: number;
  workspace_type: string;
  monthly_points: number;
  storage_mb: number;
  max_file_size_mb: number;
  max_seats: number | null;
  description: string | null;
}

export interface PointCostDef {
  id: string;
  action: string;
  cost: number;
  xp_reward: number;
  description: string | null;
}

export function usePricingData() {
  const plans = useQuery({
    queryKey: ['pricing-plans'],
    queryFn: () => api.get<PlanDef[]>('/api/v1/subscriptions/plans'),
    staleTime: 5 * 60 * 1000,
  });

  const pointCosts = useQuery({
    queryKey: ['pricing-point-costs'],
    queryFn: () => api.get<PointCostDef[]>('/api/v1/subscriptions/point-costs'),
    staleTime: 5 * 60 * 1000,
  });

  return {
    plans: plans.data ?? [],
    pointCosts: pointCosts.data ?? [],
    isLoading: plans.isLoading || pointCosts.isLoading,
  };
}

/** Map backend plan key → frontend plan key */
export function normalizePlanKey(plan: string): string {
  if (plan === 'individual_pro') return 'plus';
  if (plan === 'individual_power') return 'pro';
  return plan;
}

/** Find a plan from the API list by its backend key */
export function findPlan(plans: PlanDef[], backendKey: string): PlanDef | undefined {
  return plans.find((p) => p.plan === backendKey);
}

/** Format price as ₹X,XXX */
export function formatPrice(priceInr: number): string {
  if (priceInr === 0) return '₹0';
  return `₹${priceInr.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`;
}

/** Build the dynamic feature bullets for an individual plan, merging API numbers with static descriptions */
export function buildIndividualFeatures(plan: PlanDef, staticFeatures: string[]): string[] {
  const pts = plan.monthly_points.toLocaleString('en-IN');
  const storageMb = plan.storage_mb;
  const maxFile = plan.max_file_size_mb;
  const storageLabel = storageMb >= 1024 ? `${(storageMb / 1024).toFixed(0)} GB` : `${storageMb} MB`;

  // Replace first two feature lines (points + storage) with dynamic values
  // Preserve suffixes like "(one-time welcome bonus)" or "/month"
  const features = [...staticFeatures];
  const pointsSuffix = plan.plan === 'free' ? ' (one-time welcome bonus)' : '/month';
  features[0] = `${pts} AI Points${pointsSuffix}`;
  features[1] = `${storageLabel} Storage (${maxFile} MB max file)`;
  return features;
}

/** User-facing label overrides for point cost actions */
const ACTION_LABELS: Record<string, string> = {
  basic_chat: 'AI Chat Message',
  chat_followup: 'Follow-up Questions',
  chat_next_steps: 'Next Step Suggestions',
  chat_video_refs: 'Video References (in chat)',
  chat_mindmap: 'Mind Map (in chat)',
  chat_infographic: 'Infographic (in chat)',
  chat_practice: 'Practice Exercises (in chat)',
  playground_explore: 'Playground Session',
  playground_harder: 'Playground Harder Mode',
  ocr_extraction: 'OCR Extraction',
  generate_assessment: 'Assessment Generation',
  generate_ebook: 'eBook Generation (per page)',
  generate_audiobook: 'Audio eBook',
  ebook_download_pdf: 'eBook PDF Download',
  ebook_download_docx: 'eBook DOCX Download',
  career_guidance: 'Career Path Generation',
  generate_insights: 'Recommendation Refresh',
  news_feed: 'News Feed View',
  view_recommendations: 'Recommendations View',
  view_career_profile: 'Career Profile View',
  rag_query: 'Vault AI Query',
  generate_mindmap: 'Mind Map (standalone)',
  generate_video_script: 'Video Script',
  generate_video_visuals: 'Video Visuals',
};

/** Actions to hide from the public point costs table */
const HIDDEN_ACTIONS = new Set([
  'chat_followup', 'chat_next_steps',
  'rag_query', 'generate_mindmap',
  'generate_video_script', 'generate_video_visuals',
  'playground_harder',
]);

export function getPointCostLabel(action: string): string {
  return ACTION_LABELS[action] || action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export function filterVisiblePointCosts(costs: PointCostDef[]): PointCostDef[] {
  return costs.filter((c) => !HIDDEN_ACTIONS.has(c.action));
}

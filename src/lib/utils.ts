import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Personal workspace labels (match signup choices)
const PERSONAL_ROLE_LABELS: Record<string, string> = {
  student: 'Learner',
  teacher: 'Educator',
  normal_user: 'Professional',
  guardian: 'Guardian',
  org_admin: 'Admin',
};

// Org workspace labels (match org membership roles)
const ORG_ROLE_LABELS: Record<string, string> = {
  org_admin: 'Admin',
  teacher: 'Teacher',
  student: 'Student',
  guardian: 'Guardian',
  normal_user: 'Member',
};

export function getRoleLabel(role?: string | null, isOrg = false): string {
  if (!role) return 'Learner';
  const labels = isOrg ? ORG_ROLE_LABELS : PERSONAL_ROLE_LABELS;
  return labels[role] || role.charAt(0).toUpperCase() + role.slice(1);
}

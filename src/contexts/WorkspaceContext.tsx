import React, { createContext, useContext } from 'react';
import type { Workspace } from '@/hooks/use-workspace';

interface ProfileContext {
  gradePreference: number | null;
  boardPreference: string | null;
  subjects: string[];
  language: string;
  tone: string;
  difficulty: string;
}

interface WorkspaceContextValue {
  workspaces: Workspace[];
  activeWorkspace: Workspace;
  switchWorkspace: (id: string) => void;
  isOrgContext: boolean;
  orgId: string | null;
  isLoading: boolean;
  workspaceReady: boolean;
  activeOrgRole: string | null;
  hasGenverse: boolean;
  hasEvaluation: boolean;
  profileContext: ProfileContext | null;
  isProfileLoading: boolean;
  updateProfileContext: (updates: Partial<ProfileContext>) => Promise<void>;
  currentAcademicYear: string | null;
  activeAcademicYear: string | null;
  availableAcademicYears: string[];
  setActiveAcademicYear: (year: string | null) => void;
  isViewingCurrentYear: boolean;
}

const DEMO_WORKSPACE: Workspace = {
  id: 'demo-org',
  name: 'Demo Organization',
  type: 'organization',
  role: 'org_admin',
  hasGenverse: true,
  hasEvaluation: true,
};

const DEMO_PROFILE: ProfileContext = {
  gradePreference: null,
  boardPreference: null,
  subjects: [],
  language: 'en',
  tone: 'neutral',
  difficulty: 'medium',
};

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const value: WorkspaceContextValue = {
    workspaces: [DEMO_WORKSPACE],
    activeWorkspace: DEMO_WORKSPACE,
    switchWorkspace: () => {},
    isOrgContext: true,
    orgId: 'demo-org',
    isLoading: false,
    workspaceReady: true,
    activeOrgRole: 'org_admin',
    hasGenverse: true,
    hasEvaluation: true,
    profileContext: DEMO_PROFILE,
    isProfileLoading: false,
    updateProfileContext: async () => {},
    currentAcademicYear: null,
    activeAcademicYear: null,
    availableAcademicYears: [],
    setActiveAcademicYear: () => {},
    isViewingCurrentYear: true,
  };

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspaceContext() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error('useWorkspaceContext must be used within WorkspaceProvider');
  }
  return context;
}

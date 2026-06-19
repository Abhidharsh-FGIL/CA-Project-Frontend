import React, { createContext, useContext, useState, useMemo, useCallback, useEffect } from 'react';
import { useAIContextSession, useUpdateAIContext, useOrgContextLocks, AIContextPayload, AIContextSession } from '@/hooks/use-ai-context';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';
import { useAuth } from '@/contexts/AuthContext';
import { useAllowedBoards } from '@/hooks/use-boards';
import { toast } from 'sonner';

interface AIContextValue {
  studentMode: boolean;
  grade: number | null;
  board: string | null;
  subject: string | null;
  language: string;
  tone: string;
  difficulty: string;
  outputMode: string;
  selectedFiles: string[];
  orgLocked: { locked_grade: number | null; locked_board: string | null; enforce_academic_context: boolean } | null;
  setStudentMode: (v: boolean) => void;
  setGrade: (v: number | null) => void;
  setBoard: (v: string | null) => void;
  setSubject: (v: string | null) => void;
  setLanguage: (v: string) => void;
  setTone: (v: string) => void;
  setDifficulty: (v: string) => void;
  setOutputMode: (v: string) => void;
  setSelectedFiles: (ids: string[]) => void;
  getContextPayload: () => AIContextPayload;
  isLoading: boolean;
}

export const AIContext = createContext<AIContextValue | undefined>(undefined);

export function AIContextProvider({ children }: { children: React.ReactNode }) {
  const { isOrgContext, orgId, activeOrgRole } = useWorkspaceContext();
  const { user } = useAuth();
  const { data: session, isLoading: sessionLoading } = useAIContextSession();
  const updateContext = useUpdateAIContext();
  const { data: orgLocks = null } = useOrgContextLocks();
  const allowedBoards = useAllowedBoards();

  // When org enforces academic context for students, lock to their own user-profile
  // grade & board_preference (sourced from /api/v1/users/me via useAuth).
  const enforceOn = !!orgLocks?.enforce_academic_context && activeOrgRole === 'student';

  // Local optimistic state
  const [localStudentMode, setLocalStudentMode] = useState<boolean | null>(null);
  const [localGrade, setLocalGrade] = useState<number | null | undefined>(undefined);
  const [localBoard, setLocalBoard] = useState<string | null | undefined>(undefined);
  const [localSubject, setLocalSubject] = useState<string | null | undefined>(undefined);
  const [localLanguage, setLocalLanguage] = useState<string | undefined>(undefined);
  const [localTone, setLocalTone] = useState<string | undefined>(undefined);
  const [localDifficulty, setLocalDifficulty] = useState<string | undefined>(undefined);
  const [localOutputMode, setLocalOutputMode] = useState<string | undefined>(undefined);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);

  // Sync local state from server when session loads
  useEffect(() => {
    if (session) {
      setLocalStudentMode(null);
      setLocalGrade(undefined);
      setLocalBoard(undefined);
      setLocalSubject(undefined);
      setLocalLanguage(undefined);
      setLocalTone(undefined);
      setLocalDifficulty(undefined);
      setLocalOutputMode(undefined);
    }
  }, [session]);

  // When org enforces academic context AND the current user is a student in this org,
  // force student mode ON and lock grade/board to the student's own member-profile values.
  // Students cannot override or disable this — admins/teachers are unaffected.
  const studentEnforced = enforceOn;
  const memberGrade = user?.grade ?? null;
  const memberBoard = user?.boardPreference ?? null;

  // Derive effective values: student-enforced > local override > org lock > session > default
  const studentMode = studentEnforced
    ? true
    : (orgLocks?.enforce_academic_context ? true : (localStudentMode ?? session?.student_mode ?? true));
  const grade = studentEnforced
    ? memberGrade
    : (orgLocks?.locked_grade ?? (localGrade !== undefined ? localGrade : (session?.grade ?? null)));
  const board = studentEnforced
    ? memberBoard
    : (orgLocks?.locked_board ?? (localBoard !== undefined ? localBoard : (session?.board ?? null)));
  const subject = localSubject !== undefined ? localSubject : (session?.subject ?? null);
  const language = localLanguage ?? session?.language ?? 'en';
  const tone = localTone ?? session?.tone ?? 'neutral';
  const difficulty = localDifficulty ?? session?.difficulty ?? 'medium';
  const outputMode = localOutputMode ?? session?.output_mode ?? 'default';

  const optimisticSet = useCallback(<T,>(
    setLocal: (v: T) => void,
    dbKey: string,
    value: T,
    prevValue: T
  ) => {
    setLocal(value);
    updateContext.mutate(
      { [dbKey]: value } as any,
      {
        onError: () => {
          setLocal(prevValue);
          toast.error('Could not save your preference. Please try again.');
        },
      }
    );
  }, [updateContext]);

  // Reset board to first allowed if current board was restricted by org admin
  useEffect(() => {
    if (!allowedBoards || allowedBoards.length === 0) return;
    if (board && !allowedBoards.includes(board)) {
      optimisticSet(setLocalBoard, 'board', allowedBoards[0], board);
    }
  }, [allowedBoards, board, optimisticSet]);

  const setStudentMode = useCallback((v: boolean) => {
    optimisticSet(setLocalStudentMode, 'student_mode', v, studentMode);
  }, [optimisticSet, studentMode]);

  const setGrade = useCallback((v: number | null) => {
    optimisticSet(setLocalGrade, 'grade', v, grade);
  }, [optimisticSet, grade]);

  const setBoard = useCallback((v: string | null) => {
    optimisticSet(setLocalBoard, 'board', v, board);
  }, [optimisticSet, board]);

  const setSubject = useCallback((v: string | null) => {
    optimisticSet(setLocalSubject, 'subject', v, subject);
  }, [optimisticSet, subject]);

  const setLanguage = useCallback((v: string) => {
    optimisticSet(setLocalLanguage, 'language', v, language);
  }, [optimisticSet, language]);

  const setTone = useCallback((v: string) => {
    optimisticSet(setLocalTone, 'tone', v, tone);
  }, [optimisticSet, tone]);

  const setDifficulty = useCallback((v: string) => {
    optimisticSet(setLocalDifficulty, 'difficulty', v, difficulty);
  }, [optimisticSet, difficulty]);

  const setOutputMode = useCallback((v: string) => {
    optimisticSet(setLocalOutputMode, 'output_mode', v, outputMode);
  }, [optimisticSet, outputMode]);

  const getContextPayload = useCallback((): AIContextPayload => ({
    student_mode: studentMode,
    grade,
    board,
    subject,
    language,
    tone,
    difficulty,
    output_mode: outputMode,
    selected_files: selectedFiles,
    workspace_type: isOrgContext ? 'organization' : 'personal',
    org_id: orgId,
  }), [studentMode, grade, board, subject, language, tone, difficulty, outputMode, selectedFiles, isOrgContext, orgId]);

  const value = useMemo<AIContextValue>(() => ({
    studentMode, grade, board, subject, language, tone, difficulty, outputMode,
    selectedFiles, orgLocked: orgLocks,
    setStudentMode, setGrade, setBoard, setSubject,
    setLanguage, setTone, setDifficulty, setOutputMode, setSelectedFiles,
    getContextPayload, isLoading: sessionLoading,
  }), [
    studentMode, grade, board, subject, language, tone, difficulty, outputMode,
    selectedFiles, orgLocks, sessionLoading,
    setStudentMode, setGrade, setBoard, setSubject,
    setLanguage, setTone, setDifficulty, setOutputMode, getContextPayload,
  ]);

  return <AIContext.Provider value={value}>{children}</AIContext.Provider>;
}

export function useAIContext() {
  const ctx = useContext(AIContext);
  if (!ctx) throw new Error('useAIContext must be used within AIContextProvider');
  return ctx;
}

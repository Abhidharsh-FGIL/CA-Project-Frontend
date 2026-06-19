import { useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';
import { useAIContext } from '@/contexts/AIContextProvider';
import { toast } from 'sonner';

const LANGUAGE_LABELS: Record<string, string> = {
  en: 'English',
  hi: 'Hindi',
  ta: 'Tamil',
};

export interface EvalPaperConfig {
  title: string;
  grade?: number;
  board?: string;
  classId?: string;
  difficulty: string;
  mode: string;
  timeLimitSeconds?: number;
  negativeMarking: boolean;
  negativeMarkValue?: number;
  questionCount: number;
  questionTypes: string[];
  mcqSubtypes: string[];
  typeWeightage: Record<string, number>;
  subjects: EvalSubjectConfig[];
}

export interface EvalSubjectConfig {
  id: string;
  subject: string;
  weightage: number;
  sourceType: 'online' | 'file' | 'text';
  sourceText?: string;
  sourceRefId?: string;
  sourceFileName?: string;
  embedStatus?: 'processing' | 'ready' | 'failed';
  chapters: EvalChapterConfig[];
}

export interface EvalChapterConfig {
  id: string;
  name: string;
  weightage: number;
}

/** Map backend field names to frontend convention */
function mapQuestion(q: any): any {
  return {
    ...q,
    text: q.question_text ?? q.text,
    type: q.question_type ?? q.type,
    points: q.marks ?? q.points ?? 1,
    correct_answer: q.correct_answer,
    source_type: q.source_type ?? 'online',
  };
}

export function useEvalPapers(filters?: { sourceType?: string }) {
  const { orgId } = useWorkspaceContext();
  return useQuery({
    queryKey: ['eval-papers', orgId, filters],
    queryFn: () => {
      const params = new URLSearchParams();
      if (orgId) params.set('org_id', orgId);
      if (filters?.sourceType) params.set('source_type', filters.sourceType);
      return api.get<any[]>(`/api/v1/evaluation/papers?${params}`);
    },
  });
}

export function useEvalQuestions(filters?: {
  subject?: string;
  chapter?: string;
  type?: string;
  difficulty?: string;
  source?: string;
  grade?: string;
  board?: string;
  paperId?: string;
}) {
  const { orgId } = useWorkspaceContext();
  return useQuery({
    queryKey: ['eval-questions', orgId, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (orgId) params.set('org_id', orgId);
      if (filters?.subject) params.set('subject', filters.subject);
      if (filters?.type) params.set('type', filters.type);
      if (filters?.difficulty) params.set('difficulty', filters.difficulty);
      if (filters?.source) params.set('source', filters.source);
      if (filters?.grade) params.set('grade', filters.grade);
      if (filters?.board) params.set('board', filters.board);
      if (filters?.paperId) params.set('paper_id', filters.paperId);
      const raw = await api.get<any[]>(`/api/v1/evaluation/questions?${params}`);
      return (raw || []).map(mapQuestion);
    },
  });
}

/** Fetch questions for a specific paper (uses the paper-scoped endpoint) */
export function useEvalPaperQuestions(paperId?: string) {
  return useQuery({
    queryKey: ['eval-paper-questions', paperId],
    queryFn: async () => {
      const raw = await api.get<any[]>(`/api/v1/evaluation/papers/${paperId}/questions`);
      return (raw || []).map(mapQuestion);
    },
    enabled: !!paperId,
  });
}

export function useEvalSubjectSuggestions(filters?: { grade?: number; board?: string; sourceType?: string }) {
  const { orgId } = useWorkspaceContext();
  return useQuery({
    queryKey: ['eval-subject-suggestions', orgId, filters],
    queryFn: () => {
      const params = new URLSearchParams();
      if (orgId) params.set('org_id', orgId);
      if (filters?.grade) params.set('grade', String(filters.grade));
      if (filters?.board) params.set('board', filters.board);
      if (filters?.sourceType) params.set('source', filters.sourceType);
      return api.get<any[]>(`/api/v1/evaluation/subjects?${params}`);
    },
  });
}

export function useEvalChapterSuggestions(subject?: string, sourceType?: string) {
  const { orgId } = useWorkspaceContext();
  return useQuery({
    queryKey: ['eval-chapter-suggestions', orgId, subject, sourceType],
    queryFn: () => {
      const params = new URLSearchParams();
      if (orgId) params.set('org_id', orgId);
      if (subject) params.set('subject', subject);
      if (sourceType) params.set('source', sourceType);
      return api.get<string[]>(`/api/v1/evaluation/chapters?${params}`);
    },
    enabled: !!orgId && !!subject,
  });
}

/**
 * POST to start generation and return the job_id immediately.
 * The caller navigates to /org/evaluation/generating/:jobId which
 * streams progress via SSE — no polling needed here.
 */
export function useStartEvalGeneration() {
  const { orgId } = useWorkspaceContext();
  const { language } = useAIContext();

  return useMutation({
    mutationFn: async (config: EvalPaperConfig): Promise<string> => {
      const languageLabel = LANGUAGE_LABELS[language] || 'English';
      const payload = {
        title: config.title,
        grade: config.grade,
        board: config.board,
        language,
        language_label: languageLabel,
        language_instruction: `Generate ALL question text, options, and any explanatory content strictly in ${languageLabel}. Do not mix languages. Proper nouns and standard scientific/mathematical symbols may remain in English.`,
        difficulty: config.difficulty,
        question_count: config.questionCount,
        question_types: config.questionTypes,
        mcq_subtypes: config.mcqSubtypes,
        type_weightage: config.typeWeightage,
        negative_marking: config.negativeMarking,
        negative_mark_value: config.negativeMarkValue,
        subjects: config.subjects.map(s => ({
          subject: s.subject,
          weightage: s.weightage,
          source_type: s.sourceType,
          source_text: s.sourceText,
          source_ref_id: s.sourceRefId,
          source_file_name: s.sourceFileName,
          chapters: s.chapters.map(c => ({ name: c.name, weightage: c.weightage })),
        })),
      };

      const { job_id } = await api.post<{ job_id: string }>(
        `/api/v1/evaluation/papers/generate?org_id=${orgId}`,
        payload,
      );
      return job_id;
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to start generation'),
  });
}

export function useGenerateEvalPaper(
  onProgress?: (msg: string, done: number, total: number) => void,
) {
  const { orgId } = useWorkspaceContext();
  const { language } = useAIContext();
  const qc = useQueryClient();
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;

  return useMutation({
    mutationFn: async (config: EvalPaperConfig) => {
      const languageLabel = LANGUAGE_LABELS[language] || 'English';
      const payload = {
        title: config.title,
        grade: config.grade,
        board: config.board,
        language,
        language_label: languageLabel,
        language_instruction: `Generate ALL question text, options, and any explanatory content strictly in ${languageLabel}. Do not mix languages. Proper nouns and standard scientific/mathematical symbols may remain in English.`,
        difficulty: config.difficulty,
        question_count: config.questionCount,
        question_types: config.questionTypes,
        mcq_subtypes: config.mcqSubtypes,
        type_weightage: config.typeWeightage,
        negative_marking: config.negativeMarking,
        negative_mark_value: config.negativeMarkValue,
        subjects: config.subjects.map(s => ({
          subject: s.subject,
          weightage: s.weightage,
          source_type: s.sourceType,
          source_text: s.sourceText,
          source_ref_id: s.sourceRefId,
          source_file_name: s.sourceFileName,
          chapters: s.chapters.map(c => ({ name: c.name, weightage: c.weightage })),
        })),
      };

      const { job_id } = await api.post<{ job_id: string }>(
        `/api/v1/evaluation/papers/generate?org_id=${orgId}`,
        payload,
      );

      // Poll until the Celery job completes
      while (true) {
        await new Promise<void>(r => setTimeout(r, 2500));
        const data = await api.get<any>(
          `/api/v1/evaluation/papers/generate/status/${job_id}`,
        );
        onProgressRef.current?.(
          data.message || '',
          data.progress?.done ?? 0,
          data.progress?.total ?? 0,
        );
        if (data.status === 'completed') return data;
        if (data.status === 'failed')
          throw new Error(data.error || data.message || 'Generation failed');
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eval-papers'] });
      qc.invalidateQueries({ queryKey: ['eval-questions'] });
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to generate paper'),
  });
}

export function useSaveEvalPaper() {
  const { orgId } = useWorkspaceContext();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ config, questions, answerKey }: {
      config: EvalPaperConfig;
      questions: any[];
      answerKey: any[];
    }) =>
      api.post<any>('/api/v1/evaluation/papers/save', {
        org_id: orgId,
        config,
        questions,
        answer_key: answerKey,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eval-papers'] });
      qc.invalidateQueries({ queryKey: ['eval-questions'] });
      toast.success('Question paper saved!');
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to save paper'),
  });
}

export function useDeleteEvalPaper() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (paperId: string) => api.delete(`/api/v1/evaluation/papers/${paperId}`),
    onMutate: async (paperId: string) => {
      await qc.cancelQueries({ queryKey: ['eval-papers'] });
      const snapshots = qc.getQueriesData<any[]>({ queryKey: ['eval-papers'] });
      for (const [key, data] of snapshots) {
        if (Array.isArray(data)) {
          qc.setQueryData(key, data.filter((p: any) => p.id !== paperId));
        }
      }
      return { snapshots };
    },
    onError: (_err, _id, ctx) => {
      for (const [key, data] of ctx?.snapshots ?? []) {
        qc.setQueryData(key, data);
      }
      toast.error('Failed to delete collection');
    },
    onSuccess: () => {
      toast.success('Collection deleted');
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['eval-papers'] });
      qc.invalidateQueries({ queryKey: ['eval-questions'] });
      qc.invalidateQueries({ queryKey: ['eval-paper-questions'] });
      qc.invalidateQueries({ queryKey: ['eval-subject-suggestions'] });
      qc.invalidateQueries({ queryKey: ['eval-chapter-suggestions'] });
      qc.invalidateQueries({ queryKey: ['eval-assessments'] });
    },
  });
}

export function useDeleteEvalQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (questionId: string) => api.delete(`/api/v1/evaluation/questions/${questionId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eval-questions'] });
      qc.invalidateQueries({ queryKey: ['eval-paper-questions'] });
      qc.invalidateQueries({ queryKey: ['eval-subject-suggestions'] });
      qc.invalidateQueries({ queryKey: ['eval-chapter-suggestions'] });
    },
  });
}

export function useUpdateEvalQuestion() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...updates }: { id: string; [key: string]: any }) =>
      api.patch(`/api/v1/evaluation/questions/${id}`, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eval-questions'] });
      toast.success('Question updated');
    },
  });
}

export function useUpdateEvalPaperMeta() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      api.patch(`/api/v1/evaluation/papers/${id}`, { title }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['eval-papers'] });
      toast.success('Paper updated');
    },
  });
}

export function useUploadEvalSource() {
  const { orgId } = useWorkspaceContext();
  return useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return api.post<{
        extracted_text: string;
        filename: string;
        word_count: number;
        source_ref_id: string;
        chunk_count: number;
        status: string;
      }>(`/api/v1/evaluation/papers/upload-source?org_id=${orgId}`, formData);
    },
    onError: (err: Error) => toast.error(err.message || 'Failed to extract text from file'),
  });
}

export function useSourceEmbedStatus(sourceRefId?: string) {
  return useQuery({
    queryKey: ['eval-source-status', sourceRefId],
    queryFn: () =>
      api.get<{ source_ref_id: string; status: string; chunk_count: number; error?: string }>(
        `/api/v1/evaluation/papers/source-status/${sourceRefId}`,
      ),
    enabled: !!sourceRefId,
    refetchInterval: (query: any) => {
      const st = query.state?.data?.status;
      if (st === 'ready' || st === 'failed') return false;
      return 2500;
    },
    staleTime: 0,
  });
}

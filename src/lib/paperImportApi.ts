/**
 * Question-paper extraction — turn a real exam paper into an assessment.
 *
 * The opposite direction from `/papers/generate`: nothing is invented. Questions
 * and options are transcribed verbatim from the booklet; the model supplies only
 * what the paper doesn't contain — the answer and the explanation. Those are the
 * model's, not the commission's, which is why every one carries a confidence and
 * nothing reaches the database until the admin saves.
 *
 * Endpoints:
 *   POST /api/v1/evaluation/papers/extract?org_id=   → 202 { job_id }
 *   GET  /api/v1/evaluation/papers/generate/status/{job_id}
 *        — the extraction task writes the generator's job shape, so the existing
 *          polling and SSE work unchanged, and `/papers/save` accepts the result.
 */
import { api } from './api';

export type ImportLanguage = 'en' | 'ta';
export type ExtractConfidence = 'high' | 'medium' | 'low';

/** Multipart fields the extract endpoint accepts. All but `file` are optional. */
export interface PaperExtractOptions {
  /** Language the questions are printed in. Defaults to 'en' server-side. */
  language?: ImportLanguage;
  /**
   * Set when the paper prints each question twice — this is what pairs the two
   * printings into a single question with a `translations` block.
   */
  secondary_language?: ImportLanguage | null;
  /** Tags every extracted question, e.g. "General Studies". */
  subject?: string;
  /** Context for the model, e.g. "TNPSC Group 1". */
  exam_label?: string;
  /** Stop after N questions — useful while testing a long paper. */
  max_questions?: number;
}

export interface ExtractedQuestion {
  id: string;
  type?: string;
  text: string;
  options?: string[];
  points?: number;
  subject?: string;
  chapter?: string;
  subtopic?: string;
  passage?: string | null;
  group_id?: string | null;
  translations?: Record<string, { text?: string; options?: string[]; explanation?: string | null }>;
  /** The number printed in the booklet — lets a reviewer check against the paper. */
  source_number?: number;
}

export interface ExtractedAnswer {
  id: string;
  correctAnswer: any;
  explanation?: string;
  confidence?: ExtractConfidence;
}

export interface ExtractionStats {
  sections_read?: number;
  extracted?: number;
  dropped?: number;
  low_confidence?: number;
}

/** The generator's job shape, plus the two extraction-only fields. */
export interface PaperExtractStatus {
  job_id?: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  message?: string;
  progress?: { done: number; total: number };
  error?: string | null;
  question_json?: ExtractedQuestion[];
  answer_key_json?: ExtractedAnswer[];
  extraction_stats?: ExtractionStats;
}

/** Raised when the upload has no text layer — a photo scan needs OCR first. */
export class NoTextExtractedError extends Error {
  constructor() {
    super(
      'That PDF has no text layer — it looks like a photo scan. Run OCR over it (Tamil + English) and upload the searchable PDF.',
    );
    this.name = 'NoTextExtractedError';
  }
}

/** Start an extraction. Returns the job id to poll. */
export async function startPaperExtraction(
  file: File,
  options: PaperExtractOptions,
  orgId?: string,
): Promise<string> {
  const form = new FormData();
  form.append('file', file);
  if (options.language) form.append('language', options.language);
  if (options.secondary_language) form.append('secondary_language', options.secondary_language);
  if (options.subject) form.append('subject', options.subject);
  if (options.exam_label) form.append('exam_label', options.exam_label);
  if (options.max_questions) form.append('max_questions', String(options.max_questions));

  try {
    const res = await api.upload<{ job_id: string; status?: string; message?: string }>(
      `/api/v1/evaluation/papers/extract${orgId ? `?org_id=${orgId}` : ''}`,
      form,
    );
    return res.job_id;
  } catch (err: any) {
    // The server checks for a missing text layer at upload rather than letting a
    // long job find nothing — surface that as guidance, not a raw error code.
    const text = `${err?.code ?? ''} ${err?.message ?? ''}`;
    if (/NO_TEXT_EXTRACTED/i.test(text)) throw new NoTextExtractedError();
    throw err;
  }
}

/** Extraction reuses the generation job store, so this is the generator's status route. */
export function getPaperExtractStatus(jobId: string): Promise<PaperExtractStatus> {
  return api.get<PaperExtractStatus>(`/api/v1/evaluation/papers/generate/status/${jobId}`);
}

/** Poll until the job settles. A long paper takes minutes, so this is patient. */
export async function pollPaperExtraction(
  jobId: string,
  onProgress: (s: PaperExtractStatus) => void,
  signal?: AbortSignal,
): Promise<PaperExtractStatus> {
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (signal?.aborted) throw new Error('Extraction cancelled');
    const status = await getPaperExtractStatus(jobId);
    onProgress(status);
    if (status.status === 'completed') return status;
    if (status.status === 'failed') {
      throw new Error(status.error || status.message || 'Extraction failed');
    }
    await new Promise(r => setTimeout(r, 3000));
  }
}

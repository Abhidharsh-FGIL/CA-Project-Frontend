/**
 * Excel question-paper import.
 *
 * A third way into the same review screen, alongside `/papers/generate` (invents
 * questions) and `/papers/extract` (transcribes a PDF). Here the questions are
 * already written — one sheet row per question per language — so nothing is
 * invented or inferred; the import only parses, pairs the languages, and rejects
 * rows it cannot trust.
 *
 * Two calls:
 *   POST /excel-papers/import?org_id=          → 201, the parse report
 *   GET  /excel-papers/{import_id}/paper?org_id= → question_json + answer_key_json
 *
 * The second returns the generator's shape, so the existing review screen and
 * `/papers/save` work unchanged.
 */
import { api } from './api';

const BASE = '/api/v1/evaluation';

export interface ExcelImportRow {
  sno?: number;
  source_question_id?: string;
  language?: string;
  sheet_row?: number;
  question_text?: string;
  options?: string[];
  correct_answer?: string;
  correct_index?: number;
  question_type?: string;
  difficulty?: string;
  subject?: string;
  topic?: string;
  subtopic?: string;
}

/** The parse report returned by the upload. */
export interface ExcelImportResult {
  import_id: string;
  title: string;
  exam?: string;
  filename: string;
  row_count: number;
  question_count: number;
  rejected_count: number;
  languages: string[];
  /** 'completed' = every row read; 'partial' = some rows rejected, see `issues`. */
  status: 'completed' | 'partial' | string;
  issues?: string[];
  rows?: ExcelImportRow[];
}

export interface ExcelPaperQuestion {
  id: string;
  type?: string;
  subtype?: string;
  text: string;
  options?: string[];
  passage?: string | null;
  group_id?: string | null;
  points?: number;
  subject?: string;
  chapter?: string;
  /**
   * The level under `chapter`, from the sheet's Subtopic column.
   *
   * Carried through the review screen untouched so `POST /papers/save` stores it
   * on the question — the report groups subject -> topic -> sub-topic off these
   * three fields, and a mapper that drops this one silently flattens the bottom
   * level of every report.
   */
  subtopic?: string;
  difficulty?: string;
  translations?: Record<string, { text?: string; options?: string[]; explanation?: string | null }>;
  /** The question number as written in the sheet. */
  source_number?: string | number;
  source_type?: string;
  /** Non-null when the importer wants a human to look at this row. */
  needs_review?: string | null;
}

export interface ExcelPaperAnswer {
  id: string;
  correctAnswer: any;
  explanation?: string;
  confidence?: 'high' | 'medium' | 'low';
}

export interface ExcelPaperStats {
  read_from?: string;
  rows?: number;
  questions?: number;
  languages?: string[];
  primary_language?: string;
  misaligned_translations?: number;
  by_subject?: Record<string, number>;
}

export interface ExcelPaperResponse {
  import_id: string;
  title: string;
  exam?: string;
  question_count: number;
  question_json: ExcelPaperQuestion[];
  answer_key_json: ExcelPaperAnswer[];
  stats?: ExcelPaperStats;
}

/** Upload-time failures, mapped to something an admin can act on. */
const UPLOAD_ERRORS: Record<string, string> = {
  UNSUPPORTED_FILE_TYPE: 'That file type is not supported — upload an .xlsx or .xls sheet.',
  FILE_TOO_LARGE: 'That sheet is too large to import.',
  EMPTY_FILE: 'That file is empty.',
  EXCEL_PARSE_FAILED:
    'The sheet could not be read — check it has a header row and at least one question row. Nothing was saved.',
};

function describeExcelError(err: any): string {
  const blob = `${err?.code ?? ''} ${err?.message ?? ''}`;
  for (const [code, message] of Object.entries(UPLOAD_ERRORS)) {
    if (blob.includes(code)) return message;
  }
  return err?.message || 'Could not import that sheet';
}

/** POST the sheet. `title` is required; `exam` tags the questions. */
export async function importExcelPaper(
  file: File,
  meta: { title: string; exam?: string },
  orgId?: string,
): Promise<ExcelImportResult> {
  const form = new FormData();
  form.append('title', meta.title);
  if (meta.exam) form.append('exam', meta.exam);
  form.append('file', file);
  try {
    return await api.upload<ExcelImportResult>(
      `${BASE}/excel-papers/import${orgId ? `?org_id=${orgId}` : ''}`,
      form,
    );
  } catch (err: any) {
    const wrapped = new Error(describeExcelError(err));
    (wrapped as any).code = err?.code;
    throw wrapped;
  }
}

/** Fetch the paired, review-ready questions for a completed import. */
export function getExcelPaper(importId: string, orgId?: string): Promise<ExcelPaperResponse> {
  return api.get<ExcelPaperResponse>(
    `${BASE}/excel-papers/${importId}/paper${orgId ? `?org_id=${orgId}` : ''}`,
  );
}

export function listExcelPapers(orgId?: string): Promise<ExcelImportResult[]> {
  return api.get<ExcelImportResult[]>(`${BASE}/excel-papers${orgId ? `?org_id=${orgId}` : ''}`);
}

export function getExcelImport(importId: string, orgId?: string): Promise<ExcelImportResult> {
  return api.get<ExcelImportResult>(
    `${BASE}/excel-papers/${importId}${orgId ? `?org_id=${orgId}` : ''}`,
  );
}

export function deleteExcelImport(importId: string, orgId?: string): Promise<void> {
  return api.delete<void>(`${BASE}/excel-papers/${importId}${orgId ? `?org_id=${orgId}` : ''}`);
}

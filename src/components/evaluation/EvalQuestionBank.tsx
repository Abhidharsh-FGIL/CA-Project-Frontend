import { useState, useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Trash2, Layers, Download, Pencil, Loader2, Globe, FileText, Type, Image, X } from 'lucide-react';
import { useEvalQuestions, useEvalSubjectSuggestions, useDeleteEvalQuestion, useUpdateEvalQuestion } from '@/hooks/use-evaluation';
import { useInfiniteList } from '@/hooks/use-infinite-list';
import { EvalFilterBar } from './EvalFilterBar';
import { MathText } from '@/components/ui/MathText';
import { MathInput } from '@/components/ui/math-input';
import { MathTextarea } from '@/components/ui/math-textarea';
import { DownloadDropdown } from './DownloadDropdown';
import { api, buildUrl } from '@/lib/api';
import { toast } from 'sonner';

const resolveUrl = (url: string | undefined) => {
  if (!url) return '';
  return buildUrl(url);
};
import { downloadQuestionsAsDocx } from '@/lib/eval-docx-export';
import { exportQuestionBank, type ExportFormat, type QuestionData } from '@/lib/eval-export-utils';

const TYPE_LABELS: Record<string, string> = {
  mcq: 'MCQ', fill: 'Fill', short: 'Short', long: 'Long',
  true_false: 'T/F', match: 'Match',
};

const DIFF_COLORS: Record<string, string> = {
  easy: 'bg-green-500/10 text-green-700 dark:text-green-400',
  medium: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-400',
  hard: 'bg-red-500/10 text-red-700 dark:text-red-400',
};

const SOURCE_LABELS: Record<string, { label: string; color: string }> = {
  online: { label: 'Online', color: 'bg-blue-500/10 text-blue-700 dark:text-blue-400' },
  text: { label: 'Text', color: 'bg-purple-500/10 text-purple-700 dark:text-purple-400' },
  file: { label: 'File', color: 'bg-orange-500/10 text-orange-700 dark:text-orange-400' },
};

export function EvalQuestionBank() {
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState('');
  const [sourceFilter, setSourceFilter] = useState('');
  const [groupBy, setGroupBy] = useState<'none' | 'subject' | 'chapter' | 'type' | 'difficulty'>('none');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editQuestion, setEditQuestion] = useState<any | null>(null);
  const [editText, setEditText] = useState('');
  const [editPoints, setEditPoints] = useState(1);
  const [editOptions, setEditOptions] = useState<string[]>([]);
  const [editCorrectAnswer, setEditCorrectAnswer] = useState<any>(null);
  const [editExplanation, setEditExplanation] = useState('');
  const [editPairs, setEditPairs] = useState<any[]>([]);
  const [editDifficulty, setEditDifficulty] = useState('medium');
  const [editAttachmentUrl, setEditAttachmentUrl] = useState<string | undefined>();
  const [editAttachmentName, setEditAttachmentName] = useState<string | undefined>();
  const [editUploading, setEditUploading] = useState(false);

  const { data: subjectSuggestions = [] } = useEvalSubjectSuggestions();

  const filters = useMemo(() => ({
    subject: subjectFilter && subjectFilter !== 'all' ? subjectFilter : undefined,
    type: typeFilter && typeFilter !== 'all' ? typeFilter : undefined,
    difficulty: difficultyFilter && difficultyFilter !== 'all' ? difficultyFilter : undefined,
    source: sourceFilter && sourceFilter !== 'all' ? sourceFilter : undefined,
  }), [subjectFilter, typeFilter, difficultyFilter, sourceFilter]);

  const { data: questions, isLoading } = useEvalQuestions(filters);
  const deleteQuestion = useDeleteEvalQuestion();
  const updateQuestion = useUpdateEvalQuestion();

  const filtered = useMemo(() => {
    if (!questions) return [];
    if (!search) return questions;
    const lower = search.toLowerCase();
    return questions.filter((q: any) =>
      q.text?.toLowerCase().includes(lower) ||
      q.subject?.toLowerCase().includes(lower) ||
      q.chapter?.toLowerCase().includes(lower)
    );
  }, [questions, search]);

  const { visible: visibleQuestions, sentinelRef, hasMore, shown, total } = useInfiniteList<any>(filtered, 25);

  const grouped = useMemo(() => {
    if (groupBy === 'none') return { '': visibleQuestions };
    const groups: Record<string, any[]> = {};
    visibleQuestions.forEach((q: any) => {
      const key = q[groupBy] || 'Uncategorized';
      if (!groups[key]) groups[key] = [];
      groups[key].push(q);
    });
    return groups;
  }, [visibleQuestions, groupBy]);

  const resetFilters = () => {
    setSearch('');
    setSubjectFilter('');
    setTypeFilter('');
    setDifficultyFilter('');
    setSourceFilter('');
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map((q: any) => q.id)));
    }
  };

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [confirmDeleteBulk, setConfirmDeleteBulk] = useState(false);

  const handleDeleteSelected = () => {
    setConfirmDeleteBulk(true);
  };
  const executeDeleteSelected = () => {
    selected.forEach(id => deleteQuestion.mutate(id));
    setSelected(new Set());
    setConfirmDeleteBulk(false);
  };

  const handleDownload = async (items: any[], fmt: ExportFormat) => {
    try {
      if (fmt === 'docx') {
        await downloadQuestionsAsDocx(items);
      } else {
        const qs: QuestionData[] = items.map((q: any) => ({
          text: q.question_text || q.text || '', type: q.question_type || q.type || '',
          points: q.marks || q.points || 1, subject: q.subject, difficulty: q.difficulty,
          options: q.options, correct_answer: q.correct_answer, explanation: q.explanation,
          pairs: q.pairs,
        }));
        await exportQuestionBank(qs, 'Question Bank Export', fmt);
      }
      toast.success(`Downloaded ${items.length} questions`);
    } catch {
      toast.error('Failed to generate download');
    }
  };

  const openEdit = (q: any) => {
    setEditQuestion(q);
    setEditText(q.text || '');
    setEditPoints(q.points || 1);
    // Options come from backend as dict {A: "...", B: "..."} or array
    const rawOpts = q.options;
    if (Array.isArray(rawOpts)) {
      setEditOptions([...rawOpts]);
    } else if (rawOpts && typeof rawOpts === 'object') {
      // Convert dict to ordered array: A, B, C, D...
      const keys = Object.keys(rawOpts).sort();
      setEditOptions(keys.map(k => rawOpts[k]));
    } else {
      setEditOptions([]);
    }
    setEditDifficulty(q.difficulty || 'medium');
    setEditExplanation(q.explanation || '');
    setEditPairs(Array.isArray(q.pairs) ? q.pairs.map((p: any) => ({ ...p })) : []);
    setEditAttachmentUrl(q.attachment_url || q.attachmentUrl || undefined);
    setEditAttachmentName(q.attachment_name || q.attachmentName || undefined);
    // Parse correct_answer
    let ca = q.correct_answer;
    if (typeof ca === 'string') {
      try { ca = JSON.parse(ca); } catch { /* keep as string */ }
    }
    setEditCorrectAnswer(ca);
  };

  const saveEdit = () => {
    if (!editQuestion) return;
    const updates: any = {
      id: editQuestion.id,
      question_text: editText,
      marks: editPoints,
      explanation: editExplanation || null,
      attachment_url: editAttachmentUrl || null,
      attachment_name: editAttachmentName || null,
    };
    if (editQuestion.type === 'mcq') {
      // Convert array back to dict {A: "...", B: "...", ...}
      const optDict: Record<string, string> = {};
      editOptions.forEach((opt, i) => { optDict[String.fromCharCode(65 + i)] = opt; });
      updates.options = optDict;
      updates.correct_answer = editCorrectAnswer != null ? JSON.stringify(editCorrectAnswer) : null;
    } else if (editQuestion.type === 'true_false' || editQuestion.type === 'fill' || editQuestion.type === 'short') {
      updates.correct_answer = editCorrectAnswer != null ? JSON.stringify(editCorrectAnswer) : null;
    } else if (editQuestion.type === 'match') {
      updates.options = { pairs: editPairs };
    }
    updateQuestion.mutate(updates);
    setEditQuestion(null);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <EvalFilterBar
          search={search}
          onSearchChange={setSearch}
          subject={subjectFilter}
          onSubjectChange={setSubjectFilter}
          type={typeFilter}
          onTypeChange={setTypeFilter}
          difficulty={difficultyFilter}
          onDifficultyChange={setDifficultyFilter}
          source={sourceFilter}
          onSourceChange={setSourceFilter}
          subjects={subjectSuggestions}
          onReset={resetFilters}
        />
      </div>

      {/* Bulk actions & grouping */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{filtered.length} questions found</p>
        <div className="flex items-center gap-2">
          {(() => {
            const visibleSelected = filtered.filter((q: any) => selected.has(q.id));
            return visibleSelected.length > 0 ? (
              <>
                <DownloadDropdown
                  onDownload={(fmt) => handleDownload(visibleSelected, fmt)}
                  label={`Download (${visibleSelected.length})`}
                />
                <Button variant="outline" size="sm" className="gap-1 text-xs text-destructive" onClick={handleDeleteSelected}>
                  <Trash2 className="h-3 w-3" /> Delete ({visibleSelected.length})
                </Button>
              </>
            ) : null;
          })()}
          <div className="flex items-center gap-1.5">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <Select value={groupBy} onValueChange={v => setGroupBy(v as any)}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue placeholder="Group by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Grouping</SelectItem>
                <SelectItem value="subject">By Subject</SelectItem>
                <SelectItem value="chapter">By Chapter</SelectItem>
                <SelectItem value="difficulty">By Difficulty</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {filtered.length > 0 && (
            <DownloadDropdown
              onDownload={(fmt) => handleDownload(filtered, fmt)}
              label="Download All"
            />
          )}
        </div>
      </div>

      {Object.entries(grouped).map(([group, items]) => (
        <div key={group} className="space-y-2">
          {group && groupBy !== 'none' && (
            <h4 className="text-sm font-semibold text-foreground flex items-center gap-2 pt-2">
              {group}
              <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
            </h4>
          )}
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-10">
                    <Checkbox checked={selected.size === filtered.length && filtered.length > 0} onCheckedChange={toggleAll} />
                  </TableHead>
                  <TableHead className="min-w-[300px]">Question</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Chapter</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Difficulty</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="w-20">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((q: any) => (
                  <TableRow
                    key={q.id}
                    className={`cursor-pointer transition-colors ${selected.has(q.id) ? 'bg-primary/5 hover:bg-primary/10' : 'hover:bg-muted/30'}`}
                    onClick={(e) => {
                      // Don't toggle if clicking on buttons or checkbox
                      if ((e.target as HTMLElement).closest('button, [role="checkbox"]')) return;
                      toggleSelect(q.id);
                    }}
                  >
                    <TableCell>
                      <Checkbox checked={selected.has(q.id)} onCheckedChange={() => toggleSelect(q.id)} />
                    </TableCell>
                    <TableCell className="text-sm max-w-[400px]">
                      <p className="line-clamp-2"><MathText text={q.text} /></p>
                    </TableCell>
                    <TableCell>
                      {q.subject && <Badge variant="outline" className="text-[10px]">{q.subject}</Badge>}
                    </TableCell>
                    <TableCell>
                      {q.chapter && <Badge variant="outline" className="text-[10px]">{q.chapter}</Badge>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px]">{TYPE_LABELS[q.type] || q.type}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge className={`text-[10px] ${DIFF_COLORS[q.difficulty] || ''}`}>{q.difficulty}</Badge>
                    </TableCell>
                    <TableCell>
                      {(() => {
                        const src = SOURCE_LABELS[q.source_type] || SOURCE_LABELS.online;
                        return <Badge className={`text-[10px] ${src.color}`}>{src.label}</Badge>;
                      })()}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(q)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <DownloadDropdown
                          onDownload={(fmt) => handleDownload([q], fmt)}
                          size="icon"
                          variant="ghost"
                        />
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setConfirmDeleteId(q.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}

      {filtered.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-sm">No questions found. Generate a paper to populate the question bank.</p>
        </div>
      )}

      {filtered.length > 0 && (
        <>
          <div ref={sentinelRef} className="h-1" />
          <p className="text-center text-xs text-muted-foreground py-2">
            {hasMore ? `Loading more… (${shown} of ${total})` : `All ${total} questions loaded`}
          </p>
        </>
      )}

      {/* Edit Dialog */}
      <Dialog open={!!editQuestion} onOpenChange={open => !open && setEditQuestion(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Question</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Question Text</Label>
              <MathTextarea value={editText} onChange={setEditText} placeholder="Enter question text..." />
            </div>

            {/* MCQ Options Editor */}
            {editQuestion?.type === 'mcq' && (
              <div className="space-y-2">
                <Label>Options</Label>
                {(editOptions || []).map((opt: string, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="correct-mcq"
                      checked={editCorrectAnswer === i}
                      onChange={() => setEditCorrectAnswer(i)}
                      className="accent-primary"
                    />
                    <span className="text-sm font-medium text-muted-foreground w-5">{String.fromCharCode(65 + i)}.</span>
                    <MathInput
                      value={opt}
                      onChange={(val) => {
                        const next = [...editOptions];
                        next[i] = val;
                        setEditOptions(next);
                      }}
                      className="flex-1"
                    />
                  </div>
                ))}
                <p className="text-xs text-muted-foreground">Select the radio button for the correct answer.</p>
              </div>
            )}

            {/* True/False */}
            {editQuestion?.type === 'true_false' && (
              <div className="space-y-2">
                <Label>Correct Answer</Label>
                <div className="flex gap-3">
                  {['True', 'False'].map(val => (
                    <Button
                      key={val}
                      type="button"
                      variant={String(editCorrectAnswer).toLowerCase() === val.toLowerCase() ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setEditCorrectAnswer(val.toLowerCase())}
                    >
                      {val}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {/* Fill / Short answer */}
            {(editQuestion?.type === 'fill' || editQuestion?.type === 'short') && (
              <div>
                <Label>Correct Answer</Label>
                <MathInput value={editCorrectAnswer || ''} onChange={val => setEditCorrectAnswer(val)} />
              </div>
            )}

            {/* Match Pairs Editor */}
            {editQuestion?.type === 'match' && (
              <div className="space-y-2">
                <Label>Match Pairs</Label>
                {(editPairs || []).map((pair: any, i: number) => (
                  <div key={i} className="flex items-center gap-2">
                    <MathInput
                      value={pair.left}
                      onChange={(val) => {
                        const next = [...editPairs];
                        next[i] = { ...next[i], left: val };
                        setEditPairs(next);
                      }}
                      placeholder="Column A"
                      className="flex-1"
                    />
                    <span className="text-muted-foreground">→</span>
                    <MathInput
                      value={pair.right}
                      onChange={(val) => {
                        const next = [...editPairs];
                        next[i] = { ...next[i], right: val };
                        setEditPairs(next);
                      }}
                      placeholder="Column B"
                      className="flex-1"
                    />
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Points</Label>
                <Input type="number" value={editPoints} onChange={e => setEditPoints(parseInt(e.target.value) || 1)} className="w-24" />
              </div>
              <div>
                <Label>Difficulty</Label>
                <Select value={editDifficulty} onValueChange={setEditDifficulty}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">Easy</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="hard">Hard</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Explanation (optional)</Label>
              <MathTextarea value={editExplanation} onChange={setEditExplanation} placeholder="Why is this the correct answer?" />
            </div>

            {/* Reference Image */}
            <div className="border rounded-lg p-3 bg-muted/30">
              <Label className="text-sm font-medium flex items-center gap-2 mb-2">
                <Image className="h-4 w-4" /> Reference Image (Optional)
              </Label>
              {editAttachmentUrl ? (
                <div className="flex items-center gap-3">
                  <img src={resolveUrl(editAttachmentUrl)} alt="Attachment" className="h-20 w-20 object-cover rounded border" />
                  <div className="flex-1">
                    <p className="text-sm font-medium truncate">{editAttachmentName}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => { setEditAttachmentUrl(undefined); setEditAttachmentName(undefined); }}>
                    <X className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ) : editUploading ? (
                <div className="flex items-center gap-2 py-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Uploading...</span>
                </div>
              ) : (
                <div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    id="edit-attach"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setEditUploading(true);
                      try {
                        const formData = new FormData();
                        formData.append('file', file);
                        const { url } = await api.upload<{ url: string }>('/api/v1/assignments/files/upload', formData);
                        setEditAttachmentUrl(url);
                        setEditAttachmentName(file.name);
                        toast.success('Image uploaded');
                      } catch {
                        toast.error('Upload failed');
                      } finally {
                        setEditUploading(false);
                        e.target.value = '';
                      }
                    }}
                  />
                  <label htmlFor="edit-attach">
                    <Button variant="outline" size="sm" asChild className="cursor-pointer">
                      <span><Image className="h-4 w-4 mr-2" /> Upload Image</span>
                    </Button>
                  </label>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditQuestion(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={updateQuestion.isPending}>
              {updateQuestion.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation - single */}
      <AlertDialog open={!!confirmDeleteId} onOpenChange={(open) => { if (!open) setConfirmDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Question</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete this question? This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (confirmDeleteId) deleteQuestion.mutate(confirmDeleteId); setConfirmDeleteId(null); }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete confirmation - bulk */}
      <AlertDialog open={confirmDeleteBulk} onOpenChange={setConfirmDeleteBulk}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} Questions</AlertDialogTitle>
            <AlertDialogDescription>Are you sure you want to delete {selected.size} selected question(s)? This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={executeDeleteSelected}>Delete All</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

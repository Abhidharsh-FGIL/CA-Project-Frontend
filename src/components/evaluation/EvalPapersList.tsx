import { useState, useMemo } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Search, Trash2, FileText, Hash, Download, Eye, Pencil, Loader2, Plus, ScanLine } from 'lucide-react';
import { useEvalPapers, useDeleteEvalPaper, useUpdateEvalPaperMeta } from '@/hooks/use-evaluation';
import { useInfiniteList } from '@/hooks/use-infinite-list';
import { DownloadDropdown } from './DownloadDropdown';
import { AddQuestionDialog } from './AddQuestionDialog';
import { TnpscReclassifyDialog } from './TnpscReclassifyDialog';
import { isVirtualPaper } from '@/lib/reclassify';
import { api } from '@/lib/api';
import { exportAssessment, type ExportFormat, type QuestionData } from '@/lib/eval-export-utils';
import { downloadPaperAsDocx } from '@/lib/eval-docx-export';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { difficultyLabel, difficultyPill } from '@/lib/eval-difficulty';
import { translationCopy } from '@/lib/question-language';

export function EvalPapersList() {
  const navigate = useNavigate();
  const { data: papers, isLoading } = useEvalPapers();
  const deletePaper = useDeleteEvalPaper();
  const updateMeta = useUpdateEvalPaperMeta();
  const [search, setSearch] = useState('');
  const [editPaper, setEditPaper] = useState<any | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [addToPaper, setAddToPaper] = useState<any | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [reclassifyOpen, setReclassifyOpen] = useState(false);
  const qc = useQueryClient();

  // The id itself comes from `reclassify.ts`, which is also where the rule lives
  // that this collection cannot be classified — one definition of the string.
  const isCustomCollection = (p: any) => isVirtualPaper(p) || p?.source_type === 'manual';

  const filtered = useMemo(() => {
    if (!papers) return [];
    let result = papers;
    if (search) {
      const lower = search.toLowerCase();
      result = result.filter((p: any) => p.title?.toLowerCase().includes(lower));
    }
    // Pin the "Custom Questions" collection (manually-added questions) to the front.
    result = [...result].sort((a: any, b: any) => Number(isCustomCollection(b)) - Number(isCustomCollection(a)));
    return result;
  }, [papers, search]);

  const { visible: visiblePapers, sentinelRef, hasMore, shown, total } = useInfiniteList<any>(filtered, 24);

  const handleDownloadPaper = async (paper: any, fmt: ExportFormat) => {
    setDownloadingId(paper.id);
    try {
      const raw = await api.get<any[]>(`/api/v1/evaluation/papers/${paper.id}/questions`);
      const questions = (raw || []).map((q: any) => ({
        ...q,
        text: q.question_text ?? q.text,
        type: q.question_type ?? q.type,
        points: q.marks ?? q.points ?? 1,
        correct_answer: q.correct_answer,
      }));
      if (fmt === 'docx') {
        await downloadPaperAsDocx(paper, questions);
      } else {
        const qs: QuestionData[] = questions.map((q: any) => ({
          text: q.text || '', type: q.type || '', points: q.points || 1,
          subject: q.subject, difficulty: q.difficulty, options: q.options,
          correct_answer: q.correct_answer, explanation: q.explanation, pairs: q.pairs,
          translations: q.translations,
        }));
        // Collections are pure question sets — no assessment metadata
        await exportAssessment([], qs, paper.title || 'Paper', fmt);
      }
      // Say whether Tamil made it in. An English-only file used to arrive with no
      // hint of why, which looks identical to the export dropping the Tamil.
      const withTamil = questions.filter((q: any) => translationCopy(q)).length;
      if (withTamil > 0) {
        toast.success(`Paper downloaded — English + தமிழ் (${withTamil} of ${questions.length} questions)`);
      } else {
        toast.warning('Downloaded in English only — this collection has no Tamil translations saved on its questions.');
      }
    } catch {
      toast.error('Failed to download paper');
    } finally {
      setDownloadingId(null);
    }
  };

  const openEdit = (paper: any) => {
    setEditPaper(paper);
    setEditTitle(paper.title);
  };

  const saveEdit = () => {
    if (!editPaper) return;
    updateMeta.mutate({ id: editPaper.id, title: editTitle });
    setEditPaper(null);
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search question sets..." className="pl-9" />
        </div>

        {/* Repairs collections whose stored difficulty and level drifted from the
            questions they hold — see TnpscReclassifyDialog. */}
        <Button
          variant="outline"
          onClick={() => setReclassifyOpen(true)}
          disabled={!papers || papers.length === 0}
        >
          <ScanLine className="mr-1.5 h-4 w-4" /> Reclassify by difficulty
        </Button>
      </div>

      <TnpscReclassifyDialog
        open={reclassifyOpen}
        onOpenChange={setReclassifyOpen}
        papers={(papers as any[]) ?? []}
        onApplied={() => qc.invalidateQueries({ queryKey: ['eval-papers'] })}
      />

      {filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <FileText className="h-10 w-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No collections yet. Create your first one.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {visiblePapers.map((paper: any) => (
            <Card key={paper.id} className={`group hover:shadow-md transition-shadow ${isCustomCollection(paper) ? 'border-primary/40 ring-1 ring-primary/20' : ''}`}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <h4 className="font-semibold text-sm truncate">{paper.title}</h4>
                      {isCustomCollection(paper) && (
                        <Badge className="shrink-0 bg-primary/10 text-primary text-[9px] px-1.5 hover:bg-primary/10">Custom</Badge>
                      )}
                    </div>
                    {isCustomCollection(paper) ? (
                      <p className="text-xs text-muted-foreground mt-0.5">Manually added questions</p>
                    ) : (paper.board || paper.grade) ? (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {paper.board && `${paper.board} • `}
                        {paper.grade && `Grade ${paper.grade}`}
                      </p>
                    ) : null}
                  </div>
                  {paper.difficulty && (
                    <Badge variant="outline" className={`text-[10px] shrink-0 ${difficultyPill(paper.difficulty)}`}>
                      {difficultyLabel(paper.difficulty)}
                    </Badge>
                  )}
                </div>

                {/* Stats row */}
                <div className="grid gap-2 grid-cols-1">
                  <div className="bg-muted/50 rounded-lg px-2.5 py-1.5 text-center">
                    <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                      <Hash className="h-3 w-3" /> Questions
                    </p>
                    <p className="text-sm font-semibold">{paper.question_count}</p>
                  </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between pt-1 border-t">
                  <span className="text-[10px] text-muted-foreground">
                    Created {format(new Date(paper.created_at), 'dd MMM yyyy')}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setAddToPaper(paper)} title="Add question">
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(`/org/evaluation/paper/${paper.id}`, { state: { from: '/org/evaluation', tab: 'papers' } })} title="View">
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    {!isCustomCollection(paper) && (
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(paper)} title="Edit">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    <DownloadDropdown
                      onDownload={(fmt) => handleDownloadPaper(paper, fmt)}
                      size="icon"
                      variant="ghost"
                    />
                    {!isCustomCollection(paper) && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Collection?</AlertDialogTitle>
                            <AlertDialogDescription>
                              "{paper.title}" will be removed from your collections and can no longer be used to build new
                              assessments. Assessments already built from it may still contain its questions — check them
                              afterwards. An admin can restore the collection.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deletePaper.mutate(paper.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Delete Collection
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {filtered.length > 0 && (
        <>
          <div ref={sentinelRef} className="h-1" />
          <p className="text-center text-xs text-muted-foreground py-2">
            {hasMore ? `Loading more… (${shown} of ${total})` : `All ${total} papers loaded`}
          </p>
        </>
      )}

      {/* Add Question Dialog */}
      {addToPaper && (
        <AddQuestionDialog
          paperTitle={addToPaper.title}
          defaultSubject={addToPaper.subject}
          defaultDifficulty={addToPaper.difficulty}
          open={!!addToPaper}
          onOpenChange={open => !open && setAddToPaper(null)}
        />
      )}

      {/* Edit Collection Dialog */}
      <Dialog open={!!editPaper} onOpenChange={open => !open && setEditPaper(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Collection</DialogTitle>
          </DialogHeader>
          <div>
            <Label>Title</Label>
            <Input value={editTitle} onChange={e => setEditTitle(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPaper(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={updateMeta.isPending}>
              {updateMeta.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

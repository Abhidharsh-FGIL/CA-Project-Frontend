import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TNPSC_GROUPS, stageUnits, unitDisplayName, unitTopics } from '@/config/tnpsc';
import { bankCategoryCounts } from '@/lib/key-topics';
import { norm } from '@/lib/key-topic-sections';
import { ImagePlus, X, Loader2, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { buildUrl } from '@/lib/api';
import { useCreateEvalQuestion, useEvalQuestions, uploadEvalQuestionImage } from '@/hooks/use-evaluation';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { DIFFICULTY_OPTIONS } from '@/lib/eval-difficulty';

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E'];
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 5;

/** A question or an option: typed text, an uploaded image, or both. */
interface MediaValue {
  text: string;
  imageUrl?: string;
  imageName?: string;
}

const emptyMedia = (): MediaValue => ({ text: '' });
const hasContent = (m: MediaValue) => !!m.text.trim() || !!m.imageUrl;

/** Text box with an optional image under it — used for the question and each option. Either is enough; both are fine. */
function MediaField({
  value,
  onChange,
  textPlaceholder,
  textarea,
}: {
  value: MediaValue;
  onChange: (v: MediaValue) => void;
  textPlaceholder: string;
  textarea?: boolean;
}) {
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file?: File) => {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be 5 MB or smaller.');
      return;
    }
    setUploading(true);
    try {
      const { url, name } = await uploadEvalQuestionImage(file);
      onChange({ ...value, imageUrl: url, imageName: name || file.name });
    } catch (e: any) {
      toast.error(e.message || 'Image upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-1.5">
      {textarea ? (
        <Textarea value={value.text} onChange={e => onChange({ ...value, text: e.target.value })} placeholder={textPlaceholder} rows={3} />
      ) : (
        <Input value={value.text} onChange={e => onChange({ ...value, text: e.target.value })} placeholder={textPlaceholder} />
      )}

      {value.imageUrl ? (
        <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-1.5">
          <img src={buildUrl(value.imageUrl)} alt={value.imageName || 'Uploaded'} className="h-12 w-12 rounded object-cover" />
          <span className="flex-1 truncate text-xs">{value.imageName}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            title="Remove image"
            onClick={() => onChange({ ...value, imageUrl: undefined, imageName: undefined })}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-muted/40">
          {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ImagePlus className="h-3.5 w-3.5" />}
          {uploading ? 'Uploading…' : 'Add image (optional)'}
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={e => {
              void handleFile(e.target.files?.[0]);
              e.target.value = '';
            }}
          />
        </label>
      )}
    </div>
  );
}

export function AddQuestionDialog({
  paperTitle,
  examType,
  defaultSubject,
  defaultDifficulty,
  open,
  onOpenChange,
}: {
  paperTitle: string;
  /** The paper's exam, which the Exam picker starts on. Group 4 when it is not known (a mixed collection). */
  examType?: string;
  defaultSubject?: string;
  defaultDifficulty?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [question, setQuestion] = useState<MediaValue>(emptyMedia());
  const [options, setOptions] = useState<MediaValue[]>([emptyMedia(), emptyMedia(), emptyMedia(), emptyMedia()]);
  const [correct, setCorrect] = useState(0);
  const [subject, setSubject] = useState(defaultSubject || '');
  const [chapter, setChapter] = useState('');
  // The topic is chosen from the unit's key topics, or typed as a new one.
  const [newTopic, setNewTopic] = useState(false);
  const [unitId, setUnitId] = useState('');
  // The exam whose syllabus the unit is chosen from. A collection that belongs to one exam starts on it; a mixed one
  // (e.g. "Custom Questions") starts on Group 4 and the admin picks — the question is filed under the unit, not the paper.
  const [examId, setExamId] = useState<string>(() => (TNPSC_GROUPS.find(g => g.exam_type === examType) ?? TNPSC_GROUPS.find(g => g.id === 'group-4') ?? TNPSC_GROUPS[0]).id);
  const [difficulty, setDifficulty] = useState(defaultDifficulty || 'medium');
  const [explanation, setExplanation] = useState('');
  const createQuestion = useCreateEvalQuestion();

  // The question is filed under a syllabus unit. An exam with no units in the catalog keeps the free-text subject.
  const exams = useMemo(() => TNPSC_GROUPS.filter(g => g.stages.some(st => st.status === 'active')), []);
  const stage = useMemo(() => exams.find(g => g.id === examId)?.stages.find(st => st.status === 'active'), [exams, examId]);
  const units = useMemo(() => stageUnits(stage), [stage]);
  const chosenUnit = units.find(u => u.unit.id === unitId);

  // The key topics of the chosen unit: what the question bank already files under it (with how many questions),
  // then the syllabus's own printed topics that the bank does not hold yet. A topic typed here is new, and from the
  // moment it is saved it is a bank category like the rest - so it appears wherever key topics are picked.
  const { data: bank } = useEvalQuestions();
  const topicOptions = useMemo(() => {
    if (!chosenUnit) return [] as Array<{ name: string; count: number | null }>;
    const fromBank = bankCategoryCounts(stage, chosenUnit.unit, (bank ?? []) as any[]).map(c => ({ name: c.name, count: c.count as number | null }));
    const seen = new Set(fromBank.map(c => norm(c.name)));
    const printed = unitTopics(stage, chosenUnit.unit)
      .filter(t => !seen.has(norm(t.name)))
      .map(t => ({ name: t.name, count: null as number | null }));
    return [...fromBank, ...printed];
  }, [chosenUnit, stage, bank]);

  const reset = () => {
    setQuestion(emptyMedia());
    setOptions([emptyMedia(), emptyMedia(), emptyMedia(), emptyMedia()]);
    setCorrect(0);
    setSubject(defaultSubject || '');
    setChapter('');
    setNewTopic(false);
    setUnitId('');
    setExamId((TNPSC_GROUPS.find(g => g.exam_type === examType) ?? TNPSC_GROUPS.find(g => g.id === 'group-4') ?? TNPSC_GROUPS[0]).id);
    setDifficulty(defaultDifficulty || 'medium');
    setExplanation('');
  };

  const setOption = (i: number, v: MediaValue) => setOptions(os => os.map((o, idx) => (idx === i ? v : o)));
  const addOption = () => setOptions(os => (os.length < MAX_OPTIONS ? [...os, emptyMedia()] : os));
  const removeOption = (i: number) => {
    setOptions(os => os.filter((_, idx) => idx !== i));
    setCorrect(c => (c === i ? 0 : c > i ? c - 1 : c));
  };

  const filledOptions = options.filter(hasContent).length;
  const canSubmit =
    hasContent(question) &&
    filledOptions >= MIN_OPTIONS &&
    hasContent(options[correct]) &&
    (units.length > 0 ? !!chosenUnit : subject.trim().length > 0) &&
    chapter.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) {
      toast.error('Fill the question, at least 2 options (incl. the correct one), unit and topic.');
      return;
    }
    await createQuestion.mutateAsync({
      subject: chosenUnit ? chosenUnit.sectionName : subject.trim(),
      ...(chosenUnit
        ? { stage_id: stage!.id, unit_id: chosenUnit.unit.id, unit_name: unitDisplayName(stage, chosenUnit.unit) }
        : {}),
      chapter: chapter.trim(),
      // The key topic, as the bank files it: the same name under `category`, which is what the key-topic pickers list.
      category: chapter.trim(),
      difficulty,
      // Text and image are independent: send whichever are filled, both when both are.
      question_text: question.text.trim() || null,
      question_image_url: question.imageUrl ?? null,
      options: options.map(o => ({
        text: o.text.trim() || null,
        image_url: o.imageUrl ?? null,
      })),
      correct_index: correct,
      marks: 1.0,
      explanation: explanation.trim() || undefined,
    });
    reset();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Question · <span className="font-normal text-muted-foreground">{paperTitle}</span></DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Question */}
          <div className="space-y-1.5">
            <Label className="text-xs">Question <span className="text-destructive">*</span> <span className="font-normal text-muted-foreground">— text, an image, or both</span></Label>
            <MediaField value={question} onChange={setQuestion} textPlaceholder="Type the question…" textarea />
          </div>

          {/* Options */}
          <div className="space-y-2">
            <Label className="text-xs">Options <span className="text-destructive">*</span> <span className="font-normal text-muted-foreground">— select the correct one</span></Label>
            {options.map((opt, i) => (
              <div key={i} className="flex items-start gap-2 rounded-lg border p-2">
                <button
                  type="button"
                  onClick={() => setCorrect(i)}
                  title="Mark as correct answer"
                  className={cn(
                    'mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-colors',
                    correct === i
                      ? 'border-emerald-500 bg-emerald-500 text-white'
                      : 'border-muted-foreground/30 text-muted-foreground hover:border-emerald-400',
                  )}
                >
                  {correct === i ? <CheckCircle2 className="h-4 w-4" /> : OPTION_LETTERS[i]}
                </button>
                <div className="flex-1 min-w-0">
                  <MediaField value={opt} onChange={v => setOption(i, v)} textPlaceholder={`Option ${OPTION_LETTERS[i]}`} />
                </div>
                {options.length > MIN_OPTIONS && (
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => removeOption(i)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
            {options.length < MAX_OPTIONS && (
              <Button variant="outline" size="sm" className="w-full gap-1 text-xs" onClick={addOption}>
                <Plus className="h-3 w-3" /> Add Option ({options.length}/{MAX_OPTIONS})
              </Button>
            )}
          </div>

          {/* Exam */}
          <div className="space-y-1.5">
            <Label className="text-xs">Exam <span className="text-destructive">*</span></Label>
            <Select
              value={examId}
              onValueChange={v => {
                // The units belong to the exam, so a different exam starts the unit and topic afresh.
                setExamId(v);
                setUnitId('');
                setChapter('');
                setNewTopic(false);
              }}
            >
              <SelectTrigger className="h-10"><SelectValue placeholder="Choose the exam" /></SelectTrigger>
              <SelectContent className="max-h-[60vh]">
                {exams.map(g => (
                  <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subject + Topic */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{units.length > 0 ? 'Unit' : 'Subject'} <span className="text-destructive">*</span></Label>
              {units.length > 0 ? (
                <Select
                  value={unitId || undefined}
                  onValueChange={v => {
                    // A key topic belongs to its unit, so a different unit starts the topic afresh.
                    setUnitId(v);
                    setChapter('');
                    setNewTopic(false);
                  }}
                >
                  <SelectTrigger className="h-10"><SelectValue placeholder="Choose the unit" /></SelectTrigger>
                  <SelectContent className="max-h-[60vh]">
                    {[...new Set(units.map(u => u.sectionName))].map(section => (
                      <SelectGroup key={section}>
                        <SelectLabel>{section}</SelectLabel>
                        {units
                          .filter(u => u.sectionName === section)
                          .map(({ unit: u }) => (
                            <SelectItem key={u.id} value={u.id}>
                              <span className="flex items-center gap-1.5">
                                <span className="w-6 text-[10px] font-bold text-muted-foreground">{u.label ?? '—'}</span>
                                <span>{unitDisplayName(stage, u)}</span>
                              </span>
                            </SelectItem>
                          ))}
                      </SelectGroup>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Reasoning Ability" />
              )}
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">
                {chosenUnit ? 'Key topic' : 'Topic'} <span className="text-destructive">*</span>
              </Label>
              {chosenUnit ? (
                <>
                  <Select
                    value={newTopic ? '__new__' : chapter || undefined}
                    onValueChange={v => {
                      if (v === '__new__') {
                        setNewTopic(true);
                        setChapter('');
                      } else {
                        setNewTopic(false);
                        setChapter(v);
                      }
                    }}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Choose or add a key topic" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[50vh]">
                      <SelectItem value="__new__">
                        <span className="flex items-center gap-1.5 font-semibold text-orange-600">
                          <Plus className="h-3.5 w-3.5" /> New key topic…
                        </span>
                      </SelectItem>
                      {topicOptions.map(t => (
                        <SelectItem key={t.name} value={t.name}>
                          <span className="flex items-center gap-1.5">
                            <span>{t.name}</span>
                            {t.count != null && <span className="text-[10px] text-muted-foreground">· {t.count} Qs</span>}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {newTopic && (
                    <Input autoFocus value={chapter} onChange={e => setChapter(e.target.value)} placeholder="Name the new key topic" />
                  )}
                </>
              ) : (
                <Input value={chapter} onChange={e => setChapter(e.target.value)} placeholder="e.g. Coding-Decoding" />
              )}
            </div>
          </div>

          {/* Difficulty */}
          <div className="space-y-1.5">
            <Label className="text-xs">Difficulty</Label>
            <Select value={difficulty} onValueChange={setDifficulty}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {DIFFICULTY_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Explanation (optional) */}
          <div className="space-y-1.5">
            <Label className="text-xs">Explanation <span className="font-normal text-muted-foreground">(optional)</span></Label>
            <Textarea value={explanation} onChange={e => setExplanation(e.target.value)} placeholder="Why the correct option is right…" rows={2} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => { reset(); onOpenChange(false); }}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || createQuestion.isPending}>
            {createQuestion.isPending ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
            Add Question
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

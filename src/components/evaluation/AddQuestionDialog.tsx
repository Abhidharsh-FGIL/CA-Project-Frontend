import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Type, ImageIcon, Upload, X, Loader2, Plus, Trash2, CheckCircle2 } from 'lucide-react';
import { buildUrl } from '@/lib/api';
import { useCreateEvalQuestion, uploadEvalQuestionImage } from '@/hooks/use-evaluation';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E'];
const MIN_OPTIONS = 2;
const MAX_OPTIONS = 5;

/** A value that is EITHER typed text OR an uploaded image. */
interface MediaValue {
  mode: 'text' | 'image';
  text: string;
  imageUrl?: string;
  imageName?: string;
}

const emptyMedia = (): MediaValue => ({ mode: 'text', text: '' });
const hasContent = (m: MediaValue) => (m.mode === 'text' ? !!m.text.trim() : !!m.imageUrl);

/** Text-or-image input used for the question and each option. */
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
      onChange({ ...value, mode: 'image', imageUrl: url, imageName: name || file.name });
    } catch (e: any) {
      toast.error(e.message || 'Image upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Tabs value={value.mode} onValueChange={m => onChange({ ...value, mode: m as 'text' | 'image' })}>
      <TabsList className="h-7">
        <TabsTrigger value="text" className="text-xs gap-1 px-2"><Type className="h-3 w-3" /> Text</TabsTrigger>
        <TabsTrigger value="image" className="text-xs gap-1 px-2"><ImageIcon className="h-3 w-3" /> Image</TabsTrigger>
      </TabsList>

      <TabsContent value="text" className="mt-1.5">
        {textarea ? (
          <Textarea
            value={value.text}
            onChange={e => onChange({ ...value, text: e.target.value })}
            placeholder={textPlaceholder}
            rows={3}
          />
        ) : (
          <Input
            value={value.text}
            onChange={e => onChange({ ...value, text: e.target.value })}
            placeholder={textPlaceholder}
          />
        )}
      </TabsContent>

      <TabsContent value="image" className="mt-1.5">
        {value.imageUrl ? (
          <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-2">
            <img src={buildUrl(value.imageUrl)} alt={value.imageName || 'Uploaded'} className="h-12 w-12 rounded object-cover" />
            <span className="flex-1 truncate text-xs">{value.imageName}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => onChange({ ...value, imageUrl: undefined, imageName: undefined })}
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        ) : (
          <label className="flex cursor-pointer items-center justify-center gap-1.5 rounded-md border border-dashed py-3 text-xs text-muted-foreground hover:bg-muted/40">
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {uploading ? 'Uploading…' : 'Upload image'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={e => handleFile(e.target.files?.[0])}
            />
          </label>
        )}
      </TabsContent>
    </Tabs>
  );
}

export function AddQuestionDialog({
  paperTitle,
  defaultSubject,
  defaultDifficulty,
  open,
  onOpenChange,
}: {
  paperTitle: string;
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
  const [difficulty, setDifficulty] = useState(defaultDifficulty || 'medium');
  const [explanation, setExplanation] = useState('');
  const createQuestion = useCreateEvalQuestion();

  const reset = () => {
    setQuestion(emptyMedia());
    setOptions([emptyMedia(), emptyMedia(), emptyMedia(), emptyMedia()]);
    setCorrect(0);
    setSubject(defaultSubject || '');
    setChapter('');
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
    subject.trim().length > 0 &&
    chapter.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit) {
      toast.error('Fill the question, at least 2 options (incl. the correct one), subject and topic.');
      return;
    }
    await createQuestion.mutateAsync({
      subject: subject.trim(),
      chapter: chapter.trim(),
      difficulty,
      question_text: question.mode === 'text' ? question.text.trim() || null : null,
      question_image_url: question.mode === 'image' ? question.imageUrl ?? null : null,
      options: options.map(o => ({
        text: o.mode === 'text' ? o.text.trim() || null : null,
        image_url: o.mode === 'image' ? o.imageUrl ?? null : null,
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
            <Label className="text-xs">Question <span className="text-destructive">*</span></Label>
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

          {/* Subject + Topic */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Subject <span className="text-destructive">*</span></Label>
              <Input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. Reasoning Ability" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Topic <span className="text-destructive">*</span></Label>
              <Input value={chapter} onChange={e => setChapter(e.target.value)} placeholder="e.g. Coding-Decoding" />
            </div>
          </div>

          {/* Difficulty */}
          <div className="space-y-1.5">
            <Label className="text-xs">Difficulty</Label>
            <Select value={difficulty} onValueChange={setDifficulty}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="easy">Easy</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="hard">Hard</SelectItem>
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

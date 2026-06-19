import { useState, useRef, KeyboardEvent } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WeightageEditor } from '@/components/personal-assessments/WeightageEditor';
import { distributeEvenly } from '@/lib/distribution-utils';
import { Plus, X, Trash2, Globe, FileText, Upload, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { EvalSubjectConfig, EvalChapterConfig } from '@/hooks/use-evaluation';
import { useUploadEvalSource } from '@/hooks/use-evaluation';

interface EvalSubjectCardProps {
  subject: EvalSubjectConfig;
  index: number;
  canRemove: boolean;
  subjectSuggestions: string[];
  chapterSuggestions: string[];
  onChange: (subject: EvalSubjectConfig) => void;
  onRemove: () => void;
}

export function EvalSubjectCard({
  subject,
  index,
  canRemove,
  subjectSuggestions,
  chapterSuggestions,
  onChange,
  onRemove,
}: EvalSubjectCardProps) {
  const [newChapter, setNewChapter] = useState('');
  const [showSubjectSuggestions, setShowSubjectSuggestions] = useState(false);
  const [showChapterSuggestions, setShowChapterSuggestions] = useState(false);
  const subjectInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadSource = useUploadEvalSource();

  const filteredSubjectSuggestions = subjectSuggestions.filter(
    s => s.toLowerCase().includes(subject.subject.toLowerCase()) && s.toLowerCase() !== subject.subject.toLowerCase()
  );

  const filteredChapterSuggestions = chapterSuggestions.filter(
    c => c.toLowerCase().includes(newChapter.toLowerCase()) &&
      !subject.chapters.some(ch => ch.name.toLowerCase() === c.toLowerCase())
  );

  const addChapter = (name?: string) => {
    const trimmed = (name || newChapter).trim();
    if (!trimmed || subject.chapters.some(ch => ch.name === trimmed)) return;
    const newCh: EvalChapterConfig = {
      id: crypto.randomUUID(),
      name: trimmed,
      weightage: 100,
    };
    const updated = [...subject.chapters, newCh];
    const keys = updated.map(c => c.name);
    const weights = distributeEvenly(keys);
    const chaptersWithWeights = updated.map(c => ({ ...c, weightage: weights[c.name] || 0 }));
    onChange({ ...subject, chapters: chaptersWithWeights });
    setNewChapter('');
    setShowChapterSuggestions(false);
  };

  const removeChapter = (id: string) => {
    const updated = subject.chapters.filter(c => c.id !== id);
    if (updated.length > 0) {
      const keys = updated.map(c => c.name);
      const weights = distributeEvenly(keys);
      const chaptersWithWeights = updated.map(c => ({ ...c, weightage: weights[c.name] || 0 }));
      onChange({ ...subject, chapters: chaptersWithWeights });
    } else {
      onChange({ ...subject, chapters: [] });
    }
  };

  const handleChapterKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addChapter();
    }
  };

  const handleChapterWeightageChange = (weights: Record<string, number>) => {
    const updated = subject.chapters.map(c => ({ ...c, weightage: weights[c.name] || 0 }));
    onChange({ ...subject, chapters: updated });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Show filename immediately while uploading
    onChange({ ...subject, sourceFileName: file.name, sourceRefId: undefined, embedStatus: 'processing', sourceText: undefined });
    try {
      const result = await uploadSource.mutateAsync(file);
      // Use the UUID returned by the backend as sourceRefId; keep filename for display
      onChange({
        ...subject,
        sourceRefId: result.source_ref_id,
        sourceFileName: result.filename,
        sourceText: result.extracted_text,
        embedStatus: 'processing',
      });
    } catch {
      onChange({ ...subject, sourceRefId: undefined, sourceFileName: undefined, embedStatus: undefined, sourceText: undefined });
    }
  };

  return (
    <Card className="border-primary/20">
      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="text-xs">Subject {index + 1}</Badge>
          {canRemove && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onRemove}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          )}
        </div>

        {/* Subject Name with Suggestions */}
        <div className="relative">
          <Label className="text-xs text-muted-foreground">Subject Name <span className="text-destructive">*</span></Label>
          <Input
            ref={subjectInputRef}
            value={subject.subject}
            onChange={e => {
              onChange({ ...subject, subject: e.target.value });
              setShowSubjectSuggestions(true);
            }}
            onFocus={() => setShowSubjectSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSubjectSuggestions(false), 200)}
            placeholder="e.g. Accounting, Taxation, Auditing..."
          />
          {showSubjectSuggestions && filteredSubjectSuggestions.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-popover border border-border rounded-md shadow-md max-h-32 overflow-y-auto">
              {filteredSubjectSuggestions.slice(0, 5).map(s => (
                <button
                  key={s}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors"
                  onMouseDown={() => {
                    onChange({ ...subject, subject: s });
                    setShowSubjectSuggestions(false);
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Source Type */}
        <div>
          <Label className="text-xs text-muted-foreground">Source</Label>
          <Tabs
            value={subject.sourceType}
            onValueChange={v => onChange({ ...subject, sourceType: v as any })}
          >
            <TabsList className="w-full grid grid-cols-3 h-8">
              <TabsTrigger value="online" className="text-xs gap-1">
                <Globe className="h-3 w-3" /> Topics
              </TabsTrigger>
              <TabsTrigger value="text" className="text-xs gap-1">
                <FileText className="h-3 w-3" /> Paste
              </TabsTrigger>
              <TabsTrigger value="file" className="text-xs gap-1">
                <Upload className="h-3 w-3" /> File
              </TabsTrigger>
            </TabsList>

            <TabsContent value="text" className="mt-2">
              <Textarea
                value={subject.sourceText || ''}
                onChange={e => onChange({ ...subject, sourceText: e.target.value })}
                placeholder="Paste content for this subject..."
                rows={3}
              />
            </TabsContent>

            <TabsContent value="file" className="mt-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.txt,.md"
                className="hidden"
                onChange={handleFileSelect}
              />
              {subject.sourceFileName || subject.sourceRefId ? (
                <div className="flex items-center gap-2 p-2 border rounded-md bg-muted/30">
                  {uploadSource.isPending ? (
                    <Loader2 className="h-4 w-4 text-muted-foreground shrink-0 animate-spin" />
                  ) : (
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}

                  <span className="text-sm truncate flex-1">
                    {uploadSource.isPending
                      ? `Uploading ${subject.sourceFileName ?? 'file'}…`
                      : (subject.sourceFileName ?? subject.sourceRefId)}
                  </span>

                  {!uploadSource.isPending && (
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      Uploaded
                    </Badge>
                  )}

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => onChange({ ...subject, sourceRefId: undefined, sourceFileName: undefined, sourceText: undefined, embedStatus: undefined })}
                    disabled={uploadSource.isPending}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 w-full"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="h-3.5 w-3.5" /> Choose File
                </Button>
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Chapters */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Chapters / Topics</Label>

          {subject.chapters.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {subject.chapters.map(ch => (
                <Badge key={ch.id} variant="secondary" className="gap-1 pr-1">
                  {ch.name}
                  <button
                    type="button"
                    onClick={() => removeChapter(ch.id)}
                    className="ml-0.5 rounded-full p-0.5 hover:bg-foreground/10 transition-colors"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}

          <div className="relative">
            <div className="flex gap-2">
              <Input
                value={newChapter}
                onChange={e => {
                  setNewChapter(e.target.value);
                  setShowChapterSuggestions(true);
                }}
                onKeyDown={handleChapterKeyDown}
                onFocus={() => setShowChapterSuggestions(true)}
                onBlur={() => setTimeout(() => setShowChapterSuggestions(false), 200)}
                placeholder="Type chapter name and press Enter"
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="shrink-0"
                onClick={() => addChapter()}
                disabled={!newChapter.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {showChapterSuggestions && filteredChapterSuggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-popover border border-border rounded-md shadow-md max-h-32 overflow-y-auto">
                {filteredChapterSuggestions.slice(0, 5).map(c => (
                  <button
                    key={c}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-accent transition-colors"
                    onMouseDown={() => addChapter(c)}
                  >
                    {c}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Chapter Weightage */}
          {subject.chapters.length >= 2 && (
            <div className="space-y-2 pt-2 border-t border-border/50">
              <Label className="text-xs text-muted-foreground">Chapter Weightage</Label>
              <WeightageEditor
                items={subject.chapters.map(c => ({ key: c.name, label: c.name }))}
                weights={Object.fromEntries(subject.chapters.map(c => [c.name, c.weightage]))}
                onChange={handleChapterWeightageChange}
              />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

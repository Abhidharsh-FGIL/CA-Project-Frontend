import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, X } from 'lucide-react';

interface EvalFilterBarProps {
  search: string;
  onSearchChange: (v: string) => void;
  subject: string;
  onSubjectChange: (v: string) => void;
  type: string;
  onTypeChange: (v: string) => void;
  difficulty: string;
  onDifficultyChange: (v: string) => void;
  source?: string;
  onSourceChange?: (v: string) => void;
  subjects: string[];
  onReset: () => void;
}

export function EvalFilterBar({
  search, onSearchChange,
  subject, onSubjectChange,
  type, onTypeChange,
  difficulty, onDifficultyChange,
  source, onSourceChange,
  subjects,
  onReset,
}: EvalFilterBarProps) {
  const hasFilters = search || subject || type || difficulty || source;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => onSearchChange(e.target.value)}
          placeholder="Search questions..."
          className="pl-9"
        />
      </div>

      {/* Sized for the names that actually arrive. A real subject here reads
          "History, Culture, Heritage and Socio-Political Movements of Tamil
          Nadu" — at the 140px this used to be, the trigger's line-clamp cut
          every one of them to a few words, and an un-truncated 60-character
          item stretched the dropdown panel past the edge of the screen. The
          trigger carries the full name as a tooltip for the part that still
          doesn't fit, and items wrap rather than truncate so nothing is
          unreadable. */}
      <Select value={subject} onValueChange={onSubjectChange}>
        <SelectTrigger
          className="w-[160px] sm:w-[220px]"
          title={subject && subject !== 'all' ? subject : undefined}
        >
          <SelectValue placeholder="Subject" />
        </SelectTrigger>
        <SelectContent className="max-w-[min(92vw,28rem)]">
          <SelectItem value="all">All Subjects</SelectItem>
          {subjects
            .filter(s => s && s.trim() !== '')
            .map(s => (
              <SelectItem key={s} value={s} className="whitespace-normal leading-snug">
                {s}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>

<Select value={difficulty} onValueChange={onDifficultyChange}>
        <SelectTrigger className="w-[120px]">
          <SelectValue placeholder="Difficulty" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="easy">Easy</SelectItem>
          <SelectItem value="medium">Medium</SelectItem>
          <SelectItem value="hard">Hard</SelectItem>
        </SelectContent>
      </Select>

      {onSourceChange && (
        <Select value={source || ''} onValueChange={onSourceChange}>
          <SelectTrigger className="w-[120px]">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sources</SelectItem>
            <SelectItem value="online">Online</SelectItem>
            <SelectItem value="text">Text</SelectItem>
            <SelectItem value="file">File</SelectItem>
          </SelectContent>
        </Select>
      )}

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={onReset} className="gap-1 text-xs">
          <X className="h-3 w-3" /> Clear
        </Button>
      )}
    </div>
  );
}

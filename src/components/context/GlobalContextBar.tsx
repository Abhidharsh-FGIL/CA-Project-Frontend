import { useAIContext } from '@/contexts/AIContextProvider';

import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { GraduationCap, BookOpen, Settings2, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';
import { useAllowedBoards } from '@/hooks/use-boards';
const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'ta', label: 'Tamil' },
];
const LANG_MAP: Record<string, string> = { en: 'EN', hi: 'HI', ta: 'TA' };

export function GlobalContextBar() {
  const {
    studentMode, grade, board, language,
    setStudentMode, setGrade, setBoard, setLanguage,
    orgLocked, isLoading,
  } = useAIContext();

  const { plan, triggerUpgrade, isOrgContext } = useSubscription();
  const { activeOrgRole } = useWorkspaceContext();
  const isFreePlan = !isOrgContext && plan === 'free';

  const BOARDS = useAllowedBoards();

  if (isLoading) return null;

  // Students in an org with academic-context enforcement are fully locked to their member grade/board.
  const studentEnforced = !!orgLocked?.enforce_academic_context && activeOrgRole === 'student';
  const gradeDisabled = !!orgLocked?.locked_grade || studentEnforced;
  const boardDisabled = !!orgLocked?.locked_board || studentEnforced;
  const studentModeDisabled = !!orgLocked?.enforce_academic_context;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs font-medium hover:bg-accent">
          <Settings2 className="h-3.5 w-3.5 text-muted-foreground" />
          <div className="hidden sm:flex items-center gap-1">
            {studentMode ? (
              <>
                {grade && <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-medium rounded">Grade {grade}</Badge>}
                {board && <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-medium rounded">{board}</Badge>}
                {!grade && !board && <Badge variant="secondary" className="h-5 px-1.5 text-[10px] font-medium rounded">Student</Badge>}
              </>
            ) : (
              <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-medium rounded">General</Badge>
            )}
            <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-medium rounded">{LANG_MAP[language] || language.toUpperCase()}</Badge>
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="end">
        <div className="space-y-4">
          <h4 className="font-medium text-sm">Learning Context</h4>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
              <Label className="text-sm cursor-pointer" htmlFor="ctx-student-mode">Student Mode</Label>
            </div>
            <Switch
              id="ctx-student-mode"
              checked={studentMode}
              onCheckedChange={(v) => {
                setStudentMode(v);
                if (v) {
                  // Auto-set defaults when enabling student mode
                  if (!grade) setGrade(1);
                  if (!board) setBoard(BOARDS[0]);
                }
              }}
              disabled={studentModeDisabled}
            />
          </div>

          <AnimatePresence>
            {studentMode && (
              <motion.div
                initial={{ opacity: 0, height: 0, overflow: 'hidden' }}
                animate={{ opacity: 1, height: 'auto', overflow: 'visible', transition: { overflow: { delay: 0.2 } } }}
                exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                className="space-y-3"
              >
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Grade <span className="text-destructive">*</span></Label>
                    <Select value={grade?.toString() || '1'} onValueChange={(v) => setGrade(parseInt(v))} disabled={gradeDisabled}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => (
                          <SelectItem key={i + 1} value={String(i + 1)}>Grade {i + 1}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Board <span className="text-destructive">*</span></Label>
                    <Select value={board || BOARDS[0]} onValueChange={(v) => setBoard(v)} disabled={boardDisabled}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Select" /></SelectTrigger>
                      <SelectContent>
                        {BOARDS.map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="h-px bg-border" />

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Language</Label>
            <Select
              value={language}
              onValueChange={(v) => {
                if (isFreePlan && v !== 'en') {
                  triggerUpgrade('ai_multilingual');
                  return;
                }
                setLanguage(v);
              }}
            >
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {LANGUAGES.map(l => (
                  <SelectItem key={l.value} value={l.value} className={isFreePlan && l.value !== 'en' ? 'opacity-60' : ''}>
                    <span className="flex items-center gap-1.5">
                      {l.label}
                      {isFreePlan && l.value !== 'en' && <Lock className="h-3 w-3 text-muted-foreground" />}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {orgLocked?.enforce_academic_context && (
            <Badge variant="secondary" className="text-[10px] h-5">
              <BookOpen className="h-3 w-3 mr-1" />
              Org Locked
            </Badge>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

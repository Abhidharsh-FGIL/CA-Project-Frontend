import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Mail, Upload, X, Send, Plus, ArrowLeft, Download } from 'lucide-react';
import { useSendEvalInvitations, useEvalAssessmentDetail, type AssessmentInviteDetails } from '@/hooks/use-eval-assessments';
import { toast } from 'sonner';

interface Props {
  assessmentId: string;
  onDone: () => void;
  onBack?: () => void;
}

export function EvalStudentDistributor({ assessmentId, onDone, onBack }: Props) {
  const sendInvitations = useSendEvalInvitations();
  const { data: assessment } = useEvalAssessmentDetail(assessmentId);
  const [emailInput, setEmailInput] = useState('');
  const [emailList, setEmailList] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const addEmails = () => {
    const emails = emailInput
      .split(/[,;\n]+/)
      .map(e => e.trim().toLowerCase())
      .filter(e => e && e.includes('@'));
    setEmailList(prev => [...new Set([...prev, ...emails])]);
    setEmailInput('');
  };

  const removeEmail = (email: string) => {
    setEmailList(prev => prev.filter(e => e !== email));
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const emails = text
        .split(/[\n,;]+/)
        .map(line => line.trim().toLowerCase())
        .filter(e => e && e.includes('@'));
      setEmailList(prev => [...new Set([...prev, ...emails])]);
      toast.success(`${emails.length} emails imported`);
    };
    reader.readAsText(file);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleSend = async () => {
    if (emailList.length === 0) {
      toast.error('Add at least one email to distribute');
      return;
    }
    // Send the assessment's details along with the invitations so the backend
    // can build a rich invite email (title, mode, duration, marks, deadline…).
    const assessmentDetails: AssessmentInviteDetails | undefined = assessment
      ? {
          title: assessment.title ?? null,
          mode: assessment.mode ?? null,
          difficulty: assessment.difficulty ?? null,
          subject: assessment.subject ?? null,
          question_count: assessment.question_count ?? null,
          max_score: assessment.max_score ?? null,
          time_limit_seconds: assessment.time_limit_seconds ?? null,
          due_date: assessment.due_date ?? null,
          negative_marking: assessment.negative_marking ?? null,
          negative_mark_value: assessment.negative_mark_value ?? null,
          max_attempts: assessment.max_attempts ?? null,
          course_name: assessment.course_name ?? null,
        }
      : undefined;

    await sendInvitations.mutateAsync({ assessmentId, emails: emailList, assessmentDetails });
    onDone();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack} className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <h3 className="text-lg font-semibold">Distribute Assessment</h3>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Invite via Email
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Textarea
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              placeholder="Enter emails separated by commas or new lines..."
              rows={3}
            />
            <Button variant="outline" size="sm" className="mt-2 gap-1" onClick={addEmails} disabled={!emailInput.trim()}>
              <Plus className="h-3 w-3" /> Add Emails
            </Button>
          </div>

          <div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,.txt"
              className="hidden"
              onChange={handleCSVUpload}
            />
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="gap-1" onClick={() => fileRef.current?.click()}>
                <Upload className="h-3 w-3" /> Bulk Upload (CSV)
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => {
                const csv = `email\nstudent1@school.edu\nstudent2@school.edu\nstudent3@school.edu`;
                const blob = new Blob([csv], { type: 'text/csv' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a'); a.href = url; a.download = 'eval_students_sample.csv'; a.click(); URL.revokeObjectURL(url);
              }}>
                <Download className="h-3.5 w-3.5" /> Sample CSV
              </Button>
            </div>
          </div>

          {emailList.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {emailList.map(email => (
                <Badge key={email} variant="secondary" className="text-xs gap-1">
                  {email}
                  <X className="h-3 w-3 cursor-pointer" onClick={() => removeEmail(email)} />
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {emailList.length} student{emailList.length !== 1 ? 's' : ''} will be invited
        </p>
        <Button
          className="gap-2"
          onClick={handleSend}
          disabled={emailList.length === 0 || sendInvitations.isPending}
        >
          {sendInvitations.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Send Invitations
        </Button>
      </div>
    </div>
  );
}

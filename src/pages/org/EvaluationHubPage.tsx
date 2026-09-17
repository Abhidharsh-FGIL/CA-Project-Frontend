import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { GenVerseShell } from '@/components/layout/GenVerseShell';
import { PageHeader } from '@/components/layout/AppShell';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ClipboardCheck, Database, List, FileText, BarChart3, FileUp } from 'lucide-react';
import { EvalPaperImportPanel } from '@/components/evaluation/EvalPaperImportPanel';
import { useWorkspaceContext } from '@/contexts/WorkspaceContext';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { EvalPaperConfigPanel } from '@/components/evaluation/EvalPaperConfigPanel';
import { EvalQuestionBank } from '@/components/evaluation/EvalQuestionBank';
import { EvalPapersList } from '@/components/evaluation/EvalPapersList';
import { useStartEvalGeneration } from '@/hooks/use-evaluation';
import type { EvalPaperConfig } from '@/hooks/use-evaluation';
import { EvalAssessmentConfigPanel } from '@/components/evaluation/EvalAssessmentConfigPanel';
import { EvalStudentDistributor } from '@/components/evaluation/EvalStudentDistributor';
import { EvalAssessmentsList } from '@/components/evaluation/EvalAssessmentsList';
import { EvalAssessmentReport } from '@/components/evaluation/EvalAssessmentReport';
import { EvalReportsList } from '@/components/evaluation/EvalReportsList';

const DEFAULT_CONFIG: EvalPaperConfig = {
  title: '',
  difficulty: 'medium',
  mode: 'exam',
  negativeMarking: false,
  questionCount: 20,
  questionTypes: ['mcq'],
  mcqSubtypes: ['standard'],
  typeWeightage: { mcq: 100 },
  subjects: [
    {
      id: crypto.randomUUID(),
      subject: '',
      weightage: 100,
      sourceType: 'online',
      chapters: [],
    },
  ],
};

type AssessmentView = 'list' | 'create' | 'distribute';

export function EvaluationHubPage() {
  const navigate = useNavigate();
  const { hasEvaluation } = useWorkspaceContext();
  const { canAccessFeature } = useSubscription();
  const [config, setConfig] = useState<EvalPaperConfig>(DEFAULT_CONFIG);

  // Assessment tab state
  const [assessmentView, setAssessmentView] = useState<AssessmentView>('list');
  const [activeAssessmentId, setActiveAssessmentId] = useState<string | null>(null);

  // Reports tab state
  const [reportAssessmentId, setReportAssessmentId] = useState<string | null>(null);
  const location = useLocation();
  const [activeTab, setActiveTab] = useState(() => {
    return (location.state as any)?.tab || 'create';
  });

  // Restore tab when navigating back with state
  useEffect(() => {
    const tab = (location.state as any)?.tab;
    if (tab) setActiveTab(tab);
  }, [location.state]);

  const startGeneration = useStartEvalGeneration();

  useEffect(() => {
    if (!hasEvaluation) {
      navigate('/org', { replace: true });
    }
  }, [hasEvaluation, navigate]);

  if (!hasEvaluation) return null;

  const handleGenerate = async () => {
    try {
      const jobId = await startGeneration.mutateAsync(config);
      navigate(`/org/evaluation/generating/${jobId}`, { state: { config } });
    } catch {
      // Error handled by mutation's onError
    }
  };

  // Assessment tab handlers
  const handleAssessmentCreated = (assessmentId: string) => {
    setActiveAssessmentId(assessmentId);
    setAssessmentView('distribute');
  };

  const handleDistributeDone = () => {
    setAssessmentView('list');
    setActiveAssessmentId(null);
  };

  const handleDistribute = (assessmentId: string) => {
    setActiveAssessmentId(assessmentId);
    setAssessmentView('distribute');
  };

  const handleViewReport = (assessmentId: string) => {
    setReportAssessmentId(assessmentId);
    setActiveTab('reports');
  };

  return (
    <GenVerseShell>
      <PageHeader
        title="Evaluation Hub"
        description="Generate question sets, manage the bank, and run assessments."
        breadcrumbs={[{ label: 'Admin', href: '/org/dashboard' }, { label: 'Evaluation Hub' }]}
      />

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <div className="-mx-4 px-4 lg:mx-0 lg:px-0 overflow-x-auto scrollbar-thin">
            <TabsList className="flex w-max lg:w-auto">
              <TabsTrigger value="create" className="gap-1.5 flex-shrink-0 whitespace-nowrap">
                <ClipboardCheck className="h-4 w-4" />
                Generate Question Set
              </TabsTrigger>
              <TabsTrigger value="import" className="gap-1.5 flex-shrink-0 whitespace-nowrap">
                <FileUp className="h-4 w-4" />
                Import Paper
              </TabsTrigger>
              <TabsTrigger value="bank" className="gap-1.5 flex-shrink-0 whitespace-nowrap">
                <Database className="h-4 w-4" />
                Question Bank
              </TabsTrigger>
              <TabsTrigger value="papers" className="gap-1.5 flex-shrink-0 whitespace-nowrap">
                <List className="h-4 w-4" />
                Collections
              </TabsTrigger>
              <TabsTrigger value="assessments" className="gap-1.5 flex-shrink-0 whitespace-nowrap">
                <FileText className="h-4 w-4" />
                Assessments
              </TabsTrigger>
              <TabsTrigger value="reports" className="gap-1.5 flex-shrink-0 whitespace-nowrap">
                <BarChart3 className="h-4 w-4" />
                Reports
              </TabsTrigger>
            </TabsList>
          </div>

          {canAccessFeature('evaluation_hub', 'paper_creation') && (
            <TabsContent value="create">
              <EvalPaperConfigPanel
                config={config}
                onChange={setConfig}
                onGenerate={handleGenerate}
                isGenerating={startGeneration.isPending}
                generatingMessage={startGeneration.isPending ? 'Queuing job…' : ''}
              />
            </TabsContent>
          )}

          {canAccessFeature('evaluation_hub', 'paper_creation') && (
            <TabsContent value="import">
              <EvalPaperImportPanel
                onImported={() => setActiveTab('papers')}
              />
            </TabsContent>
          )}

          {canAccessFeature('evaluation_hub', 'question_bank') && (
            <TabsContent value="bank">
              <EvalQuestionBank />
            </TabsContent>
          )}

          <TabsContent value="papers">
            <EvalPapersList />
          </TabsContent>

          <TabsContent value="assessments">
            {assessmentView === 'create' ? (
              <EvalAssessmentConfigPanel onCreated={handleAssessmentCreated} onBack={() => setAssessmentView('list')} />
            ) : assessmentView === 'distribute' && activeAssessmentId ? (
              <EvalStudentDistributor
                assessmentId={activeAssessmentId}
                onDone={handleDistributeDone}
                onBack={() => setAssessmentView('list')}
              />
            ) : (
              <div className="space-y-4">
                <div className="flex justify-end">
                  <button
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                    onClick={() => setAssessmentView('create')}
                  >
                    <FileText className="h-4 w-4" />
                    Create Assessment
                  </button>
                </div>
                <EvalAssessmentsList
                  onDistribute={handleDistribute}
                />
              </div>
            )}
          </TabsContent>

          {canAccessFeature('evaluation_hub', 'reports') && (
            <TabsContent value="reports">
              {reportAssessmentId ? (
                <EvalAssessmentReport
                  assessmentId={reportAssessmentId}
                  onBack={() => setReportAssessmentId(null)}
                />
              ) : (
                <EvalReportsList onViewReport={handleViewReport} />
              )}
            </TabsContent>
          )}
        </Tabs>
    </GenVerseShell>
  );
}

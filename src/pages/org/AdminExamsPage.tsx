import { GenVerseShell } from '@/components/layout/GenVerseShell';
import { PageHeader } from '@/components/layout/AppShell';
import { ExamCardsManager } from '@/components/admin/ExamCardsManager';

/**
 * Admin → Exams: the cards on the students' Exams page. Switch an examination on to open it, or off to show it as Coming
 * soon; set each card's wording, emblem and colour; put the cards in order; add exams that are announced but not built yet.
 */
export default function AdminExamsPage() {
  return (
    <GenVerseShell>
      <PageHeader
        title="Exams"
        description="The cards on the Exams page: switch an exam Active to open it, or off to show Coming soon, and set each card’s image, wording and order."
        breadcrumbs={[{ label: 'Dashboard', href: '/org/dashboard' }, { label: 'Exams' }]}
      />
      <ExamCardsManager />
    </GenVerseShell>
  );
}

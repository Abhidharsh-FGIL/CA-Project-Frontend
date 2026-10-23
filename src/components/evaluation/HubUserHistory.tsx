import { useState } from 'react';
import { UserHistoryList } from '@/pages/org/AdminHistoryPage';
import { UserHistoryDetail } from '@/pages/org/AdminUserHistoryPage';

interface Props {
  /** Opens the report of one assessment attempt, inside the hub. */
  onViewReport: (assessmentId: string, attempt?: { attemptId: string; label: string }) => void;
}

/**
 * The Evaluation Hub's History tab: the same server-backed history as Admin → History, by user.
 *
 * It used to add up attempts itself, by reading each assessment, and so missed anything that was not an
 * assessment attempt and stopped at the newest assessments. The server now counts every attempt — tests and
 * assessments both — so this reads that: one figure everywhere, 28 where Users says 28.
 */
export function HubUserHistory({ onViewReport }: Props) {
  const [userId, setUserId] = useState<string | null>(null);
  const [name, setName] = useState('');

  if (userId) {
    return (
      <UserHistoryDetail
        userId={userId}
        onBack={() => setUserId(null)}
        onOpenAttempt={a => onViewReport(a.test_id, { attemptId: a.attempt_id, label: name })}
      />
    );
  }
  return (
    <UserHistoryList
      onOpen={u => {
        setName(u.name || u.email);
        setUserId(u.user_id);
      }}
    />
  );
}

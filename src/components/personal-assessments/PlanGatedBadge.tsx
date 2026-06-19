import { Badge } from '@/components/ui/badge';
import { Lock } from 'lucide-react';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { cn } from '@/lib/utils';

interface PlanGatedBadgeProps {
  featureKey: string;
  label: string;
  className?: string;
}

export function PlanGatedBadge({ featureKey, label, className }: PlanGatedBadgeProps) {
  const { canAccess, triggerUpgrade } = useSubscription();
  const locked = !canAccess(featureKey);

  if (!locked) return null;

  return (
    <Badge
      variant="outline"
      className={cn('gap-1 cursor-pointer text-muted-foreground hover:text-primary transition-colors', className)}
      onClick={() => triggerUpgrade(featureKey)}
    >
      <Lock className="h-3 w-3" />
      {label}
    </Badge>
  );
}

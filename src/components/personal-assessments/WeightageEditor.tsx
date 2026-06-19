import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { validateWeightage, distributeEvenly } from '@/lib/distribution-utils';

export interface WeightageEditorProps {
  items: { key: string; label: string }[];
  weights: Record<string, number>;
  onChange: (weights: Record<string, number>) => void;
  disabled?: boolean;
}

export function WeightageEditor({ items, weights, onChange, disabled }: WeightageEditorProps) {
  const { valid, total, errors } = validateWeightage(weights);
  const singleItem = items.length === 1;

  const handleChange = (key: string, raw: string) => {
    const val = raw === '' ? 0 : parseFloat(raw);
    onChange({ ...weights, [key]: isNaN(val) ? 0 : val });
  };

  const handleAutoDistribute = () => {
    onChange(distributeEvenly(items.map((i) => i.key)));
  };

  const barColor = valid ? 'bg-primary' : 'bg-destructive';

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {items.map((item) => (
          <div key={item.key} className="flex items-center gap-3">
            <span className="text-sm min-w-[120px] truncate">{item.label}</span>
            <div className="flex-1 max-w-[120px]">
              <Input
                type="number"
                step="0.01"
                min="1"
                max="100"
                value={weights[item.key] ?? ''}
                onChange={(e) => handleChange(item.key, e.target.value)}
                disabled={disabled || singleItem}
                className={cn(
                  'h-8 text-sm',
                  errors[item.key] && 'border-destructive'
                )}
                placeholder="%"
              />
            </div>
            <span className="text-xs text-muted-foreground">%</span>
            {errors[item.key] && (
              <span className="text-xs text-destructive">{errors[item.key]}</span>
            )}
          </div>
        ))}
      </div>

      {/* Progress bar and total */}
      <div className="space-y-1.5">
        <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-300', barColor)}
            style={{ width: `${Math.min(total, 100)}%` }}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className={cn('text-xs font-medium', valid ? 'text-primary' : 'text-destructive')}>
            Total: {total.toFixed(2)}% / 100%
          </span>
          {!singleItem && !disabled && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs gap-1 px-2"
              onClick={handleAutoDistribute}
            >
              <RotateCcw className="h-3 w-3" />
              Auto
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

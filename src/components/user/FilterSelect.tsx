/**
 * A small pill dropdown for dashboard filters.
 *
 * Replaces the native `<select>`, which renders as an OS control that doesn't read
 * as clickable next to the rest of the UI. Built on Radix so keyboard navigation,
 * focus return and click-outside come for free.
 */
import { Check, ChevronDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

export interface FilterOption<T extends string> {
  value: T;
  label: string;
  /** Optional second line in the menu — context the label alone can't carry. */
  hint?: string;
}

interface FilterSelectProps<T extends string> {
  value: T;
  options: FilterOption<T>[];
  onChange: (value: T) => void;
  /** Rendered before the label on the trigger, e.g. an icon or a muted prefix. */
  leading?: React.ReactNode;
  /** Shown when the selection is not the first (default) option. */
  size?: 'sm' | 'md';
  align?: 'start' | 'end';
  className?: string;
  ariaLabel?: string;
}

export function FilterSelect<T extends string>({
  value,
  options,
  onChange,
  leading,
  size = 'md',
  align = 'end',
  className,
  ariaLabel,
}: FilterSelectProps<T>) {
  const active = options.find(o => o.value === value) ?? options[0];
  // A non-default selection is tinted, so a filtered view is never mistaken for the
  // full picture at a glance.
  const filtered = options.length > 0 && value !== options[0].value;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={ariaLabel}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-xl border font-semibold transition-colors',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 dark:focus-visible:ring-indigo-700',
            size === 'sm' ? 'h-8 px-2.5 text-[11px]' : 'h-9 px-3 text-xs',
            filtered
              ? 'border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-500/20'
              : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800',
            className,
          )}
        >
          {leading}
          <span className="truncate max-w-[9rem]">{active?.label}</span>
          <ChevronDown className="w-3.5 h-3.5 opacity-60 flex-shrink-0" />
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align={align} className="min-w-[11rem] rounded-xl p-1">
        {options.map(o => (
          <DropdownMenuItem
            key={o.value}
            onSelect={() => onChange(o.value)}
            className={cn(
              'rounded-lg text-xs cursor-pointer gap-2 py-2',
              o.value === value && 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300',
            )}
          >
            <span className="flex-1 min-w-0">
              <span className="block font-medium truncate">{o.label}</span>
              {o.hint && <span className="block text-[10px] text-gray-400 truncate">{o.hint}</span>}
            </span>
            {o.value === value && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

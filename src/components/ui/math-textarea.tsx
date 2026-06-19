import { useState, useRef, useEffect } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { MathText } from '@/components/ui/MathText';
import { cn } from '@/lib/utils';

interface MathTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  textareaRef?: (el: HTMLTextAreaElement | null) => void;
}

/**
 * A textarea that renders LaTeX when blurred and shows raw editable text when focused.
 * Click the rendered preview to switch to edit mode.
 */
export function MathTextarea({ value, onChange, placeholder, className, textareaRef }: MathTextareaProps) {
  const [editing, setEditing] = useState(false);
  const internalRef = useRef<HTMLTextAreaElement>(null);
  const hasMath = value && value.includes('$');

  useEffect(() => {
    if (editing && internalRef.current) {
      internalRef.current.focus();
      // Place cursor at end
      const len = internalRef.current.value.length;
      internalRef.current.setSelectionRange(len, len);
    }
  }, [editing]);

  const setRef = (el: HTMLTextAreaElement | null) => {
    (internalRef as any).current = el;
    textareaRef?.(el);
  };

  if (!hasMath || editing) {
    return (
      <Textarea
        ref={setRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setEditing(false)}
        placeholder={placeholder}
        className={cn('min-h-[60px]', className)}
      />
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setEditing(true)}
      onFocus={() => setEditing(true)}
      className={cn(
        'rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[60px] cursor-text',
        'hover:border-ring transition-colors',
        className
      )}
    >
      <MathText text={value} as="div" className="text-sm" />
    </div>
  );
}

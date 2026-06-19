import { useState, useRef, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { MathText } from '@/components/ui/MathText';
import { cn } from '@/lib/utils';

interface MathInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
}

/**
 * An input that renders LaTeX when blurred and shows raw text when focused.
 * Falls back to a normal Input when the value doesn't contain `$`.
 */
export function MathInput({ value, onChange, placeholder, className, readOnly }: MathInputProps) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasMath = value && value.includes('$');

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editing]);

  if (!hasMath || editing) {
    return (
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => setEditing(false)}
        placeholder={placeholder}
        className={cn(className)}
        readOnly={readOnly}
      />
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => { if (!readOnly) setEditing(true); }}
      onFocus={() => { if (!readOnly) setEditing(true); }}
      className={cn(
        'flex items-center rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[36px] cursor-text',
        'hover:border-ring transition-colors',
        className
      )}
    >
      <MathText text={value} className="text-sm" />
    </div>
  );
}

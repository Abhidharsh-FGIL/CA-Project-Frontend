import { useState, useRef, forwardRef, useImperativeHandle } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calculator } from 'lucide-react';
import { cn } from '@/lib/utils';

// Comprehensive math and science symbols for student input
const symbolGroups = [
  {
    name: 'Math Operators',
    symbols: [
      { symbol: '+', name: 'Plus' },
      { symbol: '−', name: 'Minus' },
      { symbol: '×', name: 'Multiplication' },
      { symbol: '÷', name: 'Division' },
      { symbol: '±', name: 'Plus-minus' },
      { symbol: '=', name: 'Equals' },
      { symbol: '≠', name: 'Not equal' },
      { symbol: '≈', name: 'Approximately' },
      { symbol: '<', name: 'Less than' },
      { symbol: '>', name: 'Greater than' },
      { symbol: '≤', name: 'Less or equal' },
      { symbol: '≥', name: 'Greater or equal' },
    ],
  },
  {
    name: 'Powers & Roots',
    symbols: [
      { symbol: '²', name: 'Squared' },
      { symbol: '³', name: 'Cubed' },
      { symbol: '⁴', name: 'Power 4' },
      { symbol: '⁵', name: 'Power 5' },
      { symbol: '⁶', name: 'Power 6' },
      { symbol: '⁷', name: 'Power 7' },
      { symbol: '⁸', name: 'Power 8' },
      { symbol: '⁹', name: 'Power 9' },
      { symbol: '⁰', name: 'Power 0' },
      { symbol: '√', name: 'Square root' },
      { symbol: '∛', name: 'Cube root' },
      { symbol: '∜', name: 'Fourth root' },
    ],
  },
  {
    name: 'Subscripts (Chemistry)',
    symbols: [
      { symbol: '₀', name: 'Subscript 0' },
      { symbol: '₁', name: 'Subscript 1' },
      { symbol: '₂', name: 'Subscript 2' },
      { symbol: '₃', name: 'Subscript 3' },
      { symbol: '₄', name: 'Subscript 4' },
      { symbol: '₅', name: 'Subscript 5' },
      { symbol: '₆', name: 'Subscript 6' },
      { symbol: '₇', name: 'Subscript 7' },
      { symbol: '₈', name: 'Subscript 8' },
      { symbol: '₉', name: 'Subscript 9' },
      { symbol: '₊', name: 'Subscript +' },
      { symbol: '₋', name: 'Subscript -' },
    ],
  },
  {
    name: 'Greek Letters',
    symbols: [
      { symbol: 'α', name: 'Alpha' },
      { symbol: 'β', name: 'Beta' },
      { symbol: 'γ', name: 'Gamma' },
      { symbol: 'δ', name: 'Delta' },
      { symbol: 'θ', name: 'Theta' },
      { symbol: 'λ', name: 'Lambda' },
      { symbol: 'μ', name: 'Mu' },
      { symbol: 'π', name: 'Pi' },
      { symbol: 'σ', name: 'Sigma' },
      { symbol: 'ω', name: 'Omega' },
      { symbol: 'Δ', name: 'Delta (cap)' },
      { symbol: 'Σ', name: 'Sigma (cap)' },
    ],
  },
  {
    name: 'Calculus & Advanced',
    symbols: [
      { symbol: '∫', name: 'Integral' },
      { symbol: '∂', name: 'Partial' },
      { symbol: '∑', name: 'Sum' },
      { symbol: '∏', name: 'Product' },
      { symbol: '∞', name: 'Infinity' },
      { symbol: 'ⁿ', name: 'Power n' },
      { symbol: 'ˣ', name: 'Power x' },
      { symbol: '′', name: 'Prime' },
      { symbol: '″', name: 'Double prime' },
      { symbol: '∇', name: 'Nabla' },
      { symbol: 'ℓ', name: 'Script l' },
      { symbol: 'ℏ', name: 'h-bar' },
    ],
  },
  {
    name: 'Chemistry & Physics',
    symbols: [
      { symbol: '→', name: 'Reaction arrow' },
      { symbol: '⇌', name: 'Equilibrium' },
      { symbol: '↑', name: 'Gas evolved' },
      { symbol: '↓', name: 'Precipitate' },
      { symbol: '°', name: 'Degree' },
      { symbol: '°C', name: 'Celsius' },
      { symbol: '°F', name: 'Fahrenheit' },
      { symbol: 'Å', name: 'Angstrom' },
      { symbol: 'Ω', name: 'Ohm' },
      { symbol: '⁺', name: 'Superscript +' },
      { symbol: '⁻', name: 'Superscript -' },
      { symbol: 'ℳ', name: 'Molar' },
    ],
  },
  {
    name: 'Fractions',
    symbols: [
      { symbol: '½', name: 'One half' },
      { symbol: '⅓', name: 'One third' },
      { symbol: '¼', name: 'One quarter' },
      { symbol: '⅕', name: 'One fifth' },
      { symbol: '⅔', name: 'Two thirds' },
      { symbol: '¾', name: 'Three quarters' },
      { symbol: '⅖', name: 'Two fifths' },
      { symbol: '⅗', name: 'Three fifths' },
      { symbol: '⅘', name: 'Four fifths' },
      { symbol: '⅙', name: 'One sixth' },
      { symbol: '⅚', name: 'Five sixths' },
      { symbol: '⅛', name: 'One eighth' },
    ],
  },
];

interface EquationInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  className?: string;
  minHeight?: string;
}

export interface EquationInputRef {
  focus: () => void;
}

export const EquationInput = forwardRef<EquationInputRef, EquationInputProps>(
  ({ value, onChange, placeholder, multiline = false, className, minHeight = '80px' }, ref) => {
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
    const [isOpen, setIsOpen] = useState(false);

    useImperativeHandle(ref, () => ({
      focus: () => inputRef.current?.focus(),
    }));

    const insertSymbol = (symbol: string) => {
      const input = inputRef.current;
      if (input) {
        const start = input.selectionStart || 0;
        const end = input.selectionEnd || 0;
        const newValue = value.substring(0, start) + symbol + value.substring(end);
        onChange(newValue);
        
        // Restore cursor position after symbol
        setTimeout(() => {
          input.focus();
          input.setSelectionRange(start + symbol.length, start + symbol.length);
        }, 0);
      } else {
        onChange(value + symbol);
      }
    };

    const InputComponent = multiline ? Textarea : Input;

    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Popover open={isOpen} onOpenChange={setIsOpen}>
            <PopoverTrigger asChild>
              <Button 
                type="button" 
                variant="outline" 
                size="sm" 
                className="gap-1 shrink-0"
              >
                <Calculator className="h-4 w-4" />
                <span className="hidden sm:inline">Symbols</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96 max-h-[400px] overflow-y-auto" align="start">
              <div className="space-y-4">
                <p className="text-sm font-medium">Insert Symbol</p>
                {symbolGroups.map((group) => (
                  <div key={group.name} className="space-y-2">
                    <p className="text-xs text-muted-foreground font-medium">{group.name}</p>
                    <div className="grid grid-cols-6 gap-1">
                      {group.symbols.map((item) => (
                        <Button
                          key={item.symbol}
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 p-0 text-base font-mono"
                          title={item.name}
                          onClick={() => {
                            insertSymbol(item.symbol);
                          }}
                        >
                          {item.symbol}
                        </Button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            Click to insert math symbols, chemical formulas, etc.
          </span>
        </div>
        
        <InputComponent
          ref={inputRef as any}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={cn(className)}
          style={multiline ? { minHeight } : undefined}
        />
      </div>
    );
  }
);

EquationInput.displayName = 'EquationInput';

import { Delete } from 'lucide-react';
import { cn } from '@/lib/utils';

type Props = {
  value: string;
  onChange: (next: string) => void;
  onEnter?: () => void;
  compact?: boolean;
  showDot?: boolean;
};

export function Numpad({ value, onChange, onEnter, compact, showDot = true }: Props) {
  const press = (c: string) => {
    if (c === 'C') return onChange('');
    if (c === '←') return onChange(value.slice(0, -1));
    if (c === '.') {
      if (value.includes(',')) return;
      return onChange((value || '0') + ',');
    }
    onChange((value + c).replace(/^0+(\d)/, '$1'));
  };

  const keys = ['7', '8', '9', '4', '5', '6', '1', '2', '3'];
  const size = compact ? 'h-14 text-lg' : 'h-16 text-xl';

  return (
    <div className="grid grid-cols-3 gap-2">
      {keys.map((k) => (
        <button
          key={k}
          onClick={() => press(k)}
          className={cn(size, 'rounded-xl bg-secondary hover:bg-secondary/70 active:scale-95 transition font-semibold touch-target')}
        >
          {k}
        </button>
      ))}
      <button
        onClick={() => press(showDot ? '.' : '0')}
        className={cn(size, 'rounded-xl bg-secondary hover:bg-secondary/70 active:scale-95 transition font-semibold')}
      >
        {showDot ? ',' : '0'}
      </button>
      <button
        onClick={() => press('0')}
        className={cn(size, 'rounded-xl bg-secondary hover:bg-secondary/70 active:scale-95 transition font-semibold')}
      >
        0
      </button>
      <button
        onClick={() => press('←')}
        className={cn(size, 'rounded-xl bg-destructive/20 hover:bg-destructive/30 active:scale-95 transition font-semibold flex items-center justify-center')}
      >
        <Delete className="w-5 h-5" />
      </button>
      {onEnter && (
        <button
          onClick={onEnter}
          className={cn(compact ? 'h-14' : 'h-16', 'col-span-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-lg transition active:scale-95')}
        >
          CONFIRMAR
        </button>
      )}
    </div>
  );
}

export function parseMoney(s: string): number {
  if (!s) return 0;
  return parseFloat(s.replace(/\./g, '').replace(',', '.')) || 0;
}

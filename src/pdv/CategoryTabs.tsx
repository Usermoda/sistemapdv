import { Layers } from 'lucide-react';
import { cn } from '@/lib/utils';

export type CategoryTab = { id: number | null; nome_tipo: string; produtos?: number };

export function CategoryTabs({
  categories,
  selected,
  onSelect,
}: {
  categories: CategoryTab[];
  selected: number | null;
  onSelect: (id: number | null) => void;
}) {
  const items: CategoryTab[] = [{ id: null, nome_tipo: 'Todos' }, ...categories];
  return (
    <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
      {items.map((c) => {
        const isActive = selected === c.id;
        return (
          <button
            key={c.id ?? 'all'}
            onClick={() => onSelect(c.id)}
            className={cn(
              'flex items-center gap-2 px-4 h-11 rounded-xl border-2 whitespace-nowrap transition-all font-medium text-sm touch-target',
              isActive
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-white/5 hover:border-white/20 text-muted-foreground hover:text-foreground'
            )}
          >
            {c.id === null && <Layers className="w-4 h-4" />}
            <span>{c.nome_tipo}</span>
            {typeof c.produtos === 'number' && c.produtos > 0 && (
              <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full', isActive ? 'bg-primary/20' : 'bg-white/5')}>
                {c.produtos}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

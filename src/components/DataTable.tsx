import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

export type Column<T> = {
  key: string;
  header: string;
  cell?: (row: T) => ReactNode;
  className?: string;
  width?: string;
};

type Props<T> = {
  columns: Column<T>[];
  rows: T[];
  onRowClick?: (row: T) => void;
  loading?: boolean;
  emptyMessage?: ReactNode;
  getKey?: (row: T, index: number) => string | number;
};

export function DataTable<T>({ columns, rows, onRowClick, loading, emptyMessage = 'Nenhum registro encontrado', getKey }: Props<T>) {
  return (
    <div className="rounded-xl border border-white/5 bg-card/50 overflow-hidden">
      <div className="overflow-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/5 bg-black/20">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn('text-left px-4 py-3 font-medium text-xs uppercase tracking-wider text-muted-foreground', col.className)}
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-16 text-center text-muted-foreground">
                  Carregando...
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-16 text-center text-muted-foreground">
                  {emptyMessage}
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((row, i) => (
                <motion.tr
                  key={getKey ? getKey(row, i) : i}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(i * 0.01, 0.3) }}
                  onClick={() => onRowClick?.(row)}
                  className={cn(
                    'border-b border-white/5 last:border-0 transition-colors',
                    onRowClick && 'cursor-pointer hover:bg-white/[0.03]'
                  )}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={cn('px-4 py-3', col.className)}>
                      {col.cell ? col.cell(row) : (row as Record<string, ReactNode>)[col.key]}
                    </td>
                  ))}
                </motion.tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

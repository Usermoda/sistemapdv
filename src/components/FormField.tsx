import { ReactNode } from 'react';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export function FormField({
  label,
  hint,
  children,
  className,
  required,
}: {
  label?: string;
  hint?: string;
  children: ReactNode;
  className?: string;
  required?: boolean;
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      {label && (
        <Label>
          {label} {required && <span className="text-destructive">*</span>}
        </Label>
      )}
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

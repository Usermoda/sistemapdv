import { cn } from '@/lib/utils';

/**
 * BipaLogo — combo mark (icon + wordmark).
 *
 * Concept: vertical scan bars + a "beep" ping.
 * - `variant="mark"`   → só o ícone (para favicons e chips pequenos)
 * - `variant="combo"`  → ícone + wordmark (default)
 * - `variant="word"`   → só a palavra
 *
 * `size` afeta apenas o ícone; a fonte escala com o container.
 */

export function BipaMark({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="bipa-bg" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#3b82f6" />
          <stop offset="1" stopColor="#8b5cf6" />
        </linearGradient>
      </defs>
      {/* rounded background */}
      <rect width="40" height="40" rx="10" fill="url(#bipa-bg)" />
      {/* scan bars */}
      <rect x="9"  y="13" width="3" height="14" rx="1.5" fill="white" fillOpacity="0.95" />
      <rect x="14" y="9"  width="3" height="22" rx="1.5" fill="white" />
      <rect x="19" y="15" width="3" height="10" rx="1.5" fill="white" fillOpacity="0.85" />
      <rect x="24" y="11" width="3" height="18" rx="1.5" fill="white" fillOpacity="0.9" />
      {/* beep ping */}
      <circle cx="31" cy="11" r="2.4" fill="white" />
    </svg>
  );
}

export function BipaWordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'font-black tracking-tight leading-none select-none',
        className
      )}
      aria-label="Bipa"
    >
      Bipa<span className="text-primary">.</span>
    </span>
  );
}

export function BipaLogo({
  variant = 'combo',
  size = 40,
  className,
  wordmarkClassName,
}: {
  variant?: 'mark' | 'combo' | 'word';
  size?: number;
  className?: string;
  wordmarkClassName?: string;
}) {
  if (variant === 'mark') return <BipaMark size={size} className={className} />;
  if (variant === 'word') return <BipaWordmark className={cn('text-2xl', wordmarkClassName)} />;
  return (
    <div className={cn('inline-flex items-center gap-3', className)}>
      <BipaMark size={size} />
      <BipaWordmark className={cn('text-2xl', wordmarkClassName)} />
    </div>
  );
}

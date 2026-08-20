import { useEffect, useRef, useState } from 'react';

const EVENTS: (keyof WindowEventMap)[] = [
  'mousemove',
  'mousedown',
  'keydown',
  'touchstart',
  'wheel',
];

/**
 * Fires `onIdle` after `timeoutMs` of no user interaction. Exposes a
 * countdown starting `warnBeforeMs` before the timeout so the UI can
 * warn the operator.
 *
 * Returns 0 when disabled or waiting; while counting down, returns the
 * remaining seconds until logout.
 */
export function useIdleTimeout(timeoutMs: number, onIdle: () => void, warnBeforeMs = 15_000): number {
  const [remaining, setRemaining] = useState(0);
  const lastActivityRef = useRef<number>(Date.now());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!timeoutMs || timeoutMs <= 0) {
      setRemaining(0);
      return;
    }

    const bump = () => {
      lastActivityRef.current = Date.now();
      if (remaining > 0) setRemaining(0);
    };
    for (const ev of EVENTS) window.addEventListener(ev, bump, { passive: true });

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed >= timeoutMs) {
        // fire and reset — the callback should navigate away
        lastActivityRef.current = Date.now();
        setRemaining(0);
        onIdle();
      } else if (elapsed >= timeoutMs - warnBeforeMs) {
        const remSec = Math.ceil((timeoutMs - elapsed) / 1000);
        setRemaining(remSec);
      } else if (remaining !== 0) {
        setRemaining(0);
      }
    }, 1000);

    return () => {
      for (const ev of EVENTS) window.removeEventListener(ev, bump);
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeoutMs, warnBeforeMs]);

  return remaining;
}

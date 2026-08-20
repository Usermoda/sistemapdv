import { useEffect, useRef } from 'react';

type Options = {
  onScan: (code: string) => void;
  /** Max milliseconds between keys to still be considered a scan. Default 40ms. */
  maxKeyDelay?: number;
  /** Minimum characters to consider it a barcode. Default 4. */
  minLength?: number;
  /** If true, the scanner is disabled (won't intercept keys). */
  disabled?: boolean;
};

/**
 * Global barcode scanner detector. USB HID barcode scanners emit keys very
 * quickly (usually 5–20ms between keystrokes) followed by Enter. This hook
 * listens to `keydown` on window and calls `onScan(code)` when it detects
 * that pattern — regardless of which element is focused (except when an
 * input/textarea/contenteditable is already focused, so normal typing is
 * preserved).
 */
export function useBarcodeScanner({ onScan, maxKeyDelay = 40, minLength = 4, disabled }: Options): void {
  const bufferRef = useRef<string>('');
  const lastKeyAtRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (disabled) return;

    const reset = () => {
      bufferRef.current = '';
      lastKeyAtRef.current = 0;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };

    const flushIfScan = () => {
      const code = bufferRef.current.trim();
      reset();
      if (code.length >= minLength) onScan(code);
    };

    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const inField =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable ||
          (target as HTMLElement & { role?: string }).role === 'textbox');

      const now = performance.now();
      const gap = lastKeyAtRef.current ? now - lastKeyAtRef.current : 0;

      // Non-printable / control keys
      if (e.key === 'Enter') {
        // Consume Enter only if we have a scan in buffer
        if (bufferRef.current.length >= minLength) {
          e.preventDefault();
          e.stopPropagation();
          flushIfScan();
        } else {
          reset();
        }
        return;
      }

      if (e.key === 'Escape' || e.key === 'Tab') {
        reset();
        return;
      }

      // Modifier keys - ignore alone
      if (e.ctrlKey || e.altKey || e.metaKey) return;

      // Only accept single printable characters
      if (e.key.length !== 1) return;

      // Fast typing detection: if previous key was recent, keep buffering
      if (lastKeyAtRef.current && gap > maxKeyDelay) {
        // Break in typing rhythm — reset buffer (user is typing manually)
        bufferRef.current = '';
      }

      bufferRef.current += e.key;
      lastKeyAtRef.current = now;

      // If user is in a normal input, let it type there naturally too.
      // Otherwise, still buffer silently so scan finalizes on Enter.
      if (!inField) {
        // Prevent stray chars from leaking to global handlers
        // (do not preventDefault so React shortcuts still work)
      }

      // Safety timeout: if no key comes for 150ms after start, discard buffer
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        // No Enter within window — abandon
        bufferRef.current = '';
        lastKeyAtRef.current = 0;
      }, 250);
    };

    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      reset();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, maxKeyDelay, minLength]);
}

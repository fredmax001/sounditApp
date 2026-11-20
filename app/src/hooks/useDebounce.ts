import { useState, useEffect } from 'react';

/**
 * Returns a debounced copy of `value` that only updates after `delayMs` of inactivity.
 * When `value` is cleared to an empty string, updates immediately so "Clear search" feels instant.
 */
export function useDebouncedValue<T>(value: T, delayMs = 220): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    if (typeof value === 'string' && value.trim() === '') {
      setDebounced(value);
      return;
    }
    const timer = window.setTimeout(() => {
      setDebounced(value);
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

import { useCallback } from 'react';

export type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'error';

const PATTERNS: Record<HapticType, number | number[]> = {
  light: 10,
  medium: 20,
  heavy: 30,
  success: [10, 50, 10],
  warning: [20, 60, 20],
  error: [30, 80, 30],
};

export function useHaptic() {
  const trigger = useCallback((type: HapticType = 'light') => {
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(PATTERNS[type]);
      } catch {
        // ignore
      }
    }
  }, []);

  return { trigger };
}

export default useHaptic;

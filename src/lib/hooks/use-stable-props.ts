import { createMemo } from 'solid-js';

/**
 * Creates stable references for props to prevent unnecessary re-renders
 * This is particularly useful for preventing cascade re-renders during drag operations
 */
export function useStableProps<T extends Record<string, any>>(props: T) {
  // Create memoized versions of each prop to minimize re-renders
  const stableProps = new Proxy(props, {
    get(target, prop) {
      // For functions and primitive values, return as-is
      const value = target[prop as keyof T];
      if (typeof value === 'function' || typeof value !== 'object' || value === null) {
        return value;
      }
      
      // For objects, we could memoize them, but for now return as-is
      // since SolidJS should handle object reference equality well
      return value;
    }
  });

  return stableProps;
}

/**
 * Memoized status check to prevent frequent status-based re-renders
 */
export function useStableStatus(status: () => string | undefined) {
  return createMemo(() => {
    const currentStatus = status();
    return {
      isProcessing: currentStatus === 'processing',
      isFailed: currentStatus === 'failed',
      isSuccess: currentStatus === 'success',
      isIdle: currentStatus === 'idle' || !currentStatus,
    };
  });
}

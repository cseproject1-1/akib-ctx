/**
 * Creates a throttled function that only invokes the provided function at most once
 * per every wait milliseconds.
 *
 * @param func The function to throttle.
 * @param wait The number of milliseconds to wait.
 * @returns A new throttled function.
 */
export function throttle<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): { (...args: Parameters<T>): void; cancel: () => void } {
  let lastCall = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;

  const throttled = (...args: Parameters<T>) => {
    const now = Date.now();
    lastArgs = args;

    if (now - lastCall >= wait) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      func(...args);
      lastCall = now;
    } else if (!timeoutId) {
      timeoutId = setTimeout(() => {
        if (lastArgs) {
          func(...lastArgs);
          lastCall = Date.now();
          timeoutId = null;
        }
      }, wait - (now - lastCall));
    }
  };

  throttled.cancel = () => {
    if (timeoutId) clearTimeout(timeoutId);
    timeoutId = null;
    lastCall = 0;
    lastArgs = null;
  };

  return throttled;
}

import { useState, useEffect } from 'react';
import { getAllPendingOps } from '@/lib/cache/indexedDB';

/** Returns the number of pending unsynced operations, polled every 5s */
export function usePendingOpsCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const poll = () => {
      getAllPendingOps().then(ops => setCount(ops.length)).catch((err) => console.error('Failed to fetch pending ops:', err));
    };
    poll();
    const id = setInterval(poll, 5000);
    // Also listen for custom event dispatched after queueing
    const handler = () => setTimeout(poll, 100);
    window.addEventListener('pending-ops-changed', handler);
    return () => {
      clearInterval(id);
      window.removeEventListener('pending-ops-changed', handler);
    };
  }, []);

  return count;
}

import { useEffect, useRef } from 'react';
import { startSyncManager, stopSyncManager } from '@/lib/cache/canvasCache';

/**
 * Global hook to initialize and manage the background synchronization manager.
 * Should be called once at the top level of the app.
 */
export function useSyncManager() {
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    startSyncManager();
    
    return () => {
      stopSyncManager();
      started.current = false;
    };
  }, []);
}

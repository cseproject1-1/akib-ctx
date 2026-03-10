import { useEffect } from 'react';
import { startSyncManager, stopSyncManager } from '@/lib/cache/canvasCache';

/**
 * Global hook to initialize and manage the background synchronization manager.
 * Should be called once at the top level of the app.
 */
export function useSyncManager() {
  useEffect(() => {
    // Start the sync manager on mount
    startSyncManager();
    
    // Stop the sync manager on unmount
    return () => {
      stopSyncManager();
    };
  }, []);
}

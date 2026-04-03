import { useEffect, useRef } from 'react';
import { startSyncManager, stopSyncManager } from '@/lib/cache/canvasCache';
import { auth } from '@/lib/firebase/client';
import { onAuthStateChanged } from 'firebase/auth';

/**
 * Global hook to initialize and manage the background synchronization manager.
 * Waits for Firebase auth to resolve before starting the first replay so that
 * `replayPendingOps` never hits the "No session" early-return on startup.
 * Should be called once at the top level of the app.
 */
export function useSyncManager() {
  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;

    // Wait for the first auth state event — only THEN start the sync manager.
    // This prevents the "No session — skipping replay" spam that occurs when
    // startSyncManager's 3 s timer fires before Firebase auth initializes.
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe(); // one-shot: we only need the first event
      if (user) {
        startSyncManager();
      }
      // If no user (logged out), don't start sync — nothing to replay
    });

    return () => {
      stopSyncManager();
      started.current = false;
    };
  }, []);
}

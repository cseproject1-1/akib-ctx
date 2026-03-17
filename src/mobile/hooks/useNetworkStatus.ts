import { useState, useEffect, useCallback } from 'react';

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  const updateOnlineStatus = useCallback(() => {
    setIsOnline(navigator.onLine);
  }, []);

  useEffect(() => {
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);

    return () => {
      window.removeEventListener('online', updateOnlineStatus);
      window.removeEventListener('offline', updateOnlineStatus);
    };
  }, [updateOnlineStatus]);

  return { isOnline };
}

// For mobile - show offline indicator
export function useMobileNetworkStatus() {
  const { isOnline } = useNetworkStatus();
  const [showOfflineBanner, setShowOfflineBanner] = useState(false);

  useEffect(() => {
    if (!isOnline) {
      setShowOfflineBanner(true);
    } else {
      // Hide after 3 seconds when coming back online
      const timer = setTimeout(() => setShowOfflineBanner(false), 3000);
      return () => clearTimeout(timer);
    }
  }, [isOnline]);

  return { isOnline, showOfflineBanner };
}

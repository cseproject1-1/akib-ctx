import { useCallback, useRef } from 'react';
import { toast } from 'sonner';

interface ToastQueue {
  [key: string]: {
    message: string;
    timestamp: number;
  };
}

export function useToastManager() {
  const toastQueueRef = useRef<ToastQueue>({});
  const TOAST_COOLDOWN = 2000; // 2 seconds between same toasts
  const MAX_TOAST_AGE = 10000; // 10 seconds max age for queued toasts

  // Clean old entries
  const cleanOldToasts = useCallback(() => {
    const now = Date.now();
    Object.keys(toastQueueRef.current).forEach(key => {
      if (now - toastQueueRef.current[key].timestamp > MAX_TOAST_AGE) {
        delete toastQueueRef.current[key];
      }
    });
  }, []);

  const shouldShowToast = useCallback((key: string): boolean => {
    cleanOldToasts();
    const now = Date.now();
    const lastToast = toastQueueRef.current[key];
    
    if (!lastToast) {
      toastQueueRef.current[key] = { message: '', timestamp: now };
      return true;
    }
    
    const timeSinceLastToast = now - lastToast.timestamp;
    if (timeSinceLastToast > TOAST_COOLDOWN) {
      toastQueueRef.current[key].timestamp = now;
      return true;
    }
    
    return false;
  }, [cleanOldToasts]);

  const mobileToast = {
    info: (message: string, key?: string) => {
      const toastKey = key || message.substring(0, 50);
      if (shouldShowToast(toastKey)) {
        toast.info(message);
      }
    },
    
    success: (message: string, key?: string) => {
      const toastKey = key || message.substring(0, 50);
      if (shouldShowToast(toastKey)) {
        toast.success(message);
      }
    },
    
    error: (message: string, key?: string) => {
      const toastKey = key || message.substring(0, 50);
      if (shouldShowToast(toastKey)) {
        toast.error(message);
      }
    },
    
    // Immediate toast (bypass cooldown) for critical messages
    immediate: {
      info: toast.info,
      success: toast.success,
      error: toast.error,
    },
    
    // Silent mode - no toasts
    silent: {
      info: () => {},
      success: () => {},
      error: () => {},
    },
  };

  return mobileToast;
}

// Basic toast without cooldown for critical messages
export function useBasicToast() {
  const info = useCallback((message: string) => {
    toast.info(message);
  }, []);

  const success = useCallback((message: string) => {
    toast.success(message);
  }, []);

  const error = useCallback((message: string) => {
    toast.error(message);
  }, []);

  return { info, success, error };
}

export default useToastManager;

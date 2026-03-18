import { useState, useEffect, useCallback } from 'react';

interface PlatformFeatures {
  isIOS: boolean;
  isAndroid: boolean;
  isStandalone: boolean;
  hasVibration: boolean;
  hasShareAPI: boolean;
  hasClipboardAPI: boolean;
  hasPWAInstallPrompt: boolean;
  safeAreaTop: number;
  safeAreaBottom: number;
  hasApplePencil: boolean;
  hasStylus: boolean;
}

export function usePlatformFeatures(): PlatformFeatures {
  const [features, setFeatures] = useState<PlatformFeatures>({
    isIOS: false,
    isAndroid: false,
    isStandalone: false,
    hasVibration: false,
    hasShareAPI: false,
    hasClipboardAPI: false,
    hasPWAInstallPrompt: false,
    safeAreaTop: 0,
    safeAreaBottom: 0,
    hasApplePencil: false,
    hasStylus: false,
  });

  useEffect(() => {
    // Detect platform
    const userAgent = navigator.userAgent || navigator.vendor;
    const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;
    const isAndroid = /Android/.test(userAgent);

    // Check standalone mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;

    // Check capabilities
    const hasVibration = 'vibrate' in navigator;
    const hasShareAPI = 'share' in navigator;
    const hasClipboardAPI = 'clipboard' in navigator;

    // Safe area detection (for iOS devices with notch)
    const safeAreaTop = parseInt(
      getComputedStyle(document.documentElement).getPropertyValue('--sat') || '0',
      10
    );
    const safeAreaBottom = parseInt(
      getComputedStyle(document.documentElement).getPropertyValue('--sab') || '0',
      10
    );

    // Check for Apple Pencil (iOS 13.4+)
    const hasApplePencil = isIOS && 'ontouchstart' in window;

    // Check for stylus support
    const hasStylus = isAndroid || isIOS;

    setFeatures({
      isIOS,
      isAndroid,
      isStandalone,
      hasVibration,
      hasShareAPI,
      hasClipboardAPI,
      hasPWAInstallPrompt: !isStandalone,
      safeAreaTop,
      safeAreaBottom,
      hasApplePencil,
      hasStylus,
    });
  }, []);

  return features;
}

// Platform-specific hooks
export function useShare() {
  const share = useCallback(async (data: ShareData) => {
    if (navigator.share) {
      try {
        await navigator.share(data);
        return true;
      } catch (err) {
        console.log('Share cancelled or failed');
        return false;
      }
    }
    return false;
  }, []);

  return { share };
}

export function useClipboard() {
  const copy = useCallback(async (text: string): Promise<boolean> => {
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch (err) {
        console.log('Clipboard copy failed');
        return false;
      }
    }
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      document.body.removeChild(textArea);
      return true;
    } catch (err) {
      document.body.removeChild(textArea);
      return false;
    }
  }, []);

  const paste = useCallback(async (): Promise<string> => {
    if (navigator.clipboard) {
      try {
        return await navigator.clipboard.readText();
      } catch (err) {
        console.log('Clipboard paste failed');
        return '';
      }
    }
    return '';
  }, []);

  return { copy, paste };
}

export function useHapticFeedback() {
  const vibrate = useCallback((pattern: number | number[]) => {
    if ('vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  }, []);

  const light = useCallback(() => vibrate(10), [vibrate]);
  const medium = useCallback(() => vibrate(20), [vibrate]);
  const heavy = useCallback(() => vibrate(30), [vibrate]);
  const selection = useCallback(() => vibrate(5), [vibrate]);

  return { vibrate, light, medium, heavy, selection };
}

export function useDeviceOrientation() {
  const [orientation, setOrientation] = useState<{
    alpha: number | null;
    beta: number | null;
    gamma: number | null;
  }>({ alpha: null, beta: null, gamma: null });

  useEffect(() => {
    const handleOrientation = (event: DeviceOrientationEvent) => {
      setOrientation({
        alpha: event.alpha,
        beta: event.beta,
        gamma: event.gamma,
      });
    };

    window.addEventListener('deviceorientation', handleOrientation);
    return () => window.removeEventListener('deviceorientation', handleOrientation);
  }, []);

  return orientation;
}

export default usePlatformFeatures;

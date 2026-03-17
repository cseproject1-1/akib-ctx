import { useEffect, useState, useCallback } from 'react';

const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;

export type DeviceType = 'mobile' | 'tablet' | 'desktop';

export interface DeviceInfo {
  type: DeviceType;
  isMobile: boolean;
  isTablet: boolean;
  isDesktop: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isTouchDevice: boolean;
  width: number;
  height: number;
  prefersReducedMotion: boolean;
}

export function useDeviceDetect(): DeviceInfo {
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>({
    type: 'desktop',
    isMobile: false,
    isTablet: false,
    isDesktop: true,
    isIOS: false,
    isAndroid: false,
    isTouchDevice: false,
    width: 0,
    height: 0,
    prefersReducedMotion: false,
  });

  const detectDevice = useCallback((): DeviceInfo => {
    const width = typeof window !== 'undefined' ? window.innerWidth : 0;
    const height = typeof window !== 'undefined' ? window.innerHeight : 0;
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';

    // Detect platform
    const isIOS = /iPad|iPhone|iPod/.test(userAgent) || 
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isAndroid = /Android/.test(userAgent);
    const isMobileDevice = /Mobi|Android|iPhone|iPad|iPod/i.test(userAgent);
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

    // Determine device type based on width and user agent
    let type: DeviceType = 'desktop';
    if (width < MOBILE_BREAKPOINT || isMobileDevice) {
      type = 'mobile';
    } else if (width < TABLET_BREAKPOINT) {
      type = 'tablet';
    }

    return {
      type,
      isMobile: type === 'mobile',
      isTablet: type === 'tablet',
      isDesktop: type === 'desktop',
      isIOS,
      isAndroid,
      isTouchDevice,
      width,
      height,
      prefersReducedMotion: window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    };
  }, []);

  useEffect(() => {
    const updateDeviceInfo = () => {
      setDeviceInfo(detectDevice());
    };

    // Initial detection
    updateDeviceInfo();

    // Listen for resize events
    window.addEventListener('resize', updateDeviceInfo);
    window.addEventListener('orientationchange', updateDeviceInfo);

    return () => {
      window.removeEventListener('resize', updateDeviceInfo);
      window.removeEventListener('orientationchange', updateDeviceInfo);
    };
  }, [detectDevice]);

  return deviceInfo;
}

// Utility function to check if user opted into desktop mode on mobile
export function shouldUseDesktopMode(): boolean {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem('useDesktopMode') === 'true';
}

// Utility function to set desktop mode preference
export function setDesktopModePreference(enabled: boolean): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem('useDesktopMode', String(enabled));
}

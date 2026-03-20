import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useDeviceDetect, shouldUseDesktopMode } from '@/mobile/hooks/useDeviceDetect';

interface MobileRouteGuardProps {
  children: React.ReactNode;
}

/**
 * MobileRouteGuard: Automatically detects mobile devices and redirects to mobile mode
 * Desktop users can opt into mobile mode by visiting /mobile-mode directly
 */
export function MobileRouteGuard({ children }: MobileRouteGuardProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const device = useDeviceDetect();

  useEffect(() => {
    // Skip redirect if already in mobile mode
    if (location.pathname.startsWith('/mobile-mode')) {
      return;
    }

    // Skip redirect if user has explicitly opted into desktop mode on mobile
    if (shouldUseDesktopMode()) {
      return;
    }

    // Skip redirect for auth pages (login/signup) to avoid ProtectedRoute redirect loop
    if (location.pathname.startsWith('/login') || location.pathname.startsWith('/signup')) {
      return;
    }

    // Auto-redirect to mobile mode on mobile/tablet devices
    // Check both screen width and user agent detection
    const shouldRedirect = device.isMobile || device.isTablet;
    
    if (shouldRedirect && !location.pathname.startsWith('/mobile-mode')) {
      // Construct mobile path matching current route
      let mobilePath = '/mobile-mode';
      
      if (location.pathname.startsWith('/workspace/')) {
        const workspaceId = location.pathname.split('/')[2];
        mobilePath = `/mobile-mode/workspace/${workspaceId}`;
      } else if (location.pathname.startsWith('/view/')) {
        const workspaceId = location.pathname.split('/')[2];
        mobilePath = `/mobile-mode/view/${workspaceId}`;
      } else if (location.pathname === '/admin') {
        mobilePath = '/mobile-mode/settings';
      } else if (location.pathname === '/import') {
        mobilePath = '/mobile-mode/settings';
      } else if (location.pathname !== '/') {
        // For other routes, go to mobile dashboard
        mobilePath = '/mobile-mode';
      }
      
      // Preserve query params and hash
      const search = location.search;
      const hash = location.hash;
      navigate(mobilePath + search + hash, { replace: true });
    }
  }, [location, device, navigate]);

  return <>{children}</>;
}

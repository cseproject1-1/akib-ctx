// Mobile UI/UX System - Complete Implementation
// This provides a completely separate mobile experience from the desktop UI

// Hooks
export { useDeviceDetect, shouldUseDesktopMode, setDesktopModePreference } from './hooks/useDeviceDetect';
export { useMobileSync } from './hooks/useMobileSync';

// Layout Components
export { MobileLayout } from './layout/MobileLayout';
export { MobileHeader } from './layout/MobileHeader';
export { MobileBottomNav } from './layout/MobileBottomNav';
export { 
  MobileDrawer, 
  MobileThemeProvider, 
  useMobileTheme 
} from './layout/MobileDrawer';

// Pages
export { MobileDashboard } from './pages/MobileDashboard';
export { MobileCanvas } from './pages/MobileCanvas';
export { MobileSettings } from './pages/MobileSettings';
export { MobileSearch } from './pages/MobileSearch';

// Components
export { MobileNodeContextMenu } from './components/MobileNodeContextMenu';
export { MobileRouteGuard } from './components/MobileRouteGuard';
export { MobileVersionHistory } from './components/MobileVersionHistory';
export { MobileBookmarks } from './components/MobileBookmarks';
export { MobilePinnedNodes } from './components/MobilePinnedNodes';
export { MobileCommandPalette } from './components/MobileCommandPalette';
export { MobileErrorBoundary, withMobileErrorBoundary } from './components/MobileErrorBoundary';
export { 
  MobileDashboardSkeleton, 
  MobileCanvasSkeleton, 
  WorkspaceCardSkeleton 
} from './components/MobileLoadingSkeleton';
export { MobileInstallBanner } from './components/MobileInstallBanner';

// Types
export type { DeviceInfo, DeviceType } from './hooks/useDeviceDetect';

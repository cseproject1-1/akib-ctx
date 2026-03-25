import React, { useState, useCallback, useEffect } from 'react';
import { useLocation, useNavigate, Outlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useDeviceDetect } from '@/mobile/hooks/useDeviceDetect';
import { useMobileNetworkStatus } from '@/mobile/hooks/useNetworkStatus';
import { MobileBottomNav } from './MobileBottomNav';
import { MobileHeader } from './MobileHeader';
import { MobileDrawer } from './MobileDrawer';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { useCanvasStore } from '@/store/canvasStore';
import { WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MobileErrorBoundary } from '@/mobile/components/MobileErrorBoundary';

interface MobileLayoutProps {
  showHeader?: boolean;
  showBottomNav?: boolean;
  title?: string;
  onBack?: () => void;
  children?: React.ReactNode;
}

export function MobileLayout({ 
  showHeader = true, 
  showBottomNav = true, 
  title,
  onBack,
  children 
}: MobileLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const device = useDeviceDetect();
  const { isOnline } = useMobileNetworkStatus();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const workspaceName = useCanvasStore((s) => s.workspaceName);

  const currentTitle = title || workspaceName || 'CtxNote';
  const showNav = showBottomNav && !location.pathname.includes('/workspace/');

  const handleBack = useCallback(() => {
    if (onBack) {
      onBack();
    } else if (location.pathname.split('/').length > 3) {
      navigate(-1);
    } else {
      navigate('/mobile-mode');
    }
  }, [location.pathname, navigate, onBack]);

  // Prevent pull-to-refresh on mobile - scroll behavior is handled naturally
  useEffect(() => {
    // Prevent iOS rubber band effect on scroll containers
    document.body.style.overscrollBehavior = 'none';
    
    return () => {
      document.body.style.overscrollBehavior = '';
    };
  }, []);

    // Update meta tags for mobile
    useEffect(() => {
      // Use modern meta tags
      const viewportMeta = document.querySelector('meta[name="viewport"]');
      if (viewportMeta) {
        viewportMeta.setAttribute('content', 'width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes, viewport-fit=cover');
      }
      
      // Ensure we have the mobile web app meta tag
      let mobileMeta = document.querySelector('meta[name="mobile-web-app-capable"]');
      if (!mobileMeta) {
        mobileMeta = document.createElement('meta');
        mobileMeta.setAttribute('name', 'mobile-web-app-capable');
        mobileMeta.setAttribute('content', 'yes');
        document.head.appendChild(mobileMeta);
      }
    }, []);

  return (
    <div 
      className="h-screen w-screen bg-background flex flex-col overflow-x-hidden safe-area-pb" 
      data-mobile-layout
    >
      {/* Offline Banner */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            initial={{ y: -40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -40, opacity: 0 }}
            className={cn(
              "flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium",
              "bg-muted border-b border-border/50"
            )}
          >
            <WifiOff className="h-4 w-4" />
            <span>Offline - changes will sync when reconnected</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Header */}
      <AnimatePresence>
        {showHeader && (
          <motion.div
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            className="flex-shrink-0"
          >
            <MobileHeader
              title={currentTitle}
              onBack={handleBack}
              onMenuClick={() => setIsDrawerOpen(true)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area with Error Boundary */}
      <MobileErrorBoundary>
        <div className="flex-1 min-h-0 overflow-hidden relative">
          <Outlet />
          {children}
        </div>
      </MobileErrorBoundary>

      {/* Bottom Navigation */}
      <AnimatePresence>
        {showNav && (
          <motion.div
            initial={{ y: 60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 60, opacity: 0 }}
            className="flex-shrink-0"
          >
            <MobileBottomNav />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile Drawer (Slide-out Menu) */}
      <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <SheetContent side="left" className="w-[85vw] max-w-[320px] p-0">
          <MobileDrawer onClose={() => setIsDrawerOpen(false)} />
        </SheetContent>
      </Sheet>
    </div>
  );
}

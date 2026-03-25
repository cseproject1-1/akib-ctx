import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, LayoutGrid, Search, Settings } from 'lucide-react';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { path: '/mobile-mode', label: 'Home', icon: Home },
  { path: '/mobile-mode/search', label: 'Search', icon: Search },
  { path: '/mobile-mode/settings', label: 'Settings', icon: Settings },
];

export function MobileBottomNav() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Determine active route - check if current path matches nav item
  const getCurrentPath = () => {
    const path = location.pathname;
    if (path === '/mobile-mode') return '/mobile-mode';
    if (path.startsWith('/mobile-mode/workspace/') && !path.includes('/settings')) return '/mobile-mode/workspace';
    if (path.startsWith('/mobile-mode/search')) return '/mobile-mode/search';
    if (path.startsWith('/mobile-mode/settings')) return '/mobile-mode/settings';
    return '/mobile-mode';
  };

  const currentPath = getCurrentPath();

  return (
    <nav 
      className="sticky bottom-0 z-40 w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-t border-border/50 safe-area-bottom"
      data-mobile-bottom-nav
    >
      <div className="flex items-center justify-around h-16 px-2">
        {NAV_ITEMS.map((item) => {
          const isActive = currentPath === item.path || 
            (item.path === '/mobile-mode/workspace' && location.pathname.startsWith('/mobile-mode/workspace'));
          const Icon = item.icon;
          
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                "flex flex-col items-center justify-center flex-1 h-full min-w-[64px] px-2 rounded-lg transition-colors",
                isActive 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-label={item.label}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon className={cn(
                "h-6 w-6 mb-0.5 transition-transform",
                isActive && "scale-110"
              )} />
              <span className={cn(
                "text-[10px] font-medium tracking-wide",
                isActive ? "text-primary" : "text-muted-foreground"
              )}>
                {item.label}
              </span>
            </button>
          );
        })}
        
        {/* Workspace tab (dynamically shown when in workspace) */}
        {location.pathname.startsWith('/mobile-mode/workspace') && (
          <button
            onClick={() => navigate('/mobile-mode')}
            className="flex flex-col items-center justify-center flex-1 h-full min-w-[64px] px-2 rounded-lg text-primary transition-colors"
            aria-label="Current Workspace"
            aria-current="page"
          >
            <LayoutGrid className="h-6 w-6 mb-0.5" />
            <span className="text-[10px] font-medium tracking-wide text-primary">
              Canvas
            </span>
          </button>
        )}
      </div>
    </nav>
  );
}

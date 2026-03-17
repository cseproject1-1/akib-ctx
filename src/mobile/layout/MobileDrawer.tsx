import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Home, 
  LayoutGrid, 
  Settings, 
  LogOut, 
  Moon, 
  Sun, 
  Smartphone, 
  Laptop,
  User,
  HelpCircle
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useCanvasStore } from '@/store/canvasStore';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// Theme context that extends the desktop ThemeProvider
// Uses the same localStorage key: 'crxnote-theme'
type ThemeType = 'dark' | 'light';

interface MobileThemeContextType {
  theme: ThemeType;
  setTheme: (theme: ThemeType) => void;
  toggle: () => void;
}

const MobileThemeContext = React.createContext<MobileThemeContextType>({
  theme: 'dark',
  setTheme: () => {},
  toggle: () => {},
});

export function MobileThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = React.useState<ThemeType>(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('crxnote-theme') as ThemeType) || 'dark';
    }
    return 'dark';
  });

  React.useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('crxnote-theme', theme);
  }, [theme]);

  const setTheme = (newTheme: ThemeType) => {
    setThemeState(newTheme);
  };

  const toggle = () => {
    setThemeState((t) => (t === 'dark' ? 'light' : 'dark'));
  };

  return (
    <MobileThemeContext.Provider value={{ theme, setTheme, toggle }}>
      {children}
    </MobileThemeContext.Provider>
  );
}

export function useMobileTheme() {
  return React.useContext(MobileThemeContext);
}

interface MobileDrawerProps {
  onClose: () => void;
}

export function MobileDrawer({ onClose }: MobileDrawerProps) {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useMobileTheme();
  const workspaces = useCanvasStore((s) => s.openWorkspaces);

  const handleSwitchToDesktop = () => {
    localStorage.setItem('useDesktopMode', 'true');
    window.location.href = '/';
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Signed out successfully');
      navigate('/login');
      onClose();
    } catch (error) {
      toast.error('Failed to sign out');
    }
  };

  return (
    <div className="h-full flex flex-col bg-background" data-mobile-drawer>
      {/* Header */}
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground truncate">
              {user?.displayName || user?.email || 'User'}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {user?.email}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-2">
        <div className="space-y-1">
          <button
            onClick={() => { navigate('/mobile-mode'); onClose(); }}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-accent/50 text-left transition-colors"
          >
            <Home className="h-5 w-5 text-muted-foreground" />
            <span>Home</span>
          </button>
          
          <button
            onClick={() => { navigate('/mobile-mode/settings'); onClose(); }}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-accent/50 text-left transition-colors"
          >
            <Settings className="h-5 w-5 text-muted-foreground" />
            <span>Settings</span>
          </button>
          
          <button
            onClick={() => { navigate('/mobile-mode/search'); onClose(); }}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-accent/50 text-left transition-colors"
          >
            <LayoutGrid className="h-5 w-5 text-muted-foreground" />
            <span>Search All</span>
          </button>
        </div>

        <Separator className="my-3" />

        {/* Theme Toggle */}
        <div className="px-3 py-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Appearance
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setTheme('light')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border transition-colors",
                theme === 'light' ? "border-primary bg-primary/10" : "border-border hover:bg-accent/50"
              )}
            >
              <Sun className="h-4 w-4" />
              <span className="text-sm">Light</span>
            </button>
            <button
              onClick={() => setTheme('dark')}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 p-3 rounded-lg border transition-colors",
                theme === 'dark' ? "border-primary bg-primary/10" : "border-border hover:bg-accent/50"
              )}
            >
              <Moon className="h-4 w-4" />
              <span className="text-sm">Dark</span>
            </button>
          </div>
        </div>

        <Separator className="my-3" />

        {/* Desktop Mode Option (only visible on mobile) */}
        <div className="px-3 py-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
            View Mode
          </p>
          <button
            onClick={handleSwitchToDesktop}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-accent/50 text-left transition-colors"
          >
            <Laptop className="h-5 w-5 text-muted-foreground" />
            <span>Switch to Desktop</span>
          </button>
        </div>

        <Separator className="my-3" />

        {/* Help */}
        <div className="px-3 py-2">
          <button
            onClick={() => { /* TODO: Show help dialog */ onClose(); }}
            className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-accent/50 text-left transition-colors"
          >
            <HelpCircle className="h-5 w-5 text-muted-foreground" />
            <span>Help & Feedback</span>
          </button>
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-border/50">
        <Button
          variant="destructive"
          className="w-full"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </div>
    </div>
  );
}

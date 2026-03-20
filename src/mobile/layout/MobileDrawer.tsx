import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Home, 
  LayoutGrid, 
  Settings, 
  User,
  HelpCircle
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Separator } from '@/components/ui/separator';

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
  const { user } = useAuth();

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
    </div>
  );
}

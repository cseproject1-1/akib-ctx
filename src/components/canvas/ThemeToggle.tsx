/* eslint-disable react-refresh/only-export-components */
import { useEffect, useState, createContext, useContext } from 'react';
import { Sun, Moon } from 'lucide-react';

type Theme = 'dark' | 'light';

const ThemeContext = createContext<{ theme: Theme; toggle: () => void }>({
  theme: 'dark',
  toggle: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      try { return (localStorage.getItem('crxnote-theme') as Theme) || 'dark'; } catch { return 'dark'; }
    }
    return 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    try { localStorage.setItem('crxnote-theme', theme); } catch { /* quota */ }
  }, [theme]);

  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const [rotating, setRotating] = useState(false);

  const handleToggle = () => {
    setRotating(true);
    toggle();
    setTimeout(() => setRotating(false), 500);
  };

  return (
    <button
      onClick={handleToggle}
      className="p-2.5 text-muted-foreground rounded-lg transition-all duration-200 hover:bg-accent hover:text-primary hover:shadow-[var(--premium-shadow-sm)]"
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
    >
      <div
        className="transition-transform duration-500 ease-out"
        style={{ transform: rotating ? 'rotate(360deg)' : 'rotate(0deg)' }}
      >
        {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </div>
    </button>
  );
}

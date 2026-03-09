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
      return (localStorage.getItem('crxnote-theme') as Theme) || 'dark';
    }
    return 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('crxnote-theme', theme);
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
      className="p-2.5 text-muted-foreground transition-colors hover:bg-accent hover:text-primary"
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

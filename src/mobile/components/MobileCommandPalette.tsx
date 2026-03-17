import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  X, 
  Plus, 
  Settings, 
  Home, 
  Moon, 
  Sun, 
  Smartphone,
  Trash2,
  Copy,
  ExternalLink
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

interface Command {
  id: string;
  label: string;
  icon: React.ReactNode;
  action: () => void;
  keywords: string[];
  category: string;
}

interface MobileCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MobileCommandPalette({ isOpen, onClose }: MobileCommandPaletteProps) {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const commands = useMemo(() => ([
    {
      id: 'new-workspace',
      label: 'New Workspace',
      icon: <Plus className="h-4 w-4" />,
      action: () => {
        navigate('/mobile-mode');
        // Trigger create modal
      },
      keywords: ['new', 'create', 'workspace'],
      category: 'Actions'
    },
    {
      id: 'search',
      label: 'Search',
      icon: <Search className="h-4 w-4" />,
      action: () => navigate('/mobile-mode/search'),
      keywords: ['search', 'find', 'lookup'],
      category: 'Navigation'
    },
    {
      id: 'home',
      label: 'Go Home',
      icon: <Home className="h-4 w-4" />,
      action: () => navigate('/mobile-mode'),
      keywords: ['home', 'dashboard', 'main'],
      category: 'Navigation'
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <Settings className="h-4 w-4" />,
      action: () => navigate('/mobile-mode/settings'),
      keywords: ['settings', 'preferences', 'config'],
      category: 'Navigation'
    },
    {
      id: 'theme',
      label: 'Toggle Theme',
      icon: <Moon className="h-4 w-4" />,
      action: () => {
        const current = document.documentElement.classList.contains('dark');
        document.documentElement.classList.toggle('dark', !current);
        document.documentElement.classList.toggle('light', current);
      },
      keywords: ['theme', 'dark', 'light', 'mode'],
      category: 'Appearance'
    },
  ]), [navigate]);

  const filteredCommands = useMemo(() => {
    if (!searchQuery.trim()) return commands;
    
    const query = searchQuery.toLowerCase();
    return commands.filter(cmd => 
      cmd.label.toLowerCase().includes(query) ||
      cmd.keywords.some(k => k.includes(query))
    );
  }, [commands, searchQuery]);

  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredCommands]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!isOpen) return;
    
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, filteredCommands.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && filteredCommands[selectedIndex]) {
      e.preventDefault();
      filteredCommands[selectedIndex].action();
      onClose();
    }
  }, [isOpen, filteredCommands, selectedIndex, onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-24"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: -20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: -20 }}
          className="w-[90vw] max-w-lg bg-background rounded-2xl shadow-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50">
            <Search className="h-5 w-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Type a command or search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent outline-none text-sm"
              autoFocus
            />
            <kbd className="hidden sm:inline-block px-2 py-0.5 text-xs bg-muted rounded">
              ESC
            </kbd>
            <button
              onClick={onClose}
              className="p-1 hover:bg-muted rounded-full"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Command List */}
          <div className="max-h-80 overflow-y-auto py-2">
            {filteredCommands.length === 0 ? (
              <div className="px-4 py-8 text-center text-muted-foreground">
                No commands found
              </div>
            ) : (
              <div className="space-y-0.5">
                {filteredCommands.map((cmd, index) => (
                  <button
                    key={cmd.id}
                    onClick={() => {
                      cmd.action();
                      onClose();
                    }}
                    className={cn(
                      "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors",
                      index === selectedIndex 
                        ? "bg-primary/10 text-primary" 
                        : "hover:bg-muted"
                    )}
                  >
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                      index === selectedIndex 
                        ? "bg-primary text-primary-foreground" 
                        : "bg-muted"
                    )}>
                      {cmd.icon}
                    </div>
                    <span className="flex-1">{cmd.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {cmd.category}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

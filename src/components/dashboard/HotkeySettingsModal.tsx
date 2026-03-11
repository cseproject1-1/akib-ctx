import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { useSettingsStore } from '@/store/settingsStore';
import { Keyboard, X, RotateCcw, Save } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

const HOTKEY_LABELS: Record<string, string> = {
  undo: 'Undo Action',
  redo: 'Redo Action',
  copy: 'Copy Selected Nodes',
  paste: 'Paste Nodes / Clipboard',
  selectAll: 'Select All Nodes',
  fitView: 'Fit View to Screen',
  resetZoom: 'Reset Zoom (100%)',
  toggleMinimap: 'Toggle Minimap',
  search: 'Search Nodes (Palette)',
  toggleSidebar: 'Toggle Dashboard Sidebar',
  newNote: 'Quick New Note',
};

export function HotkeySettingsModal({ open, onOpenChange }: { open: boolean, onOpenChange: (open: boolean) => void }) {
  const { hotkeys, updateHotkey, isLoading } = useSettingsStore();
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [recording, setRecording] = useState<string[]>([]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!editingKey) return;
    e.preventDefault();
    e.stopPropagation();

    const keys = new Set<string>();
    if (e.ctrlKey || e.metaKey) keys.add('mod');
    if (e.shiftKey) keys.add('shift');
    if (e.altKey) keys.add('alt');

    const key = e.key.toLowerCase();
    if (!['control', 'meta', 'shift', 'alt'].includes(key)) {
      keys.add(key === ' ' ? 'space' : key);
    }

    setRecording(Array.from(keys));
  }, [editingKey]);

  useEffect(() => {
    if (editingKey) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [editingKey, handleKeyDown]);

  const saveHotkey = async () => {
    if (!editingKey || recording.length === 0) return;
    const hotkeyStr = recording.join('+');
    await updateHotkey(editingKey, hotkeyStr);
    toast.success(`Hotkey for ${HOTKEY_LABELS[editingKey]} updated`);
    setEditingKey(null);
    setRecording([]);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border-4 border-foreground shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl font-black uppercase italic">
            <Keyboard className="h-6 w-6" />
            Custom Keyboard Shortcuts
          </DialogTitle>
          <DialogDescription className="font-bold text-foreground/70">
            Click any shortcut to remap it. Changes are synced across your devices.
          </DialogDescription>
        </DialogHeader>

        <div className="grid max-h-[60vh] gap-4 overflow-y-auto pr-2">
          {Object.entries(HOTKEY_LABELS).map(([key, label]) => {
            const isEditing = editingKey === key;
            const currentHotkey = hotkeys[key] || 'Not set';

            return (
              <div
                key={key}
                className={cn(
                  "group flex items-center justify-between rounded-lg border-2 border-foreground bg-card p-3 transition-all",
                  isEditing ? "scale-[1.02] bg-primary/10 ring-4 ring-primary" : "hover:border-primary"
                )}
              >
                <div className="flex flex-col">
                  <span className="text-sm font-black uppercase tracking-tight">{label}</span>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase">{key}</span>
                </div>

                <div className="flex items-center gap-2">
                  {isEditing ? (
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        {recording.length > 0 ? (
                          recording.map((k, i) => (
                            <kbd key={i} className="rounded-md border-2 border-foreground bg-card px-2 py-1 text-xs font-black uppercase shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
                              {k}
                            </kbd>
                          ))
                        ) : (
                          <span className="animate-pulse text-xs font-bold text-primary italic">Press keys...</span>
                        )}
                      </div>
                      <button
                        onClick={saveHotkey}
                        disabled={recording.length === 0}
                        className="rounded bg-primary p-1 text-primary-foreground shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none"
                      >
                        <Save className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => { setEditingKey(null); setRecording([]); }}
                        className="rounded bg-destructive p-1 text-destructive-foreground shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setEditingKey(key)}
                      className="flex items-center gap-1 rounded-md border-2 border-foreground bg-secondary px-3 py-1.5 text-xs font-black uppercase shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none"
                    >
                      {currentHotkey.split('+').map((k, i) => (
                        <span key={i} className="flex items-center">
                          {k}
                          {i < currentHotkey.split('+').length - 1 && <span className="mx-0.5 opacity-50">+</span>}
                        </span>
                      ))}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter className="flex items-center justify-between border-t-2 border-foreground pt-4">
          <button
            onClick={() => useSettingsStore.getState().fetchSettings()}
            className="flex items-center gap-2 rounded-lg bg-secondary px-4 py-2 text-xs font-black uppercase tracking-widest shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none"
          >
            <RotateCcw className="h-4 w-4" />
            Reset to Defaults
          </button>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded-lg bg-foreground px-6 py-2 text-xs font-black uppercase tracking-widest text-background shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none"
          >
            Close
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

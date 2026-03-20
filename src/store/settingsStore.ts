import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getUserSettings, updateUserSettings, type UserSettings } from '@/lib/firebase/settings';
import { addPendingOp } from '@/lib/cache/indexedDB';
import { toast } from 'sonner';

function queueSettingsOffline(partial: Partial<UserSettings>) {
  const id = crypto.randomUUID();
  addPendingOp({ id, type: 'updateSettings', args: [partial], createdAt: Date.now() }).then(() => {
    window.dispatchEvent(new Event('pending-ops-changed'));
  }).catch((err) => {
    console.error('[settings] CRITICAL: Failed to queue offline settings:', err);
    toast.error('Failed to save settings locally', { duration: 5000 });
  });
  if (!navigator.onLine) {
    toast.info('Settings saved locally — will sync when online', { id: 'offline-settings' });
  }
}

interface SettingsState extends UserSettings {
  isLoading: boolean;
  error: string | null;
  fetchSettings: () => Promise<void>;
  updateHotkey: (key: string, value: string) => Promise<void>;
  setTheme: (theme: UserSettings['theme']) => Promise<void>;
  setCanvasTheme: (theme: string) => Promise<void>;
  setHybridEditorEnabled: (enabled: boolean) => Promise<void>;
}

const DEFAULT_HOTKEYS: Record<string, string> = {
  undo: 'mod+z',
  redo: 'mod+shift+z',
  copy: 'mod+c',
  paste: 'mod+v',
  selectAll: 'mod+a',
  fitView: 'mod+shift+h',
  resetZoom: 'mod+0',
  toggleMinimap: 'm',
  search: 'mod+p',
  toggleSidebar: 'mod+b',
  newNote: 'n',
  toggleZenMode: 'z',
  toggleFocusMode: 'f',
  toggleDrawingMode: 'd',
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      hotkeys: DEFAULT_HOTKEYS,
      theme: 'system',
      canvasTheme: 'dots',
      enableHybridEditor: true,
      isLoading: false,
      error: null,
      _updateTimer: null as ReturnType<typeof setTimeout> | null,

      fetchSettings: async () => {
        set({ isLoading: true, error: null });
        try {
          const settings = await getUserSettings();
          set({ ...settings, isLoading: false });
        } catch (err) {
          set({ error: (err as Error).message, isLoading: false });
        }
      },

      updateHotkey: async (key, value) => {
        const nextHotkeys = { ...get().hotkeys, [key]: value };
        set({ hotkeys: nextHotkeys });
        
        const { _updateTimer } = get() as any;
        if (_updateTimer) clearTimeout(_updateTimer);
        
        const timer = setTimeout(async () => {
          try {
            await updateUserSettings({ hotkeys: nextHotkeys });
          } catch {
            queueSettingsOffline({ hotkeys: nextHotkeys });
          }
        }, 1000);
        set({ _updateTimer: timer } as any);
      },

      setTheme: async (theme) => {
        set({ theme });
        const { _updateTimer } = get() as any;
        if (_updateTimer) clearTimeout(_updateTimer);
        
        const timer = setTimeout(async () => {
          try {
            await updateUserSettings({ theme });
          } catch {
            queueSettingsOffline({ theme });
          }
        }, 1000);
        set({ _updateTimer: timer } as any);
      },

      setCanvasTheme: async (canvasTheme) => {
        set({ canvasTheme });
        const { _updateTimer } = get() as any;
        if (_updateTimer) clearTimeout(_updateTimer);
        
        const timer = setTimeout(async () => {
          try {
            await updateUserSettings({ canvasTheme });
          } catch {
            queueSettingsOffline({ canvasTheme });
          }
        }, 1000);
        set({ _updateTimer: timer } as any);
      },
      
      setHybridEditorEnabled: async (enableHybridEditor) => {
        set({ enableHybridEditor });
        const { _updateTimer } = get() as any;
        if (_updateTimer) clearTimeout(_updateTimer);
        
        const timer = setTimeout(async () => {
          try {
            await updateUserSettings({ enableHybridEditor });
          } catch {
            queueSettingsOffline({ enableHybridEditor });
          }
        }, 1000);
        set({ _updateTimer: timer } as any);
      },
    }),
    {
      name: 'ctxnote-settings',
    }
  )
);

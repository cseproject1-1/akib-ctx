import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getUserSettings, updateUserSettings, type UserSettings } from '@/lib/firebase/settings';

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
        try {
          await updateUserSettings({ hotkeys: nextHotkeys });
        } catch (err) {
          set({ error: (err as Error).message });
        }
      },

      setTheme: async (theme) => {
        set({ theme });
        try {
          await updateUserSettings({ theme });
        } catch (err) {
          set({ error: (err as Error).message });
        }
      },

      setCanvasTheme: async (canvasTheme) => {
        set({ canvasTheme });
        try {
          await updateUserSettings({ canvasTheme });
        } catch (err) {
          set({ error: (err as Error).message });
        }
      },
      
      setHybridEditorEnabled: async (enableHybridEditor) => {
        set({ enableHybridEditor });
        try {
          await updateUserSettings({ enableHybridEditor });
        } catch (err) {
          set({ error: (err as Error).message });
        }
      },
    }),
    {
      name: 'ctxnote-settings',
    }
  )
);

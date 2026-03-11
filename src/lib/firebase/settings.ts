import { db, auth } from './client';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

export interface UserSettings {
  hotkeys: Record<string, string>;
  theme: 'light' | 'dark' | 'system';
  canvasTheme: string;
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
};

export async function getUserSettings(): Promise<UserSettings> {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const docRef = doc(db, 'users', user.uid);
  const snap = await getDoc(docRef);

  if (snap.exists() && snap.data().settings) {
    return {
      hotkeys: { ...DEFAULT_HOTKEYS, ...snap.data().settings.hotkeys },
      theme: snap.data().settings.theme || 'system',
      canvasTheme: snap.data().settings.canvasTheme || 'dots',
    };
  }

  return {
    hotkeys: DEFAULT_HOTKEYS,
    theme: 'system',
    canvasTheme: 'dots',
  };
}

export async function updateUserSettings(settings: Partial<UserSettings>) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const docRef = doc(db, 'users', user.uid);
  await setDoc(docRef, { settings }, { merge: true });
}

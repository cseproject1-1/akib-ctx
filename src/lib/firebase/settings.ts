import { db, auth } from './client';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

export interface UserSettings {
  hotkeys: Record<string, string>;
  theme: 'light' | 'dark' | 'system';
  canvasTheme: string;
  enableHybridEditor: boolean;
  /** bcrypt hash of the vault password — stored server-side so it syncs across devices */
  vault_password_hash?: string | null;
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
    const data = snap.data().settings;
    return {
      hotkeys: { ...DEFAULT_HOTKEYS, ...data.hotkeys },
      theme: data.theme || 'system',
      canvasTheme: data.canvasTheme || 'dots',
      enableHybridEditor: data.enableHybridEditor !== undefined ? data.enableHybridEditor : true,
      vault_password_hash: data.vault_password_hash ?? null,
    };
  }

  return {
    hotkeys: DEFAULT_HOTKEYS,
    theme: 'system',
    canvasTheme: 'dots',
    enableHybridEditor: true,
    vault_password_hash: null,
  };
}

export async function updateUserSettings(settings: Partial<UserSettings>) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  const docRef = doc(db, 'users', user.uid);
  await setDoc(docRef, { settings }, { merge: true });
}

/**
 * @function loadVaultHash
 * @description Load vault password hash from Firestore (returns null if not set or not authenticated).
 * Falls back silently — consumers should also check localStorage as an immediate cache.
 */
export async function loadVaultHash(): Promise<string | null> {
  try {
    const user = auth.currentUser;
    if (!user) return null;
    const snap = await getDoc(doc(db, 'users', user.uid));
    if (!snap.exists()) return null;
    const hash = snap.data()?.settings?.vault_password_hash;
    return typeof hash === 'string' && hash.length > 0 ? hash : null;
  } catch (e) {
    console.error('[settings] loadVaultHash failed:', e);
    return null;
  }
}

/**
 * @function saveVaultHash
 * @description Persist or clear the vault password hash in Firestore users/{uid}/settings.
 * @param {string | null} hash - bcrypt hash to store, or null to clear
 */
export async function saveVaultHash(hash: string | null): Promise<void> {
  try {
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    await setDoc(
      doc(db, 'users', user.uid),
      { settings: { vault_password_hash: hash ?? null } },
      { merge: true }
    );
  } catch (e) {
    console.error('[settings] saveVaultHash failed:', e);
    throw e; // re-throw so caller can show an error
  }
}


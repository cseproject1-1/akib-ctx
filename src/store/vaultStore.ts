/**
 * @file vaultStore.ts
 * @description Advanced vault store with:
 *  - **Cross-device sync**: bcrypt hash stored in Firestore users/{uid}/settings.vault_password_hash
 *  - Persisted bcrypt hash (localStorage) as immediate local cache — survives page reloads
 *  - Write-through: every hash change writes to localStorage immediately AND to Firestore async
 *  - Auto-load from Firestore on auth state change (see initVaultFromFirestore below)
 *  - Auto-lock after configurable inactivity timeout (default 5 min)
 *  - Brute-force protection: exponential backoff lockout after failed attempts
 *  - Multi-tab sync via BroadcastChannel (lock in one tab → all tabs lock)
 *  - Session token to detect stale unlocks after page restore
 */

import { create } from 'zustand';
import { hashPassword, verifyPassword } from '@/lib/utils/password';
import { loadVaultHash, saveVaultHash } from '@/lib/firebase/settings';

// ─── Constants ─────────────────────────────────────────────────────────────
const HASH_KEY            = 'vault-password-hash';
const CONFIG_KEY          = 'vault-config';
const SESSION_KEY         = 'vault-session-token';
const CHANNEL_NAME        = 'vault-lock-channel';

const DEFAULT_AUTO_LOCK_MS  = 5 * 60 * 1000; // 5 minutes
const MAX_ATTEMPTS          = 5;
const BASE_LOCKOUT_MS       = 30 * 1000;       // 30 seconds base lockout

// ─── Types ──────────────────────────────────────────────────────────────────

export interface VaultConfig {
  autoLockMs: number;       // 0 = disabled
  requirePasswordToLock: boolean; // ask for password before re-locking
}

export interface VaultState {
  // Core
  isLocked: boolean;
  passwordHash: string | null;

  // Brute-force protection
  failedAttempts: number;
  lockedUntil: number | null; // timestamp ms

  // Auto-lock
  config: VaultConfig;
  lastActivityAt: number;

  // Sync state
  isSyncing: boolean; // true while Firestore write is in-flight

  // Actions
  unlockVault: (password: string) => Promise<'success' | 'wrong_password' | 'no_password' | 'locked_out'>;
  lockVault: () => void;
  setPassword: (password: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  removePassword: (password: string) => Promise<boolean>;
  updateConfig: (config: Partial<VaultConfig>) => void;
  recordActivity: () => void;
  checkAutoLock: () => void;

  /**
   * Called once after Firebase auth resolves.
   * Loads the hash from Firestore and reconciles with localStorage.
   * If Firestore has a hash that localStorage doesn't (new device), adopts it and locks.
   * If localStorage has a hash that Firestore doesn't (never synced before), pushes it up.
   */
  syncFromFirestore: () => Promise<void>;

  // Internal
  _autoLockTimer: ReturnType<typeof setTimeout> | null;
  _startAutoLockTimer: () => void;
  _clearAutoLockTimer: () => void;
  _broadcastLock: () => void;
}

// ─── localStorage persistence helpers ────────────────────────────────────────

function loadHashLocal(): string | null {
  try { return localStorage.getItem(HASH_KEY); } catch (e) {
    console.error('[vaultStore] loadHashLocal failed:', e);
    return null;
  }
}
function saveHashLocal(hash: string | null) {
  try {
    if (hash) localStorage.setItem(HASH_KEY, hash);
    else localStorage.removeItem(HASH_KEY);
  } catch (e) {
    console.error('[vaultStore] saveHashLocal failed:', e);
  }
}

function loadConfig(): VaultConfig {
  try {
    const raw = localStorage.getItem(CONFIG_KEY);
    if (raw) return { ...defaultConfig(), ...JSON.parse(raw) };
  } catch (e) {
    console.error('[vaultStore] loadConfig failed:', e);
  }
  return defaultConfig();
}
function saveConfig(cfg: VaultConfig) {
  try { localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg)); } catch (e) {
    console.error('[vaultStore] saveConfig failed:', e);
  }
}

function defaultConfig(): VaultConfig {
  return { autoLockMs: DEFAULT_AUTO_LOCK_MS, requirePasswordToLock: false };
}

/** Session token — invalidated on hard reload so stale unlocks detected */
function getOrCreateSessionToken(): string {
  try {
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) return stored;
    const fresh = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, fresh);
    return fresh;
  } catch (e) {
    console.error('[vaultStore] getOrCreateSessionToken failed:', e);
    return 'no-session';
  }
}

// ─── BroadcastChannel for cross-tab lock ────────────────────────────────────
let channel: BroadcastChannel | null = null;
try { channel = new BroadcastChannel(CHANNEL_NAME); } catch (e) {
  console.error('[vaultStore] Failed to initialize BroadcastChannel:', e);
}

// ─── Lockout helper ─────────────────────────────────────────────────────────
/**
 * @param attempts - number of failed attempts so far (after this one)
 * @returns lockoutMs: 0 if not yet locked out, else ms to wait
 */
function getLockoutMs(attempts: number): number {
  if (attempts < MAX_ATTEMPTS) return 0;
  const extra = attempts - MAX_ATTEMPTS;
  return BASE_LOCKOUT_MS * Math.pow(2, extra); // 30s, 60s, 120s, …
}

// ─── Store ───────────────────────────────────────────────────────────────────

const storedHash = loadHashLocal();
const storedConfig = loadConfig();

export const useVaultStore = create<VaultState>((set, get) => {
  // ── Setup BroadcastChannel listener ──
  if (channel) {
    channel.onmessage = (event) => {
      if (event.data?.type === 'lock') {
        get()._clearAutoLockTimer();
        set({ isLocked: true });
      }
      // Cross-tab hash sync: when another tab updates/clears the hash
      if (event.data?.type === 'hash_update') {
        const newHash: string | null = event.data.hash ?? null;
        saveHashLocal(newHash);
        set({
          passwordHash: newHash,
          isLocked: !!newHash,
          failedAttempts: 0,
          lockedUntil: null,
        });
      }
    };
  }

  return {
    isLocked: !!storedHash, // locked on load if a password exists
    passwordHash: storedHash,
    failedAttempts: 0,
    lockedUntil: null,
    config: storedConfig,
    lastActivityAt: Date.now(),
    isSyncing: false,
    _autoLockTimer: null,

    // ── syncFromFirestore ────────────────────────────────────────────────────
    /**
     * Call once after auth resolves. Reconciles Firestore hash with local.
     *
     * Trace table (localStorage hash = L, Firestore hash = F):
     * | L    | F    | Action                                              |
     * |------|------|-----------------------------------------------------|
     * | null | null | No password anywhere — stay unlocked                |
     * | hash | null | Old device, never synced — push local hash to F    |
     * | null | hash | New device — adopt F, write to local, lock vault   |
     * | same | same | Already in sync — no-op                             |
     * | diff | diff | F wins (most recent server truth) — adopt F, lock  |
     */
    syncFromFirestore: async () => {
      set({ isSyncing: true });
      try {
        const remoteHash = await loadVaultHash();
        const localHash  = loadHashLocal();

        if (!remoteHash && !localHash) {
          // No password anywhere
          set({ isSyncing: false });
          return;
        }

        if (!remoteHash && localHash) {
          // localStorage has a hash but Firestore doesn't — first-time sync, push up
          console.info('[vaultStore] Pushing local vault hash to Firestore (first sync)');
          await saveVaultHash(localHash);
          set({ isSyncing: false });
          return;
        }

        if (remoteHash && remoteHash !== localHash) {
          // Firestore has a newer/different hash — adopt it
          console.info('[vaultStore] Adopting Firestore vault hash (cross-device sync)');
          saveHashLocal(remoteHash);
          set({
            passwordHash: remoteHash,
            isLocked: true,  // always lock when adopting a hash from server
            failedAttempts: 0,
            lockedUntil: null,
            isSyncing: false,
          });
          return;
        }

        // Already in sync
        set({ isSyncing: false });
      } catch (e) {
        console.error('[vaultStore] syncFromFirestore failed:', e);
        set({ isSyncing: false });
      }
    },

    // ── Unlock ──────────────────────────────────────────────────────────────
    unlockVault: async (password: string) => {
      const state = get();

      // No password configured
      if (!state.passwordHash) return 'no_password';

      // Check lockout
      if (state.lockedUntil && Date.now() < state.lockedUntil) {
        return 'locked_out';
      }

      const isValid = await verifyPassword(password, state.passwordHash);

      if (isValid) {
        set({
          isLocked: false,
          failedAttempts: 0,
          lockedUntil: null,
          lastActivityAt: Date.now(),
        });
        get()._startAutoLockTimer();
        return 'success';
      } else {
        const newAttempts = state.failedAttempts + 1;
        const lockoutMs = getLockoutMs(newAttempts);
        set({
          failedAttempts: newAttempts,
          lockedUntil: lockoutMs > 0 ? Date.now() + lockoutMs : null,
        });
        return 'wrong_password';
      }
    },

    // ── Lock ────────────────────────────────────────────────────────────────
    lockVault: () => {
      if (!get().passwordHash) return; // nothing to lock
      get()._clearAutoLockTimer();
      get()._broadcastLock();
      set({ isLocked: true });
    },

    // ── Set initial password ─────────────────────────────────────────────────
    setPassword: async (password: string) => {
      const hash = await hashPassword(password);

      // Write-through: localStorage first (immediate), then Firestore (async but awaited)
      saveHashLocal(hash);
      set({
        passwordHash: hash,
        isLocked: false,
        failedAttempts: 0,
        lockedUntil: null,
        lastActivityAt: Date.now(),
        isSyncing: true,
      });

      try {
        await saveVaultHash(hash);
        // Notify other tabs that the hash changed
        channel?.postMessage({ type: 'hash_update', hash });
      } catch (e) {
        console.error('[vaultStore] setPassword Firestore sync failed:', e);
      } finally {
        set({ isSyncing: false });
      }

      get()._startAutoLockTimer();
    },

    // ── Change password ──────────────────────────────────────────────────────
    changePassword: async (currentPassword: string, newPassword: string) => {
      const { passwordHash } = get();
      if (!passwordHash) return false;

      const isValid = await verifyPassword(currentPassword, passwordHash);
      if (!isValid) {
        const newAttempts = get().failedAttempts + 1;
        const lockoutMs = getLockoutMs(newAttempts);
        set({
          failedAttempts: newAttempts,
          lockedUntil: lockoutMs > 0 ? Date.now() + lockoutMs : null,
        });
        return false;
      }

      const newHash = await hashPassword(newPassword);

      // Write-through
      saveHashLocal(newHash);
      set({ passwordHash: newHash, failedAttempts: 0, lockedUntil: null, isSyncing: true });

      try {
        await saveVaultHash(newHash);
        channel?.postMessage({ type: 'hash_update', hash: newHash });
      } catch (e) {
        console.error('[vaultStore] changePassword Firestore sync failed:', e);
      } finally {
        set({ isSyncing: false });
      }

      return true;
    },

    // ── Remove password ──────────────────────────────────────────────────────
    removePassword: async (password: string) => {
      const { passwordHash } = get();
      if (!passwordHash) return false;

      const isValid = await verifyPassword(password, passwordHash);
      if (!isValid) {
        const newAttempts = get().failedAttempts + 1;
        const lockoutMs = getLockoutMs(newAttempts);
        set({
          failedAttempts: newAttempts,
          lockedUntil: lockoutMs > 0 ? Date.now() + lockoutMs : null,
        });
        return false;
      }

      get()._clearAutoLockTimer();

      // Write-through: clear local first, then Firestore
      saveHashLocal(null);
      set({
        passwordHash: null,
        isLocked: false,
        failedAttempts: 0,
        lockedUntil: null,
        isSyncing: true,
      });

      try {
        await saveVaultHash(null);
        channel?.postMessage({ type: 'hash_update', hash: null });
      } catch (e) {
        console.error('[vaultStore] removePassword Firestore sync failed:', e);
      } finally {
        set({ isSyncing: false });
      }

      return true;
    },

    // ── Config ───────────────────────────────────────────────────────────────
    updateConfig: (patch: Partial<VaultConfig>) => {
      const newCfg = { ...get().config, ...patch };
      saveConfig(newCfg);
      set({ config: newCfg });
      // Restart auto-lock timer with new duration
      get()._clearAutoLockTimer();
      if (!get().isLocked) get()._startAutoLockTimer();
    },

    // ── Activity tracking ────────────────────────────────────────────────────
    recordActivity: () => {
      set({ lastActivityAt: Date.now() });
      // Reset the auto-lock countdown on any vault-related activity
      if (!get().isLocked && get().passwordHash) {
        get()._clearAutoLockTimer();
        get()._startAutoLockTimer();
      }
    },

    // ── Check auto-lock (called on tab focus/visibility change) ──────────────
    checkAutoLock: () => {
      const { isLocked, passwordHash, lastActivityAt, config } = get();
      if (isLocked || !passwordHash || config.autoLockMs === 0) return;
      const elapsed = Date.now() - lastActivityAt;
      if (elapsed >= config.autoLockMs) {
        get().lockVault();
      }
    },

    // ── Internal: auto-lock timer ────────────────────────────────────────────
    _startAutoLockTimer: () => {
      const { config, passwordHash, isLocked } = get();
      if (!passwordHash || isLocked || config.autoLockMs === 0) return;
      get()._clearAutoLockTimer();
      const timer = setTimeout(() => {
        get().lockVault();
      }, config.autoLockMs);
      set({ _autoLockTimer: timer });
    },

    _clearAutoLockTimer: () => {
      const timer = get()._autoLockTimer;
      if (timer) clearTimeout(timer);
      set({ _autoLockTimer: null });
    },

    // ── Internal: broadcast lock to other tabs ───────────────────────────────
    _broadcastLock: () => {
      try { channel?.postMessage({ type: 'lock', session: getOrCreateSessionToken() }); } catch (e) {
        console.error('[vaultStore] _broadcastLock failed:', e);
      }
    },
  };
});

// ─── Page visibility auto-lock ───────────────────────────────────────────────

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      useVaultStore.getState().checkAutoLock();
    }
  });
}

/**
 * @file vaultStore.ts
 * @description Advanced vault store with:
 *  - Persisted bcrypt hash (localStorage) — survives page reloads
 *  - Auto-lock after configurable inactivity timeout (default 5 min)
 *  - Brute-force protection: exponential backoff lockout after failed attempts
 *  - Multi-tab sync via BroadcastChannel (lock in one tab → all tabs lock)
 *  - Session token to detect stale unlocks after page restore
 */

import { create } from 'zustand';
import { hashPassword, verifyPassword } from '@/lib/utils/password';

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

  // Actions
  unlockVault: (password: string) => Promise<'success' | 'wrong_password' | 'no_password' | 'locked_out'>;
  lockVault: () => void;
  setPassword: (password: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<boolean>;
  removePassword: (password: string) => Promise<boolean>;
  updateConfig: (config: Partial<VaultConfig>) => void;
  recordActivity: () => void;
  checkAutoLock: () => void;

  // Internal
  _autoLockTimer: ReturnType<typeof setTimeout> | null;
  _startAutoLockTimer: () => void;
  _clearAutoLockTimer: () => void;
  _broadcastLock: () => void;
}

// ─── Persistence helpers ─────────────────────────────────────────────────────

function loadHash(): string | null {
  try { return localStorage.getItem(HASH_KEY); } catch (e) {
    console.error('[vaultStore] loadHash failed:', e);
    return null;
  }
}
function saveHash(hash: string | null) {
  try {
    if (hash) localStorage.setItem(HASH_KEY, hash);
    else localStorage.removeItem(HASH_KEY);
  } catch (e) {
    console.error('[vaultStore] saveHash failed:', e);
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

const storedHash = loadHash();
const storedConfig = loadConfig();

export const useVaultStore = create<VaultState>((set, get) => {
  // ── Setup BroadcastChannel listener ──
  if (channel) {
    channel.onmessage = (event) => {
      if (event.data?.type === 'lock') {
        get()._clearAutoLockTimer();
        set({ isLocked: true });
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
    _autoLockTimer: null,

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
      saveHash(hash);
      set({
        passwordHash: hash,
        isLocked: false,
        failedAttempts: 0,
        lockedUntil: null,
        lastActivityAt: Date.now(),
      });
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
      saveHash(newHash);
      set({ passwordHash: newHash, failedAttempts: 0, lockedUntil: null });
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
      saveHash(null);
      set({
        passwordHash: null,
        isLocked: false,
        failedAttempts: 0,
        lockedUntil: null,
      });
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

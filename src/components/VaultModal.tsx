/**
 * @file VaultModal.tsx
 * @description Advanced vault modal with:
 *  - Unlock (with brute-force lockout countdown display)
 *  - Set / Change / Remove password
 *  - Auto-lock configuration (time picker)
 *  - Animated lock/unlock states
 */

import { useState, useEffect, useCallback } from 'react';
import { Lock, Unlock, ShieldAlert, ShieldCheck, Settings2, Eye, EyeOff, Timer, Trash2, KeyRound, RefreshCw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useVaultStore } from '@/store/vaultStore';

// ── Types ────────────────────────────────────────────────────────────────────
type ModalMode = 'unlock' | 'set' | 'change_verify' | 'change_new' | 'remove' | 'settings';

interface VaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Called when the vault is successfully unlocked */
  onUnlocked?: () => void;
  /** If true, shows a "Set Password" flow instead of unlock */
  initialMode?: ModalMode;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatMs(ms: number): string {
  if (ms <= 0) return '0s';
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem > 0 ? `${m}m ${rem}s` : `${m}m`;
}

const AUTO_LOCK_OPTIONS: { label: string; ms: number }[] = [
  { label: 'Never', ms: 0 },
  { label: '1 minute',  ms: 1  * 60 * 1000 },
  { label: '5 minutes', ms: 5  * 60 * 1000 },
  { label: '15 minutes',ms: 15 * 60 * 1000 },
  { label: '30 minutes',ms: 30 * 60 * 1000 },
  { label: '1 hour',    ms: 60 * 60 * 1000 },
];

// ── Component ─────────────────────────────────────────────────────────────────
export function VaultModal({ isOpen, onClose, onUnlocked, initialMode }: VaultModalProps) {
  const {
    isLocked,
    passwordHash,
    failedAttempts,
    lockedUntil,
    config,
    unlockVault,
    lockVault,
    setPassword: storeSetPassword,
    changePassword: storeChangePassword,
    removePassword: storeRemovePassword,
    updateConfig,
    recordActivity,
  } = useVaultStore();

  const hasPassword = !!passwordHash;

  // derive initial mode from props / state
  const [mode, setMode] = useState<ModalMode>(() => {
    if (initialMode) return initialMode;
    if (!hasPassword) return 'set';
    return 'unlock';
  });

  const [pw, setPw]               = useState('');
  const [newPw, setNewPw]         = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw]       = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Reset fields on mode change
  useEffect(() => {
    setPw(''); setNewPw(''); setConfirmPw(''); setShowPw(false); setIsLoading(false);
  }, [mode]);

  // Recalculate the appropriate initial mode when the dialog opens
  useEffect(() => {
    if (!isOpen) return;
    setMode(initialMode ?? (!hasPassword ? 'set' : 'unlock'));
  }, [isOpen, hasPassword, initialMode]);

  // Lockout countdown ticker
  useEffect(() => {
    if (!lockedUntil) { setCountdown(0); return; }
    const tick = () => {
      const remaining = lockedUntil - Date.now();
      setCountdown(Math.max(0, remaining));
    };
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [lockedUntil]);

  const isLockedOut = !!lockedUntil && Date.now() < lockedUntil;

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleUnlock = useCallback(async () => {
    if (!pw.trim() || isLockedOut) return;
    setIsLoading(true);
    recordActivity();
    try {
      const result = await unlockVault(pw);
      if (result === 'success') {
        toast.success('Vault unlocked');
        onUnlocked?.();
        onClose();
      } else if (result === 'wrong_password') {
        const { failedAttempts: fa, lockedUntil: lu } = useVaultStore.getState();
        if (lu) {
          toast.error(`Too many attempts. Try again in ${formatMs(lu - Date.now())}`);
        } else {
          const remaining = 5 - fa;
          toast.error(`Incorrect password — ${remaining} attempt${remaining === 1 ? '' : 's'} remaining`);
        }
        setPw('');
      } else if (result === 'locked_out') {
        toast.error(`Vault locked out. Try again in ${formatMs(countdown)}`);
      } else {
        // no_password — pivot to set mode
        setMode('set');
      }
    } finally {
      setIsLoading(false);
    }
  }, [pw, isLockedOut, countdown, unlockVault, onUnlocked, onClose, recordActivity]);

  const handleSetPassword = useCallback(async () => {
    if (!newPw || newPw.length < 4) { toast.error('Password must be at least 4 characters'); return; }
    if (newPw !== confirmPw) { toast.error('Passwords do not match'); return; }
    setIsLoading(true);
    try {
      await storeSetPassword(newPw);
      toast.success('Vault password set! Vault is now unlocked.');
      onUnlocked?.();
      onClose();
    } catch { toast.error('Failed to set vault password'); }
    finally { setIsLoading(false); }
  }, [newPw, confirmPw, storeSetPassword, onUnlocked, onClose]);

  const handleChangeVerify = useCallback(async () => {
    if (!pw.trim()) return;
    setIsLoading(true);
    try {
      const { verifyPassword } = await import('@/lib/utils/password');
      const isValid = await verifyPassword(pw, passwordHash!);
      if (isValid) { setMode('change_new'); }
      else {
        toast.error('Incorrect current password');
        setPw('');
      }
    } finally { setIsLoading(false); }
  }, [pw, passwordHash]);

  const handleChangeCommit = useCallback(async () => {
    if (!newPw || newPw.length < 4) { toast.error('Password must be at least 4 characters'); return; }
    if (newPw !== confirmPw) { toast.error('Passwords do not match'); return; }
    setIsLoading(true);
    try {
      const ok = await storeChangePassword(pw, newPw);
      if (ok) { toast.success('Vault password changed'); onClose(); }
      else     { toast.error('Failed to update password'); }
    } finally { setIsLoading(false); }
  }, [pw, newPw, confirmPw, storeChangePassword, onClose]);

  const handleRemove = useCallback(async () => {
    if (!pw.trim()) return;
    setIsLoading(true);
    try {
      const ok = await storeRemovePassword(pw);
      if (ok) {
        toast.success('Vault password removed — all workspaces are now accessible');
        onClose();
      } else {
        toast.error('Incorrect password');
        setPw('');
      }
    } finally { setIsLoading(false); }
  }, [pw, storeRemovePassword, onClose]);

  // ── Key handling ─────────────────────────────────────────────────────────────
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return;
    if (mode === 'unlock')        handleUnlock();
    if (mode === 'set')           handleSetPassword();
    if (mode === 'change_verify') handleChangeVerify();
    if (mode === 'change_new')    handleChangeCommit();
    if (mode === 'remove')        handleRemove();
  };

  if (!isOpen) return null;

  // ── Shared field / button primitives ─────────────────────────────────────────
  const PasswordField = (
    { value, onChange, placeholder, autoFocus = false }:
    { value: string; onChange: (v: string) => void; placeholder: string; autoFocus?: boolean }
  ) => (
    <div className="relative">
      <Input
        type={showPw ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        autoFocus={autoFocus}
        className="h-11 pr-10 font-mono tracking-wider"
        disabled={isLoading}
      />
      <button
        type="button"
        onClick={() => setShowPw(s => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        tabIndex={-1}
      >
        {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );

  // ── UI based on mode ──────────────────────────────────────────────────────────

  const renderIcon = () => {
    if (mode === 'unlock') return isLockedOut
      ? <ShieldAlert className="h-8 w-8 text-destructive" />
      : <Lock className="h-8 w-8 text-primary" />;
    if (mode === 'set')    return <KeyRound className="h-8 w-8 text-primary" />;
    if (mode === 'remove') return <Trash2 className="h-8 w-8 text-destructive" />;
    if (mode === 'settings') return <Settings2 className="h-8 w-8 text-primary" />;
    return <RefreshCw className="h-8 w-8 text-primary" />;
  };

  const renderTitle = () => {
    const titles: Record<ModalMode, string> = {
      unlock:         'Vault Locked',
      set:            'Set Vault Password',
      change_verify:  'Change Password',
      change_new:     'New Password',
      remove:         'Remove Password',
      settings:       'Vault Settings',
    };
    return titles[mode];
  };

  // ── Main body by mode ────────────────────────────────────────────────────────

  const renderBody = () => {
    // LOCKED OUT banner
    if (isLockedOut && mode === 'unlock') return (
      <div className="space-y-4">
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-center">
          <ShieldAlert className="mx-auto mb-2 h-8 w-8 text-destructive" />
          <p className="text-sm font-bold text-destructive">Too many failed attempts</p>
          <p className="text-xs text-muted-foreground mt-1">Try again in</p>
          <p className="text-3xl font-black text-destructive mt-1 tabular-nums">{formatMs(countdown)}</p>
        </div>
        <Button variant="outline" className="w-full" onClick={onClose}>Cancel</Button>
      </div>
    );

    // UNLOCK
    if (mode === 'unlock') return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Enter your vault password to access your locked workspaces.
          {failedAttempts > 0 && (
            <span className="block mt-1 font-bold text-amber-500">
              ⚠ {failedAttempts} failed attempt{failedAttempts > 1 ? 's' : ''} — {Math.max(0, 5 - failedAttempts)} remaining before lockout
            </span>
          )}
        </p>
        <PasswordField value={pw} onChange={setPw} placeholder="Enter vault password…" autoFocus />
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={isLoading}>Cancel</Button>
          <Button
            className="flex-1"
            onClick={handleUnlock}
            disabled={!pw.trim() || isLoading}
          >
            {isLoading ? 'Verifying…' : <><Unlock className="mr-2 h-4 w-4" />Unlock</>}
          </Button>
        </div>
        <div className="flex gap-2 pt-1">
          {hasPassword && (
            <button className="text-xs text-muted-foreground hover:text-foreground transition-colors" onClick={() => setMode('change_verify')}>
              Change password
            </button>
          )}
          <button className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors" onClick={() => setMode('settings')}>
            <Settings2 className="inline h-3 w-3 mr-1" />Settings
          </button>
        </div>
      </div>
    );

    // SET PASSWORD
    if (mode === 'set') return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Set a password to lock your vault and protect sensitive workspaces.
          Minimum 4 characters.
        </p>
        <PasswordField value={newPw} onChange={setNewPw} placeholder="New vault password (min 4 chars)" autoFocus />
        <PasswordField value={confirmPw} onChange={setConfirmPw} placeholder="Confirm vault password" />
        {newPw && confirmPw && newPw !== confirmPw && (
          <p className="text-xs text-destructive">Passwords do not match</p>
        )}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={isLoading}>Cancel</Button>
          <Button
            className="flex-1"
            onClick={handleSetPassword}
            disabled={!newPw || !confirmPw || newPw !== confirmPw || isLoading}
          >
            {isLoading ? 'Setting…' : <><ShieldCheck className="mr-2 h-4 w-4" />Set Password</>}
          </Button>
        </div>
      </div>
    );

    // CHANGE — verify current
    if (mode === 'change_verify') return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Enter your current vault password:</p>
        <PasswordField value={pw} onChange={setPw} placeholder="Current vault password" autoFocus />
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setMode('unlock')} disabled={isLoading}>Back</Button>
          <Button className="flex-1" onClick={handleChangeVerify} disabled={!pw.trim() || isLoading}>
            {isLoading ? 'Verifying…' : 'Continue'}
          </Button>
        </div>
        <button className="w-full text-xs text-destructive hover:underline text-center" onClick={() => setMode('remove')}>
          Remove vault password instead
        </button>
      </div>
    );

    // CHANGE — enter new password
    if (mode === 'change_new') return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Enter your new vault password:</p>
        <PasswordField value={newPw} onChange={setNewPw} placeholder="New vault password (min 4 chars)" autoFocus />
        <PasswordField value={confirmPw} onChange={setConfirmPw} placeholder="Confirm new vault password" />
        {newPw && confirmPw && newPw !== confirmPw && (
          <p className="text-xs text-destructive">Passwords do not match</p>
        )}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setMode('change_verify')} disabled={isLoading}>Back</Button>
          <Button
            className="flex-1"
            onClick={handleChangeCommit}
            disabled={!newPw || !confirmPw || newPw !== confirmPw || isLoading}
          >
            {isLoading ? 'Saving…' : 'Update Password'}
          </Button>
        </div>
      </div>
    );

    // REMOVE
    if (mode === 'remove') return (
      <div className="space-y-4">
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-400">
          ⚠ Removing the vault password will make all vault workspaces accessible without authentication.
        </div>
        <p className="text-sm text-muted-foreground">Confirm with your current vault password:</p>
        <PasswordField value={pw} onChange={setPw} placeholder="Current vault password" autoFocus />
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => setMode('unlock')} disabled={isLoading}>Cancel</Button>
          <Button
            variant="destructive"
            className="flex-1"
            onClick={handleRemove}
            disabled={!pw.trim() || isLoading}
          >
            {isLoading ? 'Removing…' : <><Trash2 className="mr-2 h-4 w-4" />Remove Password</>}
          </Button>
        </div>
      </div>
    );

    // SETTINGS
    if (mode === 'settings') return (
      <div className="space-y-5">
        <div className="space-y-2">
          <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
            <Timer className="h-3.5 w-3.5" /> Auto-Lock Timer
          </label>
          <p className="text-xs text-muted-foreground">Automatically lock the vault after this period of inactivity.</p>
          <div className="grid grid-cols-3 gap-2">
            {AUTO_LOCK_OPTIONS.map(opt => (
              <button
                key={opt.ms}
                onClick={() => updateConfig({ autoLockMs: opt.ms })}
                className={`rounded-lg border px-3 py-2 text-xs font-bold transition-all ${
                  config.autoLockMs === opt.ms
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-foreground hover:border-primary/50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-2 border-t border-border">
          <Button variant="outline" className="w-full justify-start gap-2 text-sm" onClick={() => setMode(isLocked ? 'unlock' : 'change_verify')}>
            <KeyRound className="h-4 w-4" />
            {hasPassword ? 'Change Vault Password' : 'Set Vault Password'}
          </Button>
          {hasPassword && (
            <Button variant="ghost" className="w-full justify-start gap-2 text-sm text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setMode('remove')}>
              <Trash2 className="h-4 w-4" />
              Remove Vault Password
            </Button>
          )}
        </div>

        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">Vault status: {isLocked ? '🔒 Locked' : '🔓 Unlocked'}</span>
          <Button variant="outline" size="sm" onClick={onClose}>Done</Button>
        </div>
      </div>
    );

    return null;
  };

  // ── Shell ─────────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300">
        {/* Header */}
        <div className="mb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`rounded-xl p-2.5 ${
              mode === 'remove' ? 'bg-destructive/10' :
              isLockedOut ? 'bg-destructive/10' :
              'bg-primary/10'
            }`}>
              {renderIcon()}
            </div>
            <div>
              <h3 className="text-lg font-black uppercase tracking-wider">{renderTitle()}</h3>
              <p className="text-xs text-muted-foreground">
                {hasPassword ? 'Password protected' : 'No password set'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        {renderBody()}
      </div>
    </div>
  );
}

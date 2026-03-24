import { useState } from 'react';
import { Lock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { useVaultStore } from '@/store/vaultStore';

interface VaultPasswordManageDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSetPassword: (password: string) => Promise<void>;
  onRemovePassword: () => Promise<void>;
  hasPassword: boolean;
}

export function VaultPasswordManageDialog({ isOpen, onClose, onSetPassword, onRemovePassword, hasPassword }: VaultPasswordManageDialogProps) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'verify' | 'set' | 'remove'>('verify');

  if (!isOpen) return null;

  const handleVerifyCurrent = async () => {
    setIsLoading(true);
    try {
      // Actually verify the current password against the stored hash
      const { verifyPassword } = await import('@/lib/utils/password');
      const hash = useVaultStore.getState().passwordHash;
      if (!hash) {
        // No password set — go straight to set mode
        setMode('set');
        return;
      }
      const isValid = await verifyPassword(currentPassword, hash);
      if (isValid) {
        setMode('set');
      } else {
        toast.error('Incorrect vault password');
      }
    } catch (error) {
      toast.error('Failed to verify current vault password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetPassword = async () => {
    if (!newPassword || newPassword.length < 4) {
      toast.error('Password must be at least 4 characters long');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      await onSetPassword(newPassword);
      toast.success('Vault password updated');
      onClose();
    } catch (error) {
      toast.error('Failed to update vault password');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemovePassword = async () => {
    setIsLoading(true);
    try {
      await onRemovePassword();
      toast.success('Vault password removed');
      onClose();
    } catch (error) {
      toast.error('Failed to remove vault password');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-[var(--clay-shadow-md)] animate-brutal-pop">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-2">
              <Lock className="h-5 w-5 text-primary" />
            </div>
            <h3 className="text-lg font-bold uppercase tracking-wider text-foreground">
              {hasPassword ? 'Change Vault Password' : 'Set Vault Password'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4">
          {hasPassword && mode === 'verify' && (
            <>
              <p className="text-sm text-muted-foreground">Enter current vault password to continue:</p>
              <Input
                type="password"
                placeholder="Current vault password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoFocus
                className="h-11"
              />
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={onClose} disabled={isLoading}>
                  Cancel
                </Button>
                <Button onClick={handleVerifyCurrent} disabled={!currentPassword || isLoading}>
                  Continue
                </Button>
              </div>
            </>
          )}

          {(mode === 'set' || !hasPassword) && (
            <>
              <p className="text-sm text-muted-foreground">
                {hasPassword ? 'Enter new vault password:' : 'Set a vault password to lock your locked folder:'}
              </p>
              <Input
                type="password"
                placeholder="New vault password (min 4 characters)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoFocus
                className="h-11"
              />
              <Input
                type="password"
                placeholder="Confirm new vault password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="h-11"
              />
              <div className="flex justify-between items-center">
                {hasPassword && (
                  <Button
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={handleRemovePassword}
                    disabled={isLoading}
                  >
                    Remove Password
                  </Button>
                )}
                <div className="flex justify-end gap-2 ml-auto">
                  <Button variant="outline" onClick={onClose} disabled={isLoading}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSetPassword}
                    disabled={!newPassword || newPassword !== confirmPassword || isLoading}
                  >
                    {hasPassword ? 'Update Password' : 'Set Password'}
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
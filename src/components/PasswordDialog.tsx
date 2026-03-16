import { useState } from 'react';
import { Lock, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

interface PasswordDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onVerify: (password: string) => Promise<boolean>;
  title?: string;
  message?: string;
}

export function PasswordDialog({ isOpen, onClose, onVerify, title = 'Password Required', message = 'Please enter the password to continue' }: PasswordDialogProps) {
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setIsLoading(true);
    try {
      const isValid = await onVerify(password);
      if (isValid) {
        onClose();
      } else {
        toast.error('Incorrect password');
        setPassword('');
      }
    } catch (error) {
      toast.error('Failed to verify password');
      console.error('Password verification error:', error);
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
            <h3 className="text-lg font-bold uppercase tracking-wider text-foreground">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mb-4 text-sm text-muted-foreground">{message}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="password"
            placeholder="Enter password..."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            className="h-11"
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!password.trim() || isLoading}
              className="min-w-[100px]"
            >
              {isLoading ? 'Verifying...' : 'Unlock'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
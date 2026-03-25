import React from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Moon, 
  Sun, 
  Laptop,
  User,
  Bell,
  Shield,
  Database,
  Trash2,
  HelpCircle,
  LogOut,
  ChevronRight,
  ExternalLink
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { MobileLayout } from '@/mobile/layout/MobileLayout';
import { useMobileTheme } from '@/mobile/layout/MobileDrawer';

const STORAGE_KEYS = {
  notifications: 'crxnote-notifications',
  offlineMode: 'crxnote-offline-mode',
  autoSave: 'crxnote-auto-save',
} as const;

function loadSetting(key: string, defaultValue: boolean): boolean {
  try {
    const stored = localStorage.getItem(key);
    if (stored === null) return defaultValue;
    return stored === 'true';
  } catch {
    return defaultValue;
  }
}

function saveSetting(key: string, value: boolean): void {
  try { localStorage.setItem(key, String(value)); } catch { /* quota */ }
}

function SettingsContent() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useMobileTheme();
  const [notifications, setNotifications] = React.useState(() =>
    loadSetting(STORAGE_KEYS.notifications, true)
  );
  const [offlineMode, setOfflineMode] = React.useState(() =>
    loadSetting(STORAGE_KEYS.offlineMode, true)
  );
  const [autoSave, setAutoSave] = React.useState(() =>
    loadSetting(STORAGE_KEYS.autoSave, true)
  );
  const [showClearConfirm, setShowClearConfirm] = React.useState(false);

  const handleNotificationsChange = (value: boolean) => {
    setNotifications(value);
    saveSetting(STORAGE_KEYS.notifications, value);
  };

  const handleOfflineModeChange = (value: boolean) => {
    setOfflineMode(value);
    saveSetting(STORAGE_KEYS.offlineMode, value);
  };

  const handleAutoSaveChange = (value: boolean) => {
    setAutoSave(value);
    saveSetting(STORAGE_KEYS.autoSave, value);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Failed to sign out:', error);
    }
  };

  const handleSwitchToDesktop = () => {
    localStorage.setItem('useDesktopMode', 'true');
    window.location.href = '/';
  };

  const handleClearCache = async () => {
    setShowClearConfirm(true);
  };

  const confirmClearCache = async () => {
    setShowClearConfirm(false);
    try {
      const dbs = await indexedDB.databases?.();
      if (dbs) {
        for (const db of dbs) {
          if (db.name?.includes('ctxnote') || db.name?.includes('canvas')) {
            indexedDB.deleteDatabase(db.name!);
          }
        }
      }
      window.location.reload();
    } catch (error) {
      console.error('Failed to clear cache:', error);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto pb-24">
      {/* Account Section */}
      <section className="p-4">
        <div className="flex items-center gap-3 p-3 bg-card rounded-xl border">
          <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
            <User className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground truncate">
              {user?.displayName || 'User'}
            </p>
            <p className="text-sm text-muted-foreground truncate">
              {user?.email}
            </p>
          </div>
        </div>
      </section>

      <Separator />

      {/* Appearance */}
      <section className="p-4">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Appearance
        </h3>
        <div className="flex gap-2">
          <button
            onClick={() => setTheme('light')}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-colors",
              theme === 'light' ? "border-primary bg-primary/10" : "border-border hover:bg-accent/50"
            )}
          >
            <Sun className="h-6 w-6" />
            <span className="text-sm">Light</span>
          </button>
          <button
            onClick={() => setTheme('dark')}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-2 p-4 rounded-xl border transition-colors",
              theme === 'dark' ? "border-primary bg-primary/10" : "border-border hover:bg-accent/50"
            )}
          >
            <Moon className="h-6 w-6" />
            <span className="text-sm">Dark</span>
          </button>
        </div>
      </section>

      <Separator />

      {/* Preferences */}
      <section className="p-4">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Preferences
        </h3>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <span>Notifications</span>
            </div>
            <Switch
              checked={notifications}
              onCheckedChange={handleNotificationsChange}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Database className="h-5 w-5 text-muted-foreground" />
              <span>Offline Mode</span>
            </div>
            <Switch
              checked={offlineMode}
              onCheckedChange={handleOfflineModeChange}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <span>Auto-save</span>
            </div>
            <Switch
              checked={autoSave}
              onCheckedChange={handleAutoSaveChange}
            />
          </div>
        </div>
      </section>

      <Separator />

      {/* View Mode */}
      <section className="p-4">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
          View Mode
        </h3>
        <button
          onClick={handleSwitchToDesktop}
          className="w-full flex items-center justify-between p-4 rounded-xl border hover:bg-accent/50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <Laptop className="h-5 w-5 text-muted-foreground" />
            <span>Switch to Desktop</span>
          </div>
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </button>
      </section>

      <Separator />

      {/* Storage */}
      <section className="p-4">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Storage
        </h3>
        <button
          onClick={handleClearCache}
          className="w-full flex items-center justify-between p-4 rounded-xl border hover:bg-accent/50 transition-colors text-destructive"
        >
          <div className="flex items-center gap-3">
            <Trash2 className="h-5 w-5" />
            <span>Clear Cache</span>
          </div>
          <ChevronRight className="h-5 w-5" />
        </button>
      </section>

      <Separator />

      {/* Help & Support */}
      <section className="p-4">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Help & Support
        </h3>
        <div className="space-y-2">
          <button className="w-full flex items-center justify-between p-4 rounded-xl border hover:bg-accent/50 transition-colors" aria-label="Open Help Center">
            <div className="flex items-center gap-3">
              <HelpCircle className="h-5 w-5 text-muted-foreground" />
              <span>Help Center</span>
            </div>
            <ExternalLink className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>
      </section>

      <Separator />

      {/* Sign Out */}
      <section className="p-4">
        <Button
          variant="destructive"
          className="w-full"
          onClick={handleSignOut}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sign Out
        </Button>
      </section>
      {/* Clear Cache Confirmation Dialog */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-6">
          <div className="bg-background rounded-2xl p-6 max-w-sm w-full shadow-xl">
            <h3 className="text-lg font-bold mb-2">Clear Cache?</h3>
            <p className="text-sm text-muted-foreground mb-6">
              This will clear all locally cached data. The app will reload to fetch fresh data.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowClearConfirm(false)}>
                Cancel
              </Button>
              <Button variant="destructive" className="flex-1" onClick={confirmClearCache}>
                Clear
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function MobileSettings() {
  return (
    <MobileLayout title="Settings">
      <SettingsContent />
    </MobileLayout>
  );
}

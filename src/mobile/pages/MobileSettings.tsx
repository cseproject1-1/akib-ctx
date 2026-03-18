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
import { MobileThemeProvider, useMobileTheme } from '@/mobile/layout/MobileDrawer';

function SettingsContent() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useMobileTheme();
  const [notifications, setNotifications] = React.useState(true);
  const [offlineMode, setOfflineMode] = React.useState(true);
  const [autoSave, setAutoSave] = React.useState(true);

  const handleSignOut = async () => {
    try {
      await signOut();
      // Silent mode - navigation shows sign out
      navigate('/login');
    } catch (error) {
      console.error('Failed to sign out:', error);
      // Silent mode - error is logged
    }
  };

  const handleSwitchToDesktop = () => {
    localStorage.setItem('useDesktopMode', 'true');
    window.location.href = '/';
  };

  const handleClearCache = async () => {
    try {
      // Clear IndexedDB cache for mobile
      const dbs = await indexedDB.databases?.();
      if (dbs) {
        for (const db of dbs) {
          if (db.name?.includes('ctxnote') || db.name?.includes('canvas')) {
            indexedDB.deleteDatabase(db.name!);
          }
        }
      }
      // Silent mode - visual feedback shows cache cleared
      window.location.reload();
    } catch (error) {
      console.error('Failed to clear cache:', error);
      // Silent mode - error is logged
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
              onCheckedChange={setNotifications}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Database className="h-5 w-5 text-muted-foreground" />
              <span>Offline Mode</span>
            </div>
            <Switch
              checked={offlineMode}
              onCheckedChange={setOfflineMode}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-muted-foreground" />
              <span>Auto-save</span>
            </div>
            <Switch
              checked={autoSave}
              onCheckedChange={setAutoSave}
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
          <button className="w-full flex items-center justify-between p-4 rounded-xl border hover:bg-accent/50 transition-colors">
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

import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui/button';
import { RefreshCw, X } from 'lucide-react';
import { toast } from 'sonner';
import { useEffect } from 'react';

/**
 * @function PWABanner
 * @description Handles PWA service worker registration and update notifications.
 */
export function PWABanner() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      console.log('SW Registered: ' + r);
    },
    onRegisterError(error) {
      console.log('SW registration error', error);
    },
  });

  const close = () => {
    setOfflineReady(false);
    setNeedRefresh(false);
  };

  useEffect(() => {
    if (offlineReady) {
      toast.success('App is ready to work offline!', {
        description: 'You can now use CTXNote even without an internet connection.',
        duration: 5000,
      });
      setOfflineReady(false);
    }
  }, [offlineReady, setOfflineReady]);

  if (!needRefresh) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] animate-brutal-pop">
      <div className="flex flex-col gap-4 rounded-xl border-4 border-border bg-card p-6 shadow-[8px_8px_0px_black] dark:shadow-[8px_8px_0px_#ffffff20]">
        <div className="space-y-1">
          <h3 className="text-lg font-black uppercase tracking-tight text-foreground">Update Available!</h3>
          <p className="text-sm font-medium text-muted-foreground">
            A newer version of CTXNote is available. Reload to get latest features.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => updateServiceWorker(true)}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-xs font-black uppercase tracking-widest text-primary-foreground transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <RefreshCw className="h-4 w-4" />
            Reload & Update
          </button>
          <button
            onClick={() => close()}
            className="rounded-lg border-2 border-border p-2.5 text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

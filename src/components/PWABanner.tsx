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
    <div className="fixed bottom-6 right-6 z-[170] animate-in fade-in slide-in-from-bottom-10 duration-500">
      <div className="group relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-white/10 bg-slate-950/80 p-6 backdrop-blur-xl shadow-2xl transition-all hover:bg-slate-950/90">
        {/* Animated accent line */}
        <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-blue-600 via-violet-600 to-indigo-600" />
        
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/20 text-blue-400">
              <RefreshCw className="h-4 w-4" />
            </div>
            <h3 className="text-base font-bold tracking-tight text-white">Update Available</h3>
          </div>
          <p className="text-sm font-medium leading-relaxed text-slate-400">
            A new professional version of CtxNote is ready. 
            Update now to access the latest enhancements.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => updateServiceWorker(true)}
            className="group/btn relative flex flex-1 items-center justify-center gap-2 overflow-hidden rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition-all hover:bg-blue-500 active:scale-95"
          >
            <RefreshCw className="h-4 w-4 transition-transform group-hover/btn:rotate-180 duration-500" />
            <span>Update Now</span>
          </button>
          <button
            onClick={() => close()}
            className="rounded-xl border border-white/10 bg-white/5 p-2.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, X, Smartphone, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export function MobileInstallBanner() {
  const [showBanner, setShowBanner] = useState(false);
  const [isInstalling, setIsInstalling] = useState(false);
  const [promptEvent, setPromptEvent] = useState<any>(null);

  useEffect(() => {
    // Check if on mobile
    const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);
    if (!isMobile) return;

    // Check if already installed
    const isInstalled = window.matchMedia('(display-mode: standalone)').matches;
    if (isInstalled) return;

    // Check if user has dismissed before
    const dismissed = localStorage.getItem('pwa-install-dismissed');
    if (dismissed) return;

    // Listen for beforeinstallprompt
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setPromptEvent(e);
      
      // Show banner after a delay
      setTimeout(() => {
        setShowBanner(true);
      }, 5000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstall = async () => {
    if (!promptEvent) return;
    
    setIsInstalling(true);
    
    try {
      const { outcome } = await promptEvent.prompt();
      console.log(`Install prompt outcome: ${outcome}`);
      
      if (outcome === 'accepted') {
        setShowBanner(false);
      }
    } catch (error) {
      console.error('Install failed:', error);
    } finally {
      setIsInstalling(false);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    localStorage.setItem('pwa-install-dismissed', 'true');
  };

  if (!showBanner) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        className="fixed bottom-0 left-0 right-0 z-[100] safe-area-bottom"
      >
        <div className={cn(
          "mx-2 mb-2 rounded-2xl border border-border/50 bg-background/95 backdrop-blur",
          "shadow-lg shadow-primary/10"
        )}>
          {/* Accent bar */}
          <div className="h-1 bg-gradient-to-r from-primary via-primary/70 to-primary rounded-t-2xl" />
          
          <div className="p-4">
            <div className="flex items-center gap-3">
              {/* Icon */}
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Smartphone className="h-5 w-5 text-primary" />
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-foreground">
                  Install CtxNote
                </h3>
                <p className="text-sm text-muted-foreground">
                  Add to home screen for offline access
                </p>
              </div>
              
              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={handleInstall}
                  disabled={isInstalling}
                  className="h-9"
                >
                  {isInstalling ? (
                    <div className="animate-spin h-4 w-4 border-2 border-primary/20 border-t-primary rounded-full" />
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-1" />
                      Install
                    </>
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={handleDismiss}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

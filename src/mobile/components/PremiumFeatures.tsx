import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { 
  Moon, 
  Sun, 
  Battery, 
  Wifi, 
  WifiOff,
  Zap,
  Sparkles,
  Settings,
  X
} from 'lucide-react';

interface PremiumFeaturesProps {
  onDarkModeToggle: () => void;
  isDarkMode: boolean;
}

export function PremiumFeatures({ onDarkModeToggle, isDarkMode }: PremiumFeaturesProps) {
  const [showPremiumPanel, setShowPremiumPanel] = useState(false);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // Get battery status
  useEffect(() => {
    const batteryApi = navigator as any;
    if (batteryApi.getBattery) {
      batteryApi.getBattery().then((battery: any) => {
        setBatteryLevel(battery.level * 100);
        
        const updateBattery = () => setBatteryLevel(battery.level * 100);
        battery.addEventListener('levelchange', updateBattery);
        
        return () => battery.removeEventListener('levelchange', updateBattery);
      });
    }
  }, []);

  // Network status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <>
      {/* Premium Quick Actions */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-40">
        {/* Dark Mode Toggle */}
        <motion.div whileTap={{ scale: 0.9 }}>
          <button
            onClick={onDarkModeToggle}
            className={cn(
              "h-10 w-10 rounded-full flex items-center justify-center transition-colors",
              isDarkMode ? "bg-yellow-500 text-yellow-900" : "bg-slate-800 text-slate-200"
            )}
            aria-label="Toggle dark mode"
          >
            {isDarkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </motion.div>

        {/* Premium Features Button */}
        <motion.div whileTap={{ scale: 0.9 }}>
          <button
            onClick={() => setShowPremiumPanel(true)}
            className="h-10 w-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center text-white shadow-lg"
            aria-label="Premium features"
          >
            <Zap className="h-5 w-5" />
          </button>
        </motion.div>
      </div>

      {/* Status Indicators */}
      <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-3 z-40 bg-black/50 backdrop-blur px-3 py-1.5 rounded-full">
        {/* Battery */}
        {batteryLevel !== null && (
          <div className="flex items-center gap-1.5">
            <Battery className={cn(
              "h-4 w-4",
              batteryLevel < 20 ? "text-red-400" : batteryLevel < 50 ? "text-yellow-400" : "text-green-400"
            )} />
            <span className="text-xs text-white/80">{Math.round(batteryLevel)}%</span>
          </div>
        )}
        
        {/* Network */}
        <div className="flex items-center gap-1.5">
          {isOnline ? (
            <Wifi className="h-4 w-4 text-green-400" />
          ) : (
            <WifiOff className="h-4 w-4 text-red-400" />
          )}
        </div>
        
        {/* Performance indicator */}
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-4 w-4 text-purple-400" />
          <span className="text-xs text-white/80">Premium</span>
        </div>
      </div>

      {/* Premium Features Panel */}
      <AnimatePresence>
        {showPremiumPanel && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
              onClick={() => setShowPremiumPanel(false)}
            />
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              className="fixed right-0 top-0 bottom-0 w-80 bg-background z-50 p-6 overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold">Premium Features</h2>
                <button onClick={() => setShowPremiumPanel(false)} className="p-2 hover:bg-accent rounded-full">
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-xl border border-purple-500/30">
                  <h3 className="font-semibold text-purple-400 mb-2">🚀 Performance Mode</h3>
                  <p className="text-sm text-muted-foreground">
                    Optimized rendering for smooth 60fps experience
                  </p>
                </div>
                
                <div className="p-4 bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded-xl border border-blue-500/30">
                  <h3 className="font-semibold text-blue-400 mb-2">📱 Mobile-First UI</h3>
                  <p className="text-sm text-muted-foreground">
                    Desktop features optimized for touch interactions
                  </p>
                </div>
                
                <div className="p-4 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-xl border border-green-500/30">
                  <h3 className="font-semibold text-green-400 mb-2">🔄 Smart Sync</h3>
                  <p className="text-sm text-muted-foreground">
                    Background sync with conflict resolution
                  </p>
                </div>
                
                <div className="p-4 bg-gradient-to-r from-orange-500/20 to-red-500/20 rounded-xl border border-orange-500/30">
                  <h3 className="font-semibold text-orange-400 mb-2">🎯 Gesture Controls</h3>
                  <p className="text-sm text-muted-foreground">
                    Advanced touch gestures for productivity
                  </p>
                </div>
              </div>
              
              <div className="mt-6 p-4 bg-muted rounded-xl">
                <h3 className="font-semibold mb-2">📱 Device Info</h3>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>Platform: {navigator.platform}</p>
                  <p>Touch: {('ontouchstart' in window) ? 'Yes' : 'No'}</p>
                  <p>Orientation: {window.screen.orientation?.type || 'Unknown'}</p>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export default PremiumFeatures;

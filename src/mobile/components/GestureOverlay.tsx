import React, { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface GestureOverlayProps {
  onGesture: (gesture: GestureResult) => void;
  children?: React.ReactNode;
}

interface GestureResult {
  type: 'swipe' | 'pinch' | 'pan' | 'tap' | 'doubleTap' | 'longPress' | 'threeFingerSwipe';
  direction?: 'up' | 'down' | 'left' | 'right';
  velocity?: number;
  scale?: number;
  deltaX?: number;
  deltaY?: number;
  touches?: number;
}

export function GestureOverlay({ onGesture, children }: GestureOverlayProps) {
  const [gestureVisual, setGestureVisual] = useState<{
    type: string;
    x: number;
    y: number;
  } | null>(null);

  const touchStartRef = useRef({ x: 0, y: 0, time: 0, touches: 0 });
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const visualClearTimer = useRef<NodeJS.Timeout | null>(null);
  const pinchStartDistance = useRef<number | null>(null);
  const pinchStartCenter = useRef({ x: 0, y: 0 });

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null; }
      if (visualClearTimer.current) { clearTimeout(visualClearTimer.current); visualClearTimer.current = null; }
    };
  }, []);

  const getDistance = (t1: React.Touch, t2: React.Touch): number => {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getCenter = (t1: React.Touch, t2: React.Touch): { x: number; y: number } => {
    return {
      x: (t1.clientX + t2.clientX) / 2,
      y: (t1.clientY + t2.clientY) / 2,
    };
  };

  // Only handle gestures for specific cases (not blocking normal interactions)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touches = e.touches;
    
    // Only handle 1-finger gestures, let ReactFlow handle 2+ fingers
    if (touches.length === 1) {
      touchStartRef.current.touches = touches.length;
      touchStartRef.current.x = touches[0].clientX;
      touchStartRef.current.y = touches[0].clientY;
      touchStartRef.current.time = Date.now();

      // Long press timer (only for non-interactive areas)
      longPressTimer.current = setTimeout(() => {
        onGesture({
          type: 'longPress',
          touches: 1,
        });
        setGestureVisual({
          type: 'longPress',
          x: touches[0].clientX,
          y: touches[0].clientY,
        });
        if (visualClearTimer.current) clearTimeout(visualClearTimer.current);
        visualClearTimer.current = setTimeout(() => setGestureVisual(null), 300);
      }, 500);
    } else if (touches.length === 2) {
      // Let ReactFlow handle pinches
      pinchStartDistance.current = getDistance(touches[0], touches[1]);
    }
  }, [onGesture]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touches = e.touches;

    if (touches.length === 1 && touchStartRef.current.touches === 1) {
      const dx = touches[0].clientX - touchStartRef.current.x;
      const dy = touches[0].clientY - touchStartRef.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Cancel long press if moved significantly
      if (longPressTimer.current && distance > 10) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }

    const touches = e.changedTouches;
    const endTime = Date.now();
    const duration = endTime - touchStartRef.current.time;

    if (touchStartRef.current.touches === 1) {
      const dx = touches[0].clientX - touchStartRef.current.x;
      const dy = touches[0].clientY - touchStartRef.current.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const velocity = distance / duration;

      // Only detect swipes with significant movement
      if (distance > 30 && duration < 500) {
        const direction = Math.abs(dx) > Math.abs(dy) 
          ? (dx > 0 ? 'right' : 'left')
          : (dy > 0 ? 'down' : 'up');
        
        onGesture({
          type: 'swipe',
          direction,
          velocity,
          deltaX: dx,
          deltaY: dy,
          touches: 1,
        });
      }
    }

    setGestureVisual(null);
    pinchStartDistance.current = null;
  }, [onGesture]);

  const handleTouchCancel = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    setGestureVisual(null);
    pinchStartDistance.current = null;
  }, []);

  return (
    <div
      className="relative w-full h-full"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
    >
      {children}
      
      {/* Gesture Visual Feedback */}
      <AnimatePresence>
        {gestureVisual && (
          <motion.div
            initial={{ scale: 0, opacity: 0.8 }}
            animate={{ scale: 1.2, opacity: 0.6 }}
            exit={{ scale: 0, opacity: 0 }}
            className={cn(
              "absolute pointer-events-none z-50",
              "w-16 h-16 rounded-full flex items-center justify-center",
              "bg-primary/30 backdrop-blur-sm text-white text-xs font-medium"
            )}
            style={{
              left: gestureVisual.x - 32,
              top: gestureVisual.y - 32,
            }}
          >
            {gestureVisual.type === 'longPress' && '✋'}
            {gestureVisual.type === 'swipe' && '👆'}
            {gestureVisual.type === 'pinch' && '🤏'}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default GestureOverlay;

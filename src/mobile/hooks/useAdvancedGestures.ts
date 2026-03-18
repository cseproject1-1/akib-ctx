import { useCallback, useRef, useEffect } from 'react';

interface GestureState {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  startTime: number;
  touchCount: number;
  pinchDistance: number | null;
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

export function useAdvancedGestures() {
  const gestureState = useRef<GestureState>({
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    startTime: 0,
    touchCount: 0,
    pinchDistance: null,
  });

  const tapTimer = useRef<NodeJS.Timeout | null>(null);
  const lastTapTime = useRef<number>(0);

  const getDistance = (t1: React.Touch, t2: React.Touch): number => {
    const dx = t1.clientX - t2.clientX;
    const dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getGestureDirection = (dx: number, dy: number): 'up' | 'down' | 'left' | 'right' => {
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);
    if (absDx > absDy) {
      return dx > 0 ? 'right' : 'left';
    }
    return dy > 0 ? 'down' : 'up';
  };

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touches = e.touches;
    const state = gestureState.current;
    state.touchCount = touches.length;
    state.startTime = Date.now();

    if (touches.length === 1) {
      state.startX = touches[0].clientX;
      state.startY = touches[0].clientY;
      state.currentX = touches[0].clientX;
      state.currentY = touches[0].clientY;
      state.pinchDistance = null;

      // Set up long press timer
      tapTimer.current = setTimeout(() => {
        // Long press detected
      }, 500);
    } else if (touches.length === 2) {
      // Pinch start
      state.pinchDistance = getDistance(touches[0], touches[1]);
      state.startX = (touches[0].clientX + touches[1].clientX) / 2;
      state.startY = (touches[0].clientY + touches[1].clientY) / 2;
    }
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    const touches = e.touches;
    const state = gestureState.current;

    if (touches.length === 1 && state.touchCount === 1) {
      const dx = touches[0].clientX - state.startX;
      const dy = touches[0].clientY - state.startY;
      state.currentX = touches[0].clientX;
      state.currentY = touches[0].clientY;

      // Cancel long press if moved significantly
      if (tapTimer.current && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
        clearTimeout(tapTimer.current);
        tapTimer.current = null;
      }
    } else if (touches.length === 2 && state.pinchDistance) {
      // Pinch move - calculate scale
      const currentDistance = getDistance(touches[0], touches[1]);
      state.currentX = (touches[0].clientX + touches[1].clientX) / 2;
      state.currentY = (touches[0].clientY + touches[1].clientY) / 2;
    }
  }, []);

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    const state = gestureState.current;
    const now = Date.now();
    const duration = now - state.startTime;

    // Clear long press timer
    if (tapTimer.current) {
      clearTimeout(tapTimer.current);
      tapTimer.current = null;
    }

    if (state.touchCount === 1) {
      const dx = state.currentX - state.startX;
      const dy = state.currentY - state.startY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const velocity = distance / duration;

      // Check for double tap
      const isDoubleTap = now - lastTapTime.current < 300;
      lastTapTime.current = now;

      // Determine gesture type
      if (distance < 10 && duration < 200) {
        // Tap or double tap
        return {
          type: isDoubleTap ? 'doubleTap' : 'tap' as const,
          touches: 1,
        };
      } else if (distance > 30 && duration < 500) {
        // Swipe
        return {
          type: 'swipe' as const,
          direction: getGestureDirection(dx, dy),
          velocity,
          deltaX: dx,
          deltaY: dy,
          touches: 1,
        };
      } else if (duration > 500 && distance < 10) {
        // Long press
        return {
          type: 'longPress' as const,
          touches: 1,
        };
      }
    } else if (state.touchCount === 2 && state.pinchDistance) {
      // Pinch gesture ended - scale calculation would be in move handler
      return {
        type: 'pinch' as const,
        touches: 2,
      };
    } else if (state.touchCount === 3) {
      // Three finger swipe
      const dx = state.currentX - state.startX;
      const dy = state.currentY - state.startY;
      if (Math.sqrt(dx * dx + dy * dy) > 30) {
        return {
          type: 'threeFingerSwipe' as const,
          direction: getGestureDirection(dx, dy),
          touches: 3,
        };
      }
    }

    return null;
  }, []);

  const handleTouchCancel = useCallback(() => {
    if (tapTimer.current) {
      clearTimeout(tapTimer.current);
      tapTimer.current = null;
    }
  }, []);

  return {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    handleTouchCancel,
  };
}

export default useAdvancedGestures;

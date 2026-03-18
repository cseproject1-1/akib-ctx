import { useState, useEffect, useCallback, useRef } from 'react';

interface AccessibilityState {
  isScreenReaderEnabled: boolean;
  prefersReducedMotion: boolean;
  prefersHighContrast: boolean;
  largeText: boolean;
  customCursor: boolean;
}

export function useAccessibility(): AccessibilityState {
  const [state, setState] = useState<AccessibilityState>({
    isScreenReaderEnabled: false,
    prefersReducedMotion: false,
    prefersHighContrast: false,
    largeText: false,
    customCursor: false,
  });

  useEffect(() => {
    // Check for screen reader
    const checkScreenReader = () => {
      // Check if screen reader is likely enabled
      const hasScreenReader = document.body.getAttribute('aria-hidden') !== 'true' &&
        (window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
         document.querySelector('[role="alert"]') !== null);
      
      setState(prev => ({ ...prev, isScreenReaderEnabled: hasScreenReader }));
    };

    // Check for reduced motion
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handleMotionChange = (e: MediaQueryListEvent) => {
      setState(prev => ({ ...prev, prefersReducedMotion: e.matches }));
    };

    // Check for high contrast
    const contrastQuery = window.matchMedia('(prefers-contrast: more)');
    const handleContrastChange = (e: MediaQueryListEvent) => {
      setState(prev => ({ ...prev, prefersHighContrast: e.matches }));
    };

    // Check for large text
    const textQuery = window.matchMedia('(prefers-font-size: large)');
    const handleTextChange = (e: MediaQueryListEvent) => {
      setState(prev => ({ ...prev, largeText: e.matches }));
    };

    // Initial check
    checkScreenReader();
    setState(prev => ({
      ...prev,
      prefersReducedMotion: motionQuery.matches,
      prefersHighContrast: contrastQuery.matches,
      largeText: textQuery.matches,
    }));

    // Add listeners
    motionQuery.addEventListener('change', handleMotionChange);
    contrastQuery.addEventListener('change', handleContrastChange);
    textQuery.addEventListener('change', handleTextChange);

    return () => {
      motionQuery.removeEventListener('change', handleMotionChange);
      contrastQuery.removeEventListener('change', handleContrastChange);
      textQuery.removeEventListener('change', handleTextChange);
    };
  }, []);

  return state;
}

// Keyboard navigation hook
export function useKeyboardNavigation() {
  const [isKeyboardActive, setIsKeyboardActive] = useState(false);
  const [focusedElement, setFocusedElement] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        setIsKeyboardActive(true);
      }
    };

    const handleMouseDown = () => {
      setIsKeyboardActive(false);
    };

    const handleFocus = (e: FocusEvent) => {
      if (e.target instanceof HTMLElement) {
        setFocusedElement(e.target);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('focusin', handleFocus);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('focusin', handleFocus);
    };
  }, []);

  return { isKeyboardActive, focusedElement };
}

// Announce to screen readers
export function useAnnounce() {
  const announcerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Create announcer element
    announcerRef.current = document.createElement('div');
    announcerRef.current.setAttribute('aria-live', 'polite');
    announcerRef.current.setAttribute('aria-atomic', 'true');
    announcerRef.current.setAttribute('class', 'sr-only');
    announcerRef.current.style.cssText = `
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    `;
    document.body.appendChild(announcerRef.current);

    return () => {
      if (announcerRef.current) {
        document.body.removeChild(announcerRef.current);
      }
    };
  }, []);

  const announce = useCallback((message: string) => {
    if (announcerRef.current) {
      announcerRef.current.textContent = '';
      // Small delay to ensure screen readers pick up the change
      setTimeout(() => {
        announcerRef.current!.textContent = message;
      }, 100);
    }
  }, []);

  return { announce };
}

// Focus trap hook for modals
export function useFocusTrap(isActive: boolean) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive) return;

    const element = ref.current;
    if (!element) return;

    const focusableElements = element.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      } else if (e.key === 'Escape') {
        // Close modal (would need a close callback)
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    firstElement?.focus();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isActive]);

  const setRef = useCallback((element: HTMLElement | null) => {
    ref.current = element;
  }, []);

  return { setRef };
}

// Contrast adjustment hook
export function useContrastAdjustment() {
  const [highContrast, setHighContrast] = useState(false);

  const toggleContrast = useCallback(() => {
    setHighContrast(prev => !prev);
    document.documentElement.classList.toggle('high-contrast', !highContrast);
  }, [highContrast]);

  return { highContrast, toggleContrast };
}

// Text size adjustment hook
export function useTextSizeAdjustment() {
  const [textScale, setTextScale] = useState(1);

  const increaseTextSize = useCallback(() => {
    setTextScale(prev => Math.min(prev + 0.1, 1.5));
  }, []);

  const decreaseTextSize = useCallback(() => {
    setTextScale(prev => Math.max(prev - 0.1, 0.5));
  }, []);

  const resetTextSize = useCallback(() => {
    setTextScale(1);
  }, []);

  useEffect(() => {
    document.documentElement.style.fontSize = `${textScale * 100}%`;
  }, [textScale]);

  return { textScale, increaseTextSize, decreaseTextSize, resetTextSize };
}

export default useAccessibility;

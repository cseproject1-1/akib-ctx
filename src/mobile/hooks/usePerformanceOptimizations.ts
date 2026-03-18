import { useCallback, useRef, useEffect, useState } from 'react';
import { useNodes } from '@xyflow/react';

interface PerformanceMetrics {
  fps: number;
  renderTime: number;
  nodeCount: number;
}

export function usePerformanceOptimizations() {
  const nodes = useNodes();
  const fpsRef = useRef<number>(60);
  const lastFrameRef = useRef<number>(performance.now());
  const frameCountRef = useRef<number>(0);
  const fpsUpdateTimeRef = useRef<number>(performance.now());

  // FPS calculation
  useEffect(() => {
    const updateFPS = () => {
      const now = performance.now();
      const delta = now - lastFrameRef.current;
      lastFrameRef.current = now;

      frameCountRef.current++;
      
      // Update FPS every second
      if (now - fpsUpdateTimeRef.current >= 1000) {
        fpsRef.current = Math.round((frameCountRef.current * 1000) / (now - fpsUpdateTimeRef.current));
        frameCountRef.current = 0;
        fpsUpdateTimeRef.current = now;
      }

      requestAnimationFrame(updateFPS);
    };

    const animationId = requestAnimationFrame(updateFPS);
    return () => cancelAnimationFrame(animationId);
  }, []);

  const getPerformanceMetrics = useCallback((): PerformanceMetrics => {
    return {
      fps: fpsRef.current,
      renderTime: performance.now() - lastFrameRef.current,
      nodeCount: nodes.length,
    };
  }, [nodes.length]);

  // Throttle function for expensive operations
  const throttle = useCallback((func: (...args: any[]) => void, wait: number) => {
    let timeout: NodeJS.Timeout | null = null;
    return (...args: any[]) => {
      if (!timeout) {
        timeout = setTimeout(() => {
          func(...args);
          timeout = null;
        }, wait);
      }
    };
  }, []);

  // Debounce function for saving operations
  const debounce = useCallback(<T extends (...args: any[]) => void>(func: T, wait: number) => {
    let timeout: NodeJS.Timeout | null = null;
    return (...args: Parameters<T>) => {
      if (timeout) clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }, []);

  // Virtualization helper for large node lists
  const getVisibleNodes = useCallback((viewport: { x: number; y: number; width: number; height: number; zoom: number }) => {
    const { x, y, width, height, zoom } = viewport;
    const padding = 100 / zoom; // Add padding based on zoom level
    
    return nodes.filter(node => {
      const nodeX = node.position.x;
      const nodeY = node.position.y;
      const nodeWidth = (node.style?.width || 200) as number;
      const nodeHeight = (node.style?.height || 100) as number;

      return (
        nodeX + nodeWidth + padding >= x &&
        nodeX - padding <= x + width &&
        nodeY + nodeHeight + padding >= y &&
        nodeY - padding <= y + height
      );
    });
  }, [nodes]);

  // Batch update nodes to reduce re-renders
  const batchUpdateNodes = useCallback((updates: Array<{ id: string; data: any }>) => {
    // This would be implemented with ReactFlow's setNodes
    // For now, return the updates
    return updates;
  }, []);

  return {
    getPerformanceMetrics,
    throttle,
    debounce,
    getVisibleNodes,
    batchUpdateNodes,
    currentFPS: fpsRef.current,
  };
}

// Memory management hook
export function useMemoryManagement() {
  const cleanupTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const scheduleCleanup = useCallback((key: string, cleanup: () => void, delay: number = 30000) => {
    // Clear existing timer if any
    if (cleanupTimers.current.has(key)) {
      clearTimeout(cleanupTimers.current.get(key));
    }

    // Set new timer
    const timer = setTimeout(() => {
      cleanup();
      cleanupTimers.current.delete(key);
    }, delay);

    cleanupTimers.current.set(key, timer);
  }, []);

  const cancelCleanup = useCallback((key: string) => {
    const timer = cleanupTimers.current.get(key);
    if (timer) {
      clearTimeout(timer);
      cleanupTimers.current.delete(key);
    }
  }, []);

  useEffect(() => {
    // Cleanup on unmount
    return () => {
      cleanupTimers.current.forEach(timer => clearTimeout(timer));
      cleanupTimers.current.clear();
    };
  }, []);

  return { scheduleCleanup, cancelCleanup };
}

// Lazy loading hook
export function useLazyLoading<T>(items: T[], batchSize: number = 20) {
  const [loadedCount, setLoadedCount] = useState(batchSize);

  const loadMore = useCallback(() => {
    setLoadedCount(prev => Math.min(prev + batchSize, items.length));
  }, [batchSize, items.length]);

  const visibleItems = items.slice(0, loadedCount);
  const hasMore = loadedCount < items.length;

  return { visibleItems, loadMore, hasMore, loadedCount };
}

export default usePerformanceOptimizations;

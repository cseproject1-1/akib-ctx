import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface SkeletonProps {
  className?: string;
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse bg-muted rounded",
        className
      )}
    />
  );
}

export function WorkspaceCardSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-4 p-4 bg-card border-2 border-border/50 rounded-2xl"
    >
      <Skeleton className="h-12 w-12 rounded-xl flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
      </div>
      <Skeleton className="h-8 w-8 rounded-full" />
    </motion.div>
  );
}

export function MobileDashboardSkeleton() {
  return (
    <div className="h-full flex flex-col bg-background p-4">
      {/* Search bar skeleton */}
      <Skeleton className="h-12 w-full rounded-xl mb-4" />
      
      {/* Workspace cards */}
      <div className="flex-1 space-y-3">
        <WorkspaceCardSkeleton />
        <WorkspaceCardSkeleton />
        <WorkspaceCardSkeleton />
        <WorkspaceCardSkeleton />
      </div>
    </div>
  );
}

export function MobileCanvasSkeleton() {
  return (
    <div className="h-full w-full bg-canvas-bg flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin h-12 w-12 border-4 border-primary/20 border-t-primary rounded-full mx-auto mb-4" />
        <p className="text-muted-foreground">Loading canvas...</p>
      </div>
    </div>
  );
}

export function MobileNodeSkeleton() {
  return (
    <div className="p-3 bg-card border border-border/50 rounded-xl space-y-2">
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

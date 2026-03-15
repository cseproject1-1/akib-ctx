import React, { useMemo } from 'react';
import { useNodes, type Node } from '@xyflow/react';
import { useCanvasStore } from '@/store/canvasStore';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Link as LinkIcon } from 'lucide-react';

export function PredictiveLinkingLayer() {
  const nodes = useNodes();
  const selectedNode = useMemo(() => nodes.find(n => n.selected), [nodes]);
  
  const suggestions = useMemo(() => {
    if (!selectedNode || nodes.length < 2) return [];

    const sourceData = selectedNode.data as any;
    const sourceTags = new Set(sourceData.tags || []);
    const sourceText = (sourceData.title || sourceData.text || '').toLowerCase();

    return nodes
      .filter(n => n.id !== selectedNode.id && !n.parentId)
      .map(target => {
        const targetData = target.data as any;
        const targetTags = targetData.tags || [];
        const targetText = (targetData.title || targetData.text || '').toLowerCase();

        let score = 0;
        
        // Tag overlap (high weight)
        targetTags.forEach((tag: string) => {
          if (sourceTags.has(tag)) score += 0.4;
        });

        // Simple keyword overlap (medium weight)
        const commonWords = ['the', 'and', 'with', 'this', 'that'];
        const sourceWords = sourceText.split(/\W+/).filter((w: string) => w.length > 3 && !commonWords.includes(w));
        sourceWords.forEach((word: string) => {
          if (targetText.includes(word)) score += 0.2;
        });

        return { node: target, score };
      })
      .filter(s => s.score > 0.4)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }, [selectedNode, nodes]);

  if (!selectedNode || suggestions.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden">
      <svg className="h-full w-full overflow-visible">
        <defs>
          <linearGradient id="ghost-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.4" />
            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.05" />
          </linearGradient>
        </defs>
        {suggestions.map((s, i) => {
          const sx = selectedNode.position.x + (selectedNode.measured?.width || 300) / 2;
          const sy = selectedNode.position.y + (selectedNode.measured?.height || 200) / 2;
          const tx = s.node.position.x + (s.node.measured?.width || 300) / 2;
          const ty = s.node.position.y + (s.node.measured?.height || 200) / 2;

          return (
            <motion.path
              key={s.node.id}
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              d={`M ${sx} ${sy} Q ${(sx + tx) / 2} ${(sy + ty) / 2 - 100} ${tx} ${ty}`}
              stroke="url(#ghost-gradient)"
              strokeWidth="2"
              strokeDasharray="8 4"
              fill="none"
              className="animate-pulse"
            />
          );
        })}
      </svg>
      
      {/* Small suggestion labels */}
      {suggestions.map((s) => (
        <div 
          key={s.node.id}
          className="absolute"
          style={{ 
            left: s.node.position.x + (s.node.measured?.width || 300) / 2, 
            top: s.node.position.y - 20 
          }}
        >
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex items-center gap-1.5 rounded-full bg-primary/10 px-2 py-0.5 border border-primary/20 backdrop-blur-md"
          >
            <Sparkles className="h-2.5 w-2.5 text-primary" />
            <span className="text-[8px] font-black uppercase tracking-widest text-primary">Related</span>
          </motion.div>
        </div>
      ))}
    </div>
  );
}

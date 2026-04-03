import { memo, useState, useCallback, useMemo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { RotateCcw, ChevronLeft, ChevronRight, Shuffle, Expand } from 'lucide-react';
import { useCanvasStore } from '@/store/canvasStore';
import { FlashcardNodeData } from '@/types/canvas';
import { HANDLE_IDS } from '@/lib/constants/canvas';

interface Flashcard {
  question: string;
  answer: string;
}

export const FlashcardNode = memo(({ id, data, selected }: NodeProps) => {
  const setNodeContextMenu = useCanvasStore((s) => s.setNodeContextMenu);
  const setExpandedNode = useCanvasStore((s) => s.setExpandedNode);
  const nodeData = data as unknown as FlashcardNodeData;
  const cards = useMemo(() => (nodeData.flashcards as unknown as Flashcard[]) || [], [nodeData.flashcards]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [shuffledOrder, setShuffledOrder] = useState<number[] | null>(null);

  const getCard = useCallback((idx: number) => {
    if (shuffledOrder) return cards[shuffledOrder[idx]];
    return cards[idx];
  }, [cards, shuffledOrder]);

  const card = getCard(currentIndex);
  const totalCards = cards.length;

  const next = () => {
    if (totalCards === 0) return;
    setFlipped(false);
    setCurrentIndex((i) => Math.min(i + 1, totalCards - 1));
  };
  const prev = () => {
    if (totalCards === 0) return;
    setFlipped(false);
    setCurrentIndex((i) => Math.max(i - 1, 0));
  };

  const handleShuffle = () => {
    const indices = Array.from({ length: totalCards }, (_, i) => i);
    // Fisher-Yates shuffle
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    setShuffledOrder(indices);
    setCurrentIndex(0);
    setFlipped(false);
  };

  return (
    <div
      className={`group animate-node-appear rounded-xl border bg-card overflow-hidden transition-all ${
        selected ? 'border-primary shadow-[var(--clay-shadow-md)]' : 'border-border shadow-[var(--clay-shadow-sm)]'
      }`}
      style={{ opacity: (nodeData.opacity ?? 100) / 100 }}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setNodeContextMenu({ x: e.clientX, y: e.clientY, nodeId: id });
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-2 border-b-2 border-border px-3 py-2 cursor-grab active:cursor-grabbing min-w-0">
        <span className="text-lg flex-shrink-0">🃏</span>
        <span className="text-xs font-bold uppercase tracking-wider text-primary flex-shrink-0">
          Flashcards
        </span>
        {nodeData.sourceTitle && (
          <span className="ml-auto truncate min-w-0 text-[10px] text-muted-foreground">
            from {nodeData.sourceTitle}
          </span>
        )}
        <button
          className="rounded p-0.5 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground group-hover:opacity-100 ml-auto"
          onClick={(e) => { e.stopPropagation(); setExpandedNode(id); }}
          title="Fullscreen"
        >
          <Expand className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Card body */}
      {card && (
        <div className="p-4" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={(e) => { e.stopPropagation(); setFlipped(!flipped); }}
            className="w-full cursor-pointer"
          >
            <div className={`min-h-[100px] rounded-lg border-2 border-dashed p-4 text-center transition-all ${
              flipped
                ? 'border-primary/40 bg-primary/5'
                : 'border-border bg-accent/30'
            }`}>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {flipped ? 'Answer' : 'Question'}
              </p>
              <p className="text-sm font-semibold text-foreground">
                {flipped ? card.answer : card.question}
              </p>
            </div>
          </button>

          {/* Controls */}
          <div className="mt-3 flex items-center justify-between">
            <button
              onClick={(e) => { e.stopPropagation(); prev(); }}
              disabled={currentIndex === 0}
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-20"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-muted-foreground">
                {currentIndex + 1}/{totalCards}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); setFlipped(!flipped); }}
                className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                title="Flip card"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleShuffle(); }}
                className={`rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground ${shuffledOrder ? 'text-primary' : ''}`}
                title="Shuffle cards"
              >
                <Shuffle className="h-3.5 w-3.5" />
              </button>
            </div>

            <button
              onClick={(e) => { e.stopPropagation(); next(); }}
              disabled={currentIndex === totalCards - 1}
              className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-20"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {cards.length === 0 && (
        <div className="p-4 text-center text-xs text-muted-foreground">No flashcards</div>
      )}

      <Handle type="target" position={Position.Top} id={HANDLE_IDS.TARGET.TOP} className="!-top-1.5 !opacity-0 group-hover:!opacity-100" />
      <Handle type="source" position={Position.Top} id={HANDLE_IDS.SOURCE.TOP} className="!-top-1.5 !opacity-0 group-hover:!opacity-100" />
      <Handle type="target" position={Position.Bottom} id={HANDLE_IDS.TARGET.BOTTOM} className="!-bottom-1.5 !opacity-0 group-hover:!opacity-100" />
      <Handle type="source" position={Position.Bottom} id={HANDLE_IDS.SOURCE.BOTTOM} className="!-bottom-1.5 !opacity-0 group-hover:!opacity-100" />
      <Handle type="target" position={Position.Left} id={HANDLE_IDS.TARGET.LEFT} className="!-left-1.5 !opacity-0 group-hover:!opacity-100" />
      <Handle type="source" position={Position.Left} id={HANDLE_IDS.SOURCE.LEFT} className="!-left-1.5 !opacity-0 group-hover:!opacity-100" />
      <Handle type="target" position={Position.Right} id={HANDLE_IDS.TARGET.RIGHT} className="!-right-1.5 !opacity-0 group-hover:!opacity-100" />
      <Handle type="source" position={Position.Right} id={HANDLE_IDS.SOURCE.RIGHT} className="!-right-1.5 !opacity-0 group-hover:!opacity-100" />
    </div>
  );
});

FlashcardNode.displayName = 'FlashcardNode';

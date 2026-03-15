import React, { useState } from 'react';
import { Sparkles, Check, X, Loader2, RotateCcw, Type as TypeIcon } from 'lucide-react';
import { processInlineAI, AIInlineTask } from '@/lib/aiService';
import { toast } from 'sonner';

interface AIInlineToolProps {
  onApply: (text: string) => void;
  onCancel: () => void;
  selectedText: string;
}

export function AIInlineTool({ onApply, onCancel, selectedText }: AIInlineToolProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [activeTab, setActiveTab] = useState<'options' | 'result'>('options');

  const handleTask = async (task: AIInlineTask, context?: string) => {
    setLoading(true);
    try {
      const output = await processInlineAI(selectedText, task, context);
      setResult(output);
      setActiveTab('result');
    } catch (err) {
      toast.error('AI Processing failed');
    } finally {
      setLoading(false);
    }
  };

  if (activeTab === 'result') {
    return (
      <div className="flex flex-col gap-2 min-w-[300px] animate-brutal-pop">
        <div className="text-[10px] font-bold uppercase text-muted-foreground flex justify-between items-center px-1">
          <span>AI Suggestion</span>
          <Sparkles className="h-3 w-3 text-primary animate-pulse" />
        </div>
        <div className="max-h-[150px] overflow-y-auto rounded border-2 border-primary/20 bg-muted/5 p-2 text-sm italic leading-relaxed">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : (
            result
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onApply(result)}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-md bg-primary py-1.5 text-xs font-bold text-primary-foreground hover:opacity-90 transition-all"
          >
            <Check className="h-3.5 w-3.5" /> Replace Selection
          </button>
          <button
            onClick={() => setActiveTab('options')}
            className="rounded-md border-2 border-primary/20 p-1.5 hover:bg-accent transition-all"
            title="Try another"
          >
            <RotateCcw className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={onCancel}
            className="rounded-md border-2 border-primary/20 p-1.5 hover:bg-destructive/10 hover:border-destructive/30 transition-all"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 min-w-[280px] animate-brutal-pop">
      <div className="flex items-center gap-2 rounded-md border-2 border-primary bg-background px-3 py-1 shadow-[2px_2px_0px_rgba(0,0,0,1)]">
        <Sparkles className="h-4 w-4 text-primary" />
        <input
          autoFocus
          placeholder="Ask AI to edit... (e.g. make it professional)"
          className="flex-1 bg-transparent py-1 text-sm outline-none"
          value={customPrompt}
          onChange={(e) => setCustomPrompt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && customPrompt.trim()) {
              handleTask('custom', customPrompt);
            }
          }}
        />
        {loading ? (
             <Loader2 className="h-4 w-4 animate-spin text-primary" />
        ) : (
            <button 
                onClick={() => handleTask('custom', customPrompt)}
                disabled={!customPrompt.trim()}
                className="hover:scale-110 active:scale-95 transition-transform"
            >
                <Check className="h-4 w-4 text-primary" />
            </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <QuickAction onClick={() => handleTask('polish')} label="Polish & Clean" icon={<Sparkles className="h-3 w-3" />} />
        <QuickAction onClick={() => handleTask('summarize')} label="Concise Summary" icon={<TypeIcon className="h-3 w-3" />} />
        <QuickAction onClick={() => handleTask('tone-shift', 'professional')} label="Professional" icon={<div className="text-[10px] font-bold">💼</div>} />
        <QuickAction onClick={() => handleTask('expand')} label="Continue Writing" icon={<div className="text-[10px] font-bold">✍️</div>} />
      </div>
    </div>
  );
}

function QuickAction({ label, icon, onClick }: { label: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 rounded border border-primary/10 bg-muted/30 px-2 py-1.5 text-[11px] font-semibold hover:bg-primary/10 hover:border-primary/30 transition-all text-left"
    >
      <span className="opacity-70">{icon}</span>
      {label}
    </button>
  );
}

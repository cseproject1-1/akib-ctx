import { useState, useCallback, useEffect, useRef } from 'react';
import { Search, X, ChevronUp, ChevronDown, Replace, CaseSensitive, Regex } from 'lucide-react';
import type { Editor } from '@tiptap/react';

interface FindReplaceProps {
  editor: Editor;
  onClose: () => void;
}

export function FindReplace({ editor, onClose }: FindReplaceProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [replaceTerm, setReplaceTerm] = useState('');
  const [showReplace, setShowReplace] = useState(false);
  const [results, setResults] = useState<{ from: number; to: number }[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [matchCase, setMatchCase] = useState(false);
  const [isRegex, setIsRegex] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const clearHighlights = useCallback(() => {
    // Clear any search decorations by re-focusing
    editor.commands.focus();
  }, [editor]);

  const goToMatch = useCallback((match: { from: number; to: number }) => {
    editor.chain().focus().setTextSelection(match).run();
    // Scroll into view
    const coords = editor.view.coordsAtPos(match.from);
    const editorEl = editor.view.dom.closest('.tiptap-wrapper');
    if (editorEl && coords) {
      const rect = editorEl.getBoundingClientRect();
      if (coords.top < rect.top || coords.top > rect.bottom) {
        editor.view.dom.scrollIntoView({ block: 'center' });
      }
    }
  }, [editor]);

  const search = useCallback(() => {
    if (!searchTerm.trim()) {
      setResults([]);
      setCurrentIndex(-1);
      clearHighlights();
      return;
    }

    const doc = editor.state.doc;
    const matches: { from: number; to: number }[] = [];
    
    let regex: RegExp;
    try {
      if (isRegex) {
        regex = new RegExp(searchTerm, matchCase ? 'g' : 'gi');
      } else {
        const escaped = searchTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        regex = new RegExp(escaped, matchCase ? 'g' : 'gi');
      }
    } catch (e) {
      setResults([]);
      setCurrentIndex(-1);
      return;
    }

    doc.descendants((node, pos) => {
      if (node.isText && node.text) {
        let match;
        // Reset lastIndex for each block descent if needed, but the RegExp is per-search iteration
        regex.lastIndex = 0;
        while ((match = regex.exec(node.text)) !== null) {
          matches.push({ from: pos + match.index, to: pos + match.index + match[0].length });
          if (match[0].length === 0) regex.lastIndex++; // Prevent infinite loop for zero-length matches
        }
      }
    });

    setResults(matches);
    if (matches.length > 0) {
      setCurrentIndex(0);
      goToMatch(matches[0]);
    } else {
      setCurrentIndex(-1);
    }
  }, [searchTerm, matchCase, isRegex, editor, clearHighlights, goToMatch]);

  useEffect(() => {
    const timer = setTimeout(search, 200);
    return () => clearTimeout(timer);
  }, [searchTerm, search]);

  const goNext = () => {
    if (results.length === 0) return;
    const next = (currentIndex + 1) % results.length;
    setCurrentIndex(next);
    goToMatch(results[next]);
  };

  const goPrev = () => {
    if (results.length === 0) return;
    const prev = (currentIndex - 1 + results.length) % results.length;
    setCurrentIndex(prev);
    goToMatch(results[prev]);
  };

  const replaceOne = () => {
    if (currentIndex < 0 || currentIndex >= results.length) return;
    const match = results[currentIndex];
    editor.chain().focus().setTextSelection(match).insertContent(replaceTerm).run();
    // Re-search after replacement
    setTimeout(search, 50);
  };

  const replaceAll = () => {
    if (results.length === 0) return;
    // Replace from end to start to preserve positions
    const sortedMatches = [...results].sort((a, b) => b.from - a.from);
    const { tr } = editor.state;
    for (const match of sortedMatches) {
      tr.replaceWith(match.from, match.to, editor.state.schema.text(replaceTerm));
    }
    editor.view.dispatch(tr);
    setTimeout(search, 50);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter') {
      if (e.shiftKey) goPrev();
      else goNext();
    }
  };

  return (
    <div
      className="absolute right-2 top-2 z-50 flex flex-col gap-1.5 rounded-lg border-2 border-border bg-popover p-2 shadow-[4px_4px_0px_hsl(0,0%,10%)] animate-fade-slide-in"
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-center gap-1.5">
        <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Find…"
          className="h-6 w-36 rounded border border-border bg-background px-2 text-xs text-foreground outline-none focus:border-primary"
        />
        <span className="text-[10px] font-mono text-muted-foreground w-12 text-center shrink-0">
          {results.length > 0 ? `${currentIndex + 1}/${results.length}` : '0/0'}
        </span>
        <button onClick={goPrev} className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground" title="Previous">
          <ChevronUp className="h-3.5 w-3.5" />
        </button>
        <button onClick={goNext} className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground" title="Next">
          <ChevronDown className="h-3.5 w-3.5" />
        </button>

        <div className="mx-0.5 h-4 w-px bg-border" />
        
        <button
          onClick={() => setMatchCase(!matchCase)}
          className={`rounded p-0.5 transition-all ${matchCase ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-accent'}`}
          title="Match Case"
        >
          <CaseSensitive className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => setIsRegex(!isRegex)}
          className={`rounded p-0.5 transition-all ${isRegex ? 'bg-primary/20 text-primary' : 'text-muted-foreground hover:bg-accent'}`}
          title="Use Regular Expression"
        >
          <Regex className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => setShowReplace(!showReplace)}
          className={`rounded p-0.5 ${showReplace ? 'text-primary' : 'text-muted-foreground'} hover:bg-accent hover:text-foreground`}
          title="Toggle Replace"
        >
          <Replace className="h-3.5 w-3.5" />
        </button>
        <button onClick={onClose} className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground" title="Close">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {showReplace && (
        <div className="flex items-center gap-1.5 pl-5">
          <input
            type="text"
            value={replaceTerm}
            onChange={(e) => setReplaceTerm(e.target.value)}
            placeholder="Replace…"
            className="h-6 w-36 rounded border border-border bg-background px-2 text-xs text-foreground outline-none focus:border-primary"
          />
          <button
            onClick={replaceOne}
            className="rounded px-2 py-0.5 text-[10px] font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            Replace
          </button>
          <button
            onClick={replaceAll}
            className="rounded px-2 py-0.5 text-[10px] font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            All
          </button>
        </div>
      )}
    </div>
  );
}

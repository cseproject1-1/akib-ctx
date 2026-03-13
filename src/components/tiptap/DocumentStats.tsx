import React, { useEffect, useState } from 'react';
import { Editor } from '@tiptap/react';

export const DocumentStats = ({ editor }: { editor: Editor }) => {
  const [stats, setStats] = useState({
    words: 0,
    characters: 0,
    readingTime: 0,
  });

  useEffect(() => {
    if (!editor) return;
    const updateStats = () => {
      const text = editor.getText();
      const words = text.trim() ? text.trim().split(/\s+/).length : 0;
      const characters = text.length;
      const readingTime = Math.ceil(words / 200); // Average 200 words per minute
      setStats({ words, characters, readingTime });
    };
    updateStats();
    editor.on('update', updateStats);
    return () => {
      editor.off('update', updateStats);
    };
  }, [editor]);

  return (
    <div className="flex items-center gap-4 px-4 py-2 text-[10px] font-medium text-muted-foreground border-t border-border bg-muted/5">
      <div className="flex items-center gap-1">
        <span className="font-bold text-foreground">{stats.words}</span>
        <span>words</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="font-bold text-foreground">{stats.characters}</span>
        <span>characters</span>
      </div>
      <div className="flex items-center gap-1">
        <span className="font-bold text-foreground">{stats.readingTime}</span>
        <span>min read</span>
      </div>
    </div>
  );
};

import React, { useState, useCallback, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Quote,
  Code,
  Link,
  Image,
  Paperclip,
  Mic,
  Send
} from 'lucide-react';

interface MobileRichTextEditorProps {
  content: string;
  onChange: (content: string) => void;
  onSave?: () => void;
  placeholder?: string;
  maxLength?: number;
}

export function MobileRichTextEditor({
  content,
  onChange,
  onSave,
  placeholder = 'Start typing...',
  maxLength = 5000
}: MobileRichTextEditorProps) {
  const [showToolbar, setShowToolbar] = useState(false);
  const [cursorPosition, setCursorPosition] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleFocus = useCallback(() => {
    setShowToolbar(true);
  }, []);

  const handleBlur = useCallback(() => {
    // Delay hiding toolbar to allow button clicks
    setTimeout(() => setShowToolbar(false), 200);
  }, []);

  const handleTextChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    if (newValue.length <= maxLength) {
      onChange(newValue);
    }
  }, [onChange, maxLength]);

  const insertText = useCallback((before: string, after: string = '') => {
    if (!textareaRef.current) return;
    
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    const text = content;
    const selectedText = text.substring(start, end);
    
    const newText = text.substring(0, start) + before + selectedText + after + text.substring(end);
    onChange(newText);
    
    // Set cursor position after insertion
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.selectionStart = start + before.length;
        textareaRef.current.selectionEnd = start + before.length + selectedText.length;
        textareaRef.current.focus();
      }
    }, 0);
  }, [content, onChange]);

  const formatBold = useCallback(() => insertText('**', '**'), [insertText]);
  const formatItalic = useCallback(() => insertText('*', '*'), [insertText]);
  const formatUnderline = useCallback(() => insertText('<u>', '</u>'), [insertText]);
  const formatStrike = useCallback(() => insertText('~~', '~~'), [insertText]);
  const formatQuote = useCallback(() => insertText('> ', ''), [insertText]);
  const formatCode = useCallback(() => insertText('`', '`'), [insertText]);
  const insertLink = useCallback(() => {
    const url = prompt('Enter URL:');
    if (url) insertText('[', `](${url})`);
  }, [insertText]);
  const insertImage = useCallback(() => {
    const url = prompt('Enter image URL:');
    if (url) insertText(`![alt text](${url})`, '');
  }, [insertText]);
  const formatList = useCallback(() => insertText('- ', ''), [insertText]);
  const formatNumberedList = useCallback(() => insertText('1. ', ''), [insertText]);

  const insertAttachment = useCallback(() => {
    // For file attachments, you would trigger a file input
    // This is a placeholder for the attachment functionality
    toast?.info('Attachment feature would open file picker');
  }, []);

  const startVoiceRecording = useCallback(() => {
    // Voice recording would be implemented with Web Speech API
    // This is a placeholder for voice input
    toast?.info('Voice recording would start here');
  }, []);

  const characterCount = content.length;
  const isNearLimit = characterCount > maxLength * 0.9;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <AnimatePresence>
        {showToolbar && (
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -50, opacity: 0 }}
            className="flex flex-wrap gap-1 p-2 bg-muted border-b border-border/50"
          >
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={formatBold}
              aria-label="Bold"
            >
              <Bold className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={formatItalic}
              aria-label="Italic"
            >
              <Italic className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={formatUnderline}
              aria-label="Underline"
            >
              <Underline className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={formatStrike}
              aria-label="Strikethrough"
            >
              <Strikethrough className="h-4 w-4" />
            </Button>
            <div className="w-px bg-border mx-1" />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={formatList}
              aria-label="Bullet list"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={formatNumberedList}
              aria-label="Numbered list"
            >
              <ListOrdered className="h-4 w-4" />
            </Button>
            <div className="w-px bg-border mx-1" />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={formatQuote}
              aria-label="Quote"
            >
              <Quote className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={formatCode}
              aria-label="Code"
            >
              <Code className="h-4 w-4" />
            </Button>
            <div className="w-px bg-border mx-1" />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={insertLink}
              aria-label="Insert link"
            >
              <Link className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={insertImage}
              aria-label="Insert image"
            >
              <Image className="h-4 w-4" />
            </Button>
            <div className="w-px bg-border mx-1" />
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={insertAttachment}
              aria-label="Attach file"
            >
              <Paperclip className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={startVoiceRecording}
              aria-label="Voice input"
            >
              <Mic className="h-4 w-4" />
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Editor */}
      <div className="flex-1 flex flex-col">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={handleTextChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          className={cn(
            "flex-1 w-full p-4 resize-none bg-transparent",
            "text-base leading-relaxed",
            "focus:outline-none",
            "placeholder:text-muted-foreground/50"
          )}
          style={{ caretColor: 'var(--primary)' }}
        />
        
        {/* Footer with character count and save button */}
        <div className="flex items-center justify-between p-2 border-t border-border/50">
          <span className={cn(
            "text-xs",
            isNearLimit ? "text-destructive" : "text-muted-foreground"
          )}>
            {characterCount}/{maxLength}
          </span>
          <div className="flex gap-2">
            {onSave && (
              <motion.div whileTap={{ scale: 0.95 }}>
                <Button
                  size="sm"
                  onClick={onSave}
                  className="h-7 px-3 text-xs"
                >
                  <Send className="h-3 w-3 mr-1" />
                  Save
                </Button>
              </motion.div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MobileRichTextEditor;

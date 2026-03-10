import { Panel } from '@xyflow/react';
import { NotebookPen, StickyNote, HelpCircle, BookOpen, FileUp, ImagePlus, Square, Sparkles, Plus, GraduationCap, MessageSquarePlus, ListTodo, Type, Circle, Diamond, Triangle, Pen, Globe, Sigma, Video, Table2, Braces, Cable } from 'lucide-react';
import { useCanvasStore } from '@/store/canvasStore';
import { useState } from 'react';
import { toast } from 'sonner';
import type { NodeType } from '@/types/canvas';

const toolbarItems: { type: NodeType; label: string; icon: React.ElementType; color: string }[] = [
  { type: 'aiNote', label: 'Note', icon: NotebookPen, color: 'hover:text-primary' },
  { type: 'summary', label: 'Summary', icon: StickyNote, color: 'hover:text-yellow' },
  { type: 'termQuestion', label: 'Questions', icon: HelpCircle, color: 'hover:text-orange' },
  { type: 'lectureNotes', label: 'Lecture', icon: BookOpen, color: 'hover:text-cyan' },
  { type: 'stickyNote', label: 'Sticky Note', icon: MessageSquarePlus, color: 'hover:text-yellow' },
  { type: 'checklist', label: 'Checklist', icon: ListTodo, color: 'hover:text-green' },
  { type: 'text', label: 'Text', icon: Type, color: 'hover:text-foreground' },
  { type: 'pdf', label: 'Document', icon: FileUp, color: 'hover:text-red' },
  { type: 'image', label: 'Image', icon: ImagePlus, color: 'hover:text-green' },
  { type: 'group', label: 'Group', icon: Square, color: 'hover:text-purple' },
  { type: 'flashcard', label: 'Flashcard', icon: GraduationCap, color: 'hover:text-pink' },
  { type: 'embed', label: 'Embed URL', icon: Globe, color: 'hover:text-cyan' },
  { type: 'math', label: 'Math / LaTeX', icon: Sigma, color: 'hover:text-purple' },
  { type: 'video', label: 'Video', icon: Video, color: 'hover:text-red' },
  { type: 'table', label: 'Table', icon: Table2, color: 'hover:text-cyan' },
  { type: 'codeSnippet', label: 'Code', icon: Braces, color: 'hover:text-green' },
];

const shapeItems = [
  { shape: 'rect', label: 'Rectangle', icon: Square },
  { shape: 'circle', label: 'Circle', icon: Circle },
  { shape: 'diamond', label: 'Diamond', icon: Diamond },
  { shape: 'triangle', label: 'Triangle', icon: Triangle },
];

const defaultDataForType = (type: NodeType): Record<string, unknown> => {
  switch (type) {
    case 'aiNote': return { title: 'Untitled Note', content: null };
    case 'summary': return { title: 'Summary', bullets: [''], color: 'yellow' };
    case 'termQuestion': return { year: '', questions: [''] };
    case 'lectureNotes': return { title: 'Lecture Notes', content: null, viewMode: false };
    case 'pdf': return { fileName: '', fileSize: 0 };
    case 'image': return { altText: '' };
    case 'group': return { label: 'Group', color: 'default' };
    case 'flashcard': return { flashcards: [{ question: 'What is...?', answer: 'It is...' }], sourceTitle: '' };
    case 'stickyNote': return { text: '', color: 'yellow' };
    case 'checklist': return { title: 'Checklist', items: [{ id: crypto.randomUUID(), text: '', done: false }] };
    case 'text': return { text: '', fontSize: 16 };
    case 'shape': return { shapeType: 'rect', color: 'default', label: '' };
    case 'drawing': return { paths: [], width: 400, height: 300 };
    case 'embed': return { url: '', title: '' };
    case 'math': return { title: 'Math', latex: '' };
    case 'video': return { url: '', title: '' };
    case 'table': return { title: 'Table', headers: ['Col A', 'Col B', 'Col C'], rows: [[{ value: '' }, { value: '' }, { value: '' }]] };
    case 'codeSnippet': return { title: 'Code Snippet', code: '', language: 'javascript' };
  }
};

const defaultSizeForType = (type: NodeType): { width: number; height?: number | 'auto' } => {
  switch (type) {
    case 'aiNote': return { width: 380, height: 'auto' };
    case 'summary': return { width: 280, height: 'auto' };
    case 'termQuestion': return { width: 300, height: 'auto' };
    case 'lectureNotes': return { width: 420, height: 'auto' };
    case 'pdf': return { width: 300, height: 180 }; // Fixed for PDF embed
    case 'image': return { width: 320, height: 'auto' };
    case 'group': return { width: 700, height: 500 }; // Fixed for Group container
    case 'flashcard': return { width: 320, height: 'auto' };
    case 'stickyNote': return { width: 200, height: 'auto' };
    case 'checklist': return { width: 280, height: 'auto' };
    case 'text': return { width: 240, height: 'auto' };
    case 'shape': return { width: 160, height: 120 }; // Fixed for SVGs
    case 'drawing': return { width: 400, height: 300 }; // Fixed for Canvas bounds
    case 'embed': return { width: 420, height: 340 }; // Fixed for Website iframe
    case 'math': return { width: 500, height: 'auto' };
    case 'video': return { width: 420, height: 320 }; // Fixed for Video iframe
    case 'table': return { width: 600, height: 'auto' };
    case 'codeSnippet': return { width: 420, height: 'auto' };
  }
};

export function AddNodeToolbar() {
  const { addNode, connectMode, setConnectMode } = useCanvasStore();
  const [expanded, setExpanded] = useState(false);
  const [showShapes, setShowShapes] = useState(false);

  const handleConnectorClick = () => {
    const newMode = !connectMode;
    setConnectMode(newMode);
    setExpanded(false);
    if (newMode) {
      toast.info('Connector mode: click the source node');
    }
  };

  const handleAdd = (type: NodeType, extraData?: Record<string, unknown>) => {
    const size = defaultSizeForType(type);
    const node = {
      id: crypto.randomUUID(),
      type,
      position: { x: Math.random() * 200 - 100, y: Math.random() * 200 - 100 },
      data: { ...defaultDataForType(type), ...extraData, createdAt: new Date().toISOString() },
      style: { width: size.width, height: size.height },
    };
    addNode(node);
  };

  return (
    <Panel position="top-right" className="mr-2 mt-2">
      <div className="flex flex-col items-end gap-1.5">
        <button
          onClick={() => setExpanded(!expanded)}
          className={`brutal-btn flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-300 ${
            expanded ? 'bg-primary text-primary-foreground scale-110 shadow-[0_0_16px_hsla(52,100%,50%,0.3)]' : 'bg-card text-foreground hover:scale-105 active:scale-95'
          }`}
          title="Add node"
        >
          {expanded ? (
            <Sparkles className="h-5 w-5 animate-pulse" />
          ) : (
            <Plus className="h-5 w-5 transition-transform duration-200" />
          )}
        </button>

        {expanded && (
          <div className="flex flex-col gap-0.5 rounded-lg border-2 border-border bg-card p-1.5 shadow-[4px_4px_0px_hsl(0,0%,15%)] animate-scale-in origin-top-right">
            {toolbarItems.map((item, idx) => (
              <button
                key={item.type}
                onClick={() => handleAdd(item.type)}
                className={`group flex items-center gap-2.5 rounded-md px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground transition-all hover:bg-accent hover:translate-x-[-2px] ${item.color}`}
                title={item.label}
                style={{ animationDelay: `${idx * 20}ms` }}
              >
                <item.icon className="h-4 w-4 transition-transform duration-200 group-hover:scale-125 group-hover:rotate-12" />
                <span>{item.label}</span>
              </button>
            ))}

            {/* Shapes sub-menu */}
            <div className="relative">
              <button
                onClick={() => setShowShapes(!showShapes)}
                className="group flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground transition-all hover:bg-accent hover:text-cyan"
              >
                <Diamond className="h-4 w-4 transition-transform duration-200 group-hover:scale-125 group-hover:rotate-45" />
                <span>Shapes</span>
              </button>
              {showShapes && (
                <div className="absolute right-full top-0 mr-1 flex flex-col gap-1 rounded-lg border-2 border-border bg-card p-1.5 shadow-[4px_4px_0px_hsl(0,0%,15%)] animate-scale-in">
                  {shapeItems.map((s) => (
                    <button
                      key={s.shape}
                      onClick={() => handleAdd('shape', { shapeType: s.shape })}
                      className="group flex items-center gap-2.5 rounded-md px-3 py-2 text-xs font-bold uppercase tracking-wider text-muted-foreground transition-all hover:bg-accent hover:text-foreground"
                    >
                      <s.icon className="h-4 w-4 transition-transform duration-200 group-hover:scale-125" />
                      <span>{s.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Connector / Edge tool */}
            <div className="border-t border-border mt-1 pt-1">
              <button
                onClick={handleConnectorClick}
                className={`group flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-xs font-bold uppercase tracking-wider transition-all hover:bg-accent ${
                  connectMode ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-primary'
                }`}
              >
                <Cable className="h-4 w-4 transition-transform duration-200 group-hover:scale-125" />
                <span>Connector</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </Panel>
  );
}

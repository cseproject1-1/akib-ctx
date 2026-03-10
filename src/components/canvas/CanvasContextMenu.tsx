import { useCanvasStore } from '@/store/canvasStore';
import { FileText, StickyNote, HelpCircle, BookOpen, FileUp, ImagePlus, Square, GraduationCap, MessageSquare, CheckSquare, Type, Diamond, Sigma, Video, Table2 } from 'lucide-react';
import type { NodeType } from '@/types/canvas';

const menuItems: { type: NodeType; label: string; icon: React.ElementType; separator?: boolean; extraData?: Record<string, unknown> }[] = [
  { type: 'aiNote', label: 'Note (AI Reply)', icon: FileText },
  { type: 'summary', label: 'Summary', icon: StickyNote },
  { type: 'termQuestion', label: 'Term Questions', icon: HelpCircle },
  { type: 'lectureNotes', label: 'Lecture Notes', icon: BookOpen },
  { type: 'stickyNote', label: 'Sticky Note', icon: MessageSquare, separator: true },
  { type: 'checklist', label: 'Checklist', icon: CheckSquare },
  { type: 'text', label: 'Text', icon: Type },
  { type: 'shape', label: 'Shape', icon: Diamond, separator: true },
  { type: 'pdf', label: 'Upload PDF', icon: FileUp, separator: true },
  { type: 'image', label: 'Upload Image', icon: ImagePlus },
  { type: 'group', label: 'Group', icon: Square, separator: true },
  { type: 'flashcard', label: 'Flashcards', icon: GraduationCap },
  { type: 'math', label: 'Math / LaTeX', icon: Sigma, separator: true },
  { type: 'video', label: 'Video Embed', icon: Video },
  { type: 'table', label: 'Table', icon: Table2 },
];

const defaultDataForType = (type: NodeType): Record<string, unknown> => {
  switch (type) {
    case 'aiNote': return { title: 'Untitled Note', content: null };
    case 'summary': return { title: 'Summary', bullets: [''], color: 'yellow' };
    case 'termQuestion': return { year: '2024', questions: [''] };
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
  }
};

const defaultSizeForType = (type: NodeType): { width: number; height: number } => {
  switch (type) {
    case 'aiNote': return { width: 380, height: 500 };
    case 'summary': return { width: 280, height: 340 };
    case 'termQuestion': return { width: 300, height: 420 };
    case 'lectureNotes': return { width: 420, height: 600 };
    case 'pdf': return { width: 300, height: 180 };
    case 'image': return { width: 320, height: 280 };
    case 'group': return { width: 700, height: 500 };
    case 'flashcard': return { width: 320, height: 300 };
    case 'stickyNote': return { width: 200, height: 160 };
    case 'checklist': return { width: 280, height: 320 };
    case 'text': return { width: 240, height: 60 };
    case 'shape': return { width: 160, height: 120 };
    case 'drawing': return { width: 400, height: 300 };
    case 'embed': return { width: 420, height: 340 };
    case 'math': return { width: 500, height: 260 };
    case 'video': return { width: 420, height: 320 };
    case 'table': return { width: 400, height: 300 };
  }
};

export function CanvasContextMenu() {
  const contextMenu = useCanvasStore((s) => s.contextMenu);
  const setContextMenu = useCanvasStore((s) => s.setContextMenu);
  const addNode = useCanvasStore((s) => s.addNode);

  if (!contextMenu) return null;

  const handleAdd = (type: NodeType) => {
    const size = defaultSizeForType(type);
    const node = {
      id: crypto.randomUUID(),
      type,
      position: { x: contextMenu.canvasX - size.width / 2, y: contextMenu.canvasY - size.height / 2 },
      data: defaultDataForType(type),
      style: { width: size.width, height: size.height },
    };
    addNode(node);
    setContextMenu(null);
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50"
        onClick={() => setContextMenu(null)}
        onContextMenu={(e) => { e.preventDefault(); setContextMenu(null); }}
      />
      <div
        className="fixed z-50 min-w-[220px] max-h-[80vh] overflow-y-auto rounded-lg border-2 border-border bg-card p-1.5 shadow-[4px_4px_0px_hsl(0,0%,15%)] animate-brutal-pop"
        style={{ left: Math.min(contextMenu.x, window.innerWidth - 240), top: Math.min(contextMenu.y, window.innerHeight - 400) }}
      >
        {menuItems.map((item, i) => (
          <div key={item.type}>
            {item.separator && i > 0 && <div className="my-1 h-0.5 bg-border" />}
            <button
              className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-sm font-semibold text-foreground transition-all hover:bg-primary hover:text-primary-foreground"
              onClick={() => handleAdd(item.type)}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
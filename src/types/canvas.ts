export type NodeType =
  | 'aiNote'
  | 'summary'
  | 'termQuestion'
  | 'lectureNotes'
  | 'pdf'
  | 'image'
  | 'group'
  | 'flashcard'
  | 'stickyNote'
  | 'checklist'
  | 'text'
  | 'shape'
  | 'drawing'
  | 'embed'
  | 'math'
  | 'video'
  | 'table'
  | 'codeSnippet';

/** Shared optional fields available on all node data */
export interface SharedNodeFields {
  locked?: boolean;
  pinned?: boolean;
  tags?: string[];
  collapsed?: boolean;
  emoji?: string;
  dueDate?: string; // ISO date string
  opacity?: number; // 25-100, default 100
  createdAt?: string; // ISO datetime string
}

export interface AINoteNodeData extends SharedNodeFields {
  title?: string;
  content?: unknown;
}

export interface SummaryNodeData extends SharedNodeFields {
  title: string;
  bullets: string[];
  color?: string;
}

export interface TermQuestionNodeData extends SharedNodeFields {
  year: string;
  questions: string[];
}

export interface LectureNotesNodeData extends SharedNodeFields {
  title: string;
  content?: unknown;
  viewMode?: boolean;
}

export interface PDFNodeData extends SharedNodeFields {
  fileName: string;
  fileSize: number;
  storageKey?: string;
  storageUrl?: string;
  uploading?: boolean;
  progress?: number;
  fileType?: 'pdf' | 'doc' | 'docx' | 'ppt' | 'pptx';
}

export interface ImageNodeData extends SharedNodeFields {
  storageKey?: string;
  storageUrl?: string;
  altText?: string;
  uploading?: boolean;
  progress?: number;
}

export interface GroupNodeData extends SharedNodeFields {
  label: string;
  color?: string;
}

export interface FlashcardNodeData extends SharedNodeFields {
  flashcards: { question: string; answer: string }[];
  sourceTitle?: string;
}

export interface StickyNoteNodeData extends SharedNodeFields {
  text: string;
  color?: string;
  fontSize?: 'S' | 'M' | 'L';
}

export interface ChecklistNodeData extends SharedNodeFields {
  title: string;
  items: { id: string; text: string; done: boolean }[];
}

export interface TextNodeData extends SharedNodeFields {
  text: string;
  fontSize?: number;
}

export interface ShapeNodeData extends SharedNodeFields {
  shapeType: 'rect' | 'circle' | 'diamond' | 'triangle';
  color?: string;
  label?: string;
}

export interface DrawingNodeData extends SharedNodeFields {
  paths: { d: string; color: string; width: number }[];
  width?: number;
  height?: number;
}

export interface EmbedNodeData extends SharedNodeFields {
  url?: string;
  title?: string;
}

export interface MathNodeData extends SharedNodeFields {
  title?: string;
  latex?: string;
}

export type CanvasNodeData =
  | AINoteNodeData
  | SummaryNodeData
  | TermQuestionNodeData
  | LectureNotesNodeData
  | PDFNodeData
  | ImageNodeData
  | GroupNodeData
  | FlashcardNodeData
  | StickyNoteNodeData
  | ChecklistNodeData
  | TextNodeData
  | ShapeNodeData
  | DrawingNodeData
  | EmbedNodeData
  | MathNodeData;

export interface Workspace {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
}

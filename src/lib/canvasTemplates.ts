interface TemplateNode {
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
  style: { width: number; height: number };
}

interface CanvasTemplate {
  id: string;
  name: string;
  description: string;
  emoji: string;
  nodes: TemplateNode[];
}

export const canvasTemplates: CanvasTemplate[] = [
  {
    id: 'exam-prep',
    name: 'Exam Prep',
    description: 'Term questions, flashcards, and summary',
    emoji: '📝',
    nodes: [
      {
        type: 'termQuestion',
        position: { x: 0, y: 0 },
        data: { year: '2024', questions: ['Question 1?', 'Question 2?', 'Question 3?'] },
        style: { width: 300, height: 420 },
      },
      {
        type: 'summary',
        position: { x: 380, y: 0 },
        data: { title: 'Key Concepts', bullets: ['Concept 1', 'Concept 2', 'Concept 3'], color: 'yellow' },
        style: { width: 280, height: 340 },
      },
      {
        type: 'flashcard',
        position: { x: 740, y: 0 },
        data: { flashcards: [{ question: 'Key term?', answer: 'Definition...' }], sourceTitle: 'Study Cards' },
        style: { width: 320, height: 300 },
      },
      {
        type: 'checklist',
        position: { x: 380, y: 400 },
        data: {
          title: 'Study Checklist',
          items: [
            { id: '1', text: 'Review notes', done: false },
            { id: '2', text: 'Practice questions', done: false },
            { id: '3', text: 'Flashcard review', done: false },
          ],
        },
        style: { width: 280, height: 280 },
      },
    ],
  },
  {
    id: 'lecture-review',
    name: 'Lecture Review',
    description: 'Lecture notes, summary, and checklist',
    emoji: '📖',
    nodes: [
      {
        type: 'lectureNotes',
        position: { x: 0, y: 0 },
        data: { title: 'Lecture Notes', content: null, viewMode: false },
        style: { width: 420, height: 600 },
      },
      {
        type: 'summary',
        position: { x: 500, y: 0 },
        data: { title: 'Key Takeaways', bullets: ['Point 1', 'Point 2'], color: 'cyan' },
        style: { width: 280, height: 340 },
      },
      {
        type: 'checklist',
        position: { x: 500, y: 400 },
        data: {
          title: 'Follow-up Tasks',
          items: [
            { id: '1', text: 'Review key concepts', done: false },
            { id: '2', text: 'Complete exercises', done: false },
          ],
        },
        style: { width: 280, height: 240 },
      },
    ],
  },
  {
    id: 'research',
    name: 'Research',
    description: 'Notes, PDF references, images, and groups',
    emoji: '🔬',
    nodes: [
      {
        type: 'group',
        position: { x: -20, y: -20 },
        data: { label: 'Sources', color: 'purple' },
        style: { width: 720, height: 350 },
      },
      {
        type: 'aiNote',
        position: { x: 0, y: 0 },
        data: { title: 'Research Notes', content: null },
        style: { width: 380, height: 300 },
      },
      {
        type: 'pdf',
        position: { x: 400, y: 0 },
        data: { fileName: 'Drop PDF here', fileSize: 0 },
        style: { width: 300, height: 180 },
      },
      {
        type: 'summary',
        position: { x: 0, y: 380 },
        data: { title: 'Findings', bullets: ['Finding 1', 'Finding 2'], color: 'green' },
        style: { width: 280, height: 340 },
      },
      {
        type: 'stickyNote',
        position: { x: 400, y: 380 },
        data: { text: 'Remember to cite sources!', color: 'orange' },
        style: { width: 200, height: 150 },
      },
    ],
  },
  {
    id: 'brainstorm',
    name: 'Brainstorm',
    description: 'Quick sticky notes for ideas',
    emoji: '💡',
    nodes: [
      {
        type: 'stickyNote',
        position: { x: 0, y: 0 },
        data: { text: 'Idea 1', color: 'yellow' },
        style: { width: 180, height: 140 },
      },
      {
        type: 'stickyNote',
        position: { x: 220, y: -20 },
        data: { text: 'Idea 2', color: 'green' },
        style: { width: 180, height: 140 },
      },
      {
        type: 'stickyNote',
        position: { x: 440, y: 10 },
        data: { text: 'Idea 3', color: 'cyan' },
        style: { width: 180, height: 140 },
      },
      {
        type: 'stickyNote',
        position: { x: 110, y: 170 },
        data: { text: 'Idea 4', color: 'purple' },
        style: { width: 180, height: 140 },
      },
      {
        type: 'stickyNote',
        position: { x: 330, y: 180 },
        data: { text: 'Idea 5', color: 'orange' },
        style: { width: 180, height: 140 },
      },
    ],
  },
];

export function instantiateTemplate(templateId: string) {
  const template = canvasTemplates.find((t) => t.id === templateId);
  if (!template) return [];
  return template.nodes.map((n) => ({
    ...n,
    id: crypto.randomUUID(),
    data: { ...n.data },
    style: { ...n.style },
  }));
}

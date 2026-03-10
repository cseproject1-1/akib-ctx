import { type Node } from '@xyflow/react';
import { 
  FileText, 
  CheckSquare, 
  Layout, 
  RefreshCw, 
  Target, 
  BookOpen,
  PieChart,
  ClipboardList
} from 'lucide-react';

export interface NodeTemplate {
  id: string;
  name: string;
  description: string;
  icon: any;
  category: 'General' | 'Project' | 'Study' | 'Analysis';
  type: string;
  data: any;
  width?: number;
  height?: number;
}

export const NODE_TEMPLATES: NodeTemplate[] = [
  {
    id: 'meeting-minutes',
    name: 'Meeting Minutes',
    description: 'Capture attendees, agenda, and action items.',
    icon: ClipboardList,
    category: 'General',
    type: 'aiNote',
    data: {
      title: 'Meeting Minutes',
      content: {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Meeting Minutes' }] },
          { type: 'paragraph', content: [{ type: 'text', text: 'Date: ' }, { type: 'text', marks: [{ type: 'bold' }], text: '2024-XX-XX' }] },
          { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Attendees' }] },
          { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Name 1' }] }] }] },
          { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Agenda' }] },
          { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Topic A' }] }] }] },
          { type: 'heading', attrs: { level: 3 }, content: [{ type: 'text', text: 'Action Items' }] },
          { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Action 1' }] }] }] },
        ]
      }
    },
    width: 500,
    height: 600
  },
  {
    id: 'project-plan-simple',
    name: 'Project Roadmap',
    description: 'A simple phases-based checklist.',
    icon: Layout,
    category: 'Project',
    type: 'checklist',
    data: {
      title: 'Project Roadmap',
      items: [
        { id: '1', text: 'Planning & Discovery', done: false },
        { id: '2', text: 'Design Prototypes', done: false },
        { id: '3', text: 'Development Phase 1', done: false },
        { id: '4', text: 'Testing & QA', done: false },
        { id: '5', text: 'Launch', done: false },
      ]
    },
    width: 350,
  },
  {
    id: 'weekly-reflection',
    name: 'Weekly Reflection',
    description: 'Review wins, challenges, and goals for next week.',
    icon: RefreshCw,
    category: 'General',
    type: 'summary',
    data: {
      title: 'Weekly Reflection',
      bullets: [
        'Top 3 Wins this week:',
        'Major Challenges:',
        'What I learned:',
        'Goals for next week:',
      ]
    },
    width: 400,
  },
  {
    id: 'study-guide',
    name: 'Study Guide',
    description: 'Framework for summarizing a chapter or topic.',
    icon: BookOpen,
    category: 'Study',
    type: 'lectureNotes',
    data: {
      title: 'Study Guide: Topic Name',
      content: {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Key Concepts' }] },
          { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Concept 1: Definition' }] }] }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Important Formulas/Terms' }] },
          { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Term A' }] }] }] },
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Summary' }] },
        ]
      }
    },
    width: 500,
    height: 600
  },
  {
    id: 'swot-analysis',
    name: 'SWOT Analysis',
    description: 'Strengths, Weaknesses, Opportunities, Threats.',
    icon: Target,
    category: 'Analysis',
    type: 'summary',
    data: {
      title: 'SWOT Analysis',
      bullets: [
        '💪 Strengths',
        '📉 Weaknesses',
        '🚀 Opportunities',
        '⚠️ Threats',
      ]
    },
    width: 450,
  }
];

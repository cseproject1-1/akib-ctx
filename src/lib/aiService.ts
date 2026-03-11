import { toast } from 'sonner';

const WORKER_URL = import.meta.env.VITE_WORKER_URL;

export interface AINodeContext {
  id: string;
  type: string;
  title: string;
  content: string;
}

export async function askAIAboutNodes(nodes: AINodeContext[], prompt: string): Promise<string> {
  if (!WORKER_URL) {
    throw new Error('AI Worker URL not configured');
  }

  const response = await fetch(`${WORKER_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        {
          role: 'system',
          content: 'You are an intelligent canvas assistant. You will be provided with context from multiple nodes (notes, spreadsheets, etc.) on a digital canvas. Use this context to answer the user\'s query precisely. Use markdown for formatting.',
        },
        {
          role: 'user',
          content: `Context from nodes:\n${nodes.map(n => `[${n.type.toUpperCase()}: ${n.title}]\n${n.content}`).join('\n\n')}\n\nQuery: ${prompt}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to get AI response');
  }

  const data = await response.json();
  return data.response || data.choices?.[0]?.message?.content || 'No response from AI.';
}

export function extractNodeText(node: any): string {
  const data = node.data;
  if (!data) return '';
  
  const parts: string[] = [];
  
  if (data.title) parts.push(`Title: ${data.title}`);
  
  // Tiptap Content
  if (data.content) {
    parts.push(extractTiptapText(data.content));
  }
  
  // Simple Text/Sticky
  if (data.text) parts.push(data.text);
  
  // Code
  if (data.code) parts.push(`Code:\n${data.code}`);
  
  // Checklist
  if (data.items) {
    parts.push("Checklist:\n" + data.items.map((i: any) => `${i.done ? '[x]' : '[ ]'} ${i.text}`).join('\n'));
  }
  
  // Table / Spreadsheet
  if (data.grid) {
     parts.push("Spreadsheet Data:\n" + data.grid.map((row: any) => row.join(' | ')).join('\n'));
  }
  
  return parts.join('\n');
}

function extractTiptapText(content: any): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (content.text) return content.text;
  if (Array.isArray(content.content)) {
    return content.content.map(extractTiptapText).join(' ');
  }
  if (content.content) return extractTiptapText(content.content);
  return '';
}

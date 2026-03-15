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

export type AIInlineTask = 'polish' | 'summarize' | 'expand' | 'tone-shift' | 'custom';

export async function processInlineAI(text: string, task: AIInlineTask, context?: string): Promise<string> {
  if (!WORKER_URL) throw new Error('AI Worker URL not configured');

  const prompts: Record<AIInlineTask, string> = {
    'polish': 'Improve the grammar, clarity, and flow of the following text while maintaining its meaning. Return ONLY the improved text.',
    'summarize': 'Provide a concise summary of the following text. Return ONLY the summary.',
    'expand': 'Continue writing the following text naturally, building on the existing context. Return ONLY the new content.',
    'tone-shift': `Rewrite the following text in a ${context || 'professional'} tone. Return ONLY the rewritten text.`,
    'custom': context || 'Rewrite the following text based on this instruction.',
  };

  const response = await fetch(`${WORKER_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: 'You are a professional editor. Return ONLY the requested text without preamble or commentary.' },
        { role: 'user', content: `${prompts[task]}\n\nText: "${text}"` },
      ],
    }),
  });

  if (!response.ok) throw new Error('AI adjustment failed');
  const data = await response.json();
  return data.response || data.choices?.[0]?.message?.content || text;
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

export async function generateCanvasFromPrompt(prompt: string): Promise<{ nodes: any[], edges: any[] }> {
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
          content: `You are an expert at spatial organization and knowledge mapping. 
          Given a user prompt, generate a structured set of nodes and edges that logically represent the concept.
          
          Return ONLY a valid JSON object with this exact structure:
          {
            "nodes": [
              {
                "id": "unique-id-1",
                "type": "note" | "checklist" | "summary" | "codeSnippet",
                "position": { "x": number, "y": number },
                "data": { "title": "...", "content" | "items" | "bullets" | "code": "..." }
              }
            ],
            "edges": [
              { "source": "id1", "target": "id2", "label": "label" }
            ]
          }
          
          Guidelines:
          - Use meaningful labels for edges.
          - Use diverse node types where appropriate.
          - Arrange nodes in a logical layout (e.g., flow from left to right or top to bottom).
          - Use positions around (0,0) as a starting point.
          - For "checklist", data.items should be [{ id: "...", text: "...", done: false }].
          - For "summary", data.bullets should be a string array.`,
        },
        {
          role: 'user',
          content: `Generate a canvas map for: ${prompt}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'AI Generation failed');
  }

  const data = await response.json();
  const content = data.response || data.choices?.[0]?.message?.content || '{}';
  
  // Clean up potential markdown formatting
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  const jsonStr = jsonMatch ? jsonMatch[0] : content;
  
  try {
    return JSON.parse(jsonStr);
  } catch (e) {
    console.error('Failed to parse AI JSON:', jsonStr);
    throw new Error('AI returned invalid JSON structure');
  }
}

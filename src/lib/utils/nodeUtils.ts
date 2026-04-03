
/**
 * Extracts searchable text from a Tiptap JSON content object.
 */
export function extractTiptapText(content: unknown): string {
  if (!content) return '';
  if (typeof content === 'string') return content;
  
  const c = content as { text?: string; content?: unknown[] };
  if (c.text) return c.text;
  if (Array.isArray(c.content)) {
    return (c.content as unknown[]).map(extractTiptapText).join(' ');
  }
  return '';
}

/**
 * Extracts all human-readable text from a node's data object.
 * Used for AI context and global search indexing.
 */
export function extractNodeText(node: { data?: any }): string {
  const data = node.data;
  if (!data) return '';
  
  const parts: string[] = [];
  
  if (typeof data.title === 'string') parts.push(data.title);
  
  // Tiptap Content
  if (data.content) {
    parts.push(extractTiptapText(data.content));
  }
  
  // Simple Text/Sticky/Summary
  if (typeof data.text === 'string') parts.push(data.text);
  if (typeof data.description === 'string') parts.push(data.description);
  
  // Code
  if (typeof data.code === 'string') parts.push(data.code);
  
  // Checklist
  if (Array.isArray(data.items)) {
    parts.push((data.items as any[]).map((i) => (typeof i.text === 'string' ? i.text : '')).join(' '));
  }
  
  // Table / Spreadsheet
  if (Array.isArray(data.grid)) {
    parts.push((data.grid as any[]).map((row) => (Array.isArray(row) ? row.join(' ') : '')).join(' '));
  }
  
  // Flashcards
  if (Array.isArray(data.flashcards)) {
    parts.push((data.flashcards as any[]).map((f) => `${f.question || ''} ${f.answer || ''}`).join(' '));
  }
  
  return parts.join(' ').trim();
}

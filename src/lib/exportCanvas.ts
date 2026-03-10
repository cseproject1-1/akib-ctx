import type { Node } from '@xyflow/react';

function extractTiptapText(content: any, depth = 0): string {
  if (depth > 50) return '';
  if (!content) return '';
  if (typeof content === 'string') return content;
  if (content.text) return content.text;
  if (content.content && Array.isArray(content.content)) {
    return content.content.map((c: any) => extractTiptapText(c, depth + 1)).join('');
  }
  return '';
}

function nodeToMarkdown(node: Node): string {
  const d = node.data as any;
  const type = node.type || 'unknown';

  switch (type) {
    case 'aiNote': {
      const title = d.title || 'Untitled Note';
      const text = extractTiptapText(d.content);
      return `## ${title}\n\n${text || '_Empty note_'}\n`;
    }
    case 'lectureNotes': {
      const title = d.title || 'Lecture Notes';
      const text = extractTiptapText(d.content);
      return `## 📖 ${title}\n\n${text || '_Empty lecture notes_'}\n`;
    }
    case 'summary': {
      const title = d.title || 'Summary';
      const bullets = (d.bullets as string[]) || [];
      return `## 📋 ${title}\n\n${bullets.map((b: string) => `- ${b}`).join('\n')}\n`;
    }
    case 'termQuestion': {
      const year = d.year || '';
      const questions = (d.questions as string[]) || [];
      return `## ❓ Term Questions (${year})\n\n${questions.map((q: string, i: number) => `${i + 1}. ${q}`).join('\n')}\n`;
    }
    case 'flashcard': {
      const cards = (d.flashcards as { question: string; answer: string }[]) || [];
      const title = d.sourceTitle ? `Flashcards: ${d.sourceTitle}` : 'Flashcards';
      return `## 🎓 ${title}\n\n${cards.map((c, i) => `**Q${i + 1}:** ${c.question}\n**A:** ${c.answer}`).join('\n\n')}\n`;
    }
    case 'checklist': {
      const title = d.title || 'Checklist';
      const items = (d.items as { text: string; done: boolean }[]) || [];
      return `## ✅ ${title}\n\n${items.map((item) => `- [${item.done ? 'x' : ' '}] ${item.text}`).join('\n')}\n`;
    }
    case 'stickyNote': {
      const text = d.text || '';
      return `## 📝 Sticky Note\n\n${text}\n`;
    }
    case 'codeSnippet': {
      const title = d.title || 'Code Snippet';
      const code = d.code || '';
      const lang = d.language || '';
      return `## 💻 ${title}\n\n\`\`\`${lang}\n${code}\n\`\`\`\n`;
    }
    case 'math': {
      const title = d.title || 'Math';
      const latex = d.latex || '';
      return `## 🔢 ${title}\n\n$$${latex}$$\n`;
    }
    case 'table': {
      const title = d.title || 'Table';
      const headers = (d.headers as string[]) || [];
      const rows = (d.rows as { value: string }[][]) || [];
      const headerRow = `| ${headers.join(' | ')} |`;
      const separator = `| ${headers.map(() => '---').join(' | ')} |`;
      const dataRows = rows.map((row) => `| ${row.map((c) => c.value || '').join(' | ')} |`).join('\n');
      return `## 📊 ${title}\n\n${headerRow}\n${separator}\n${dataRows}\n`;
    }
    case 'pdf': {
      return `## 📄 PDF: ${d.fileName || 'Untitled'}\n\n_PDF file (${Math.round((d.fileSize || 0) / 1024)}KB)_\n`;
    }
    case 'image': {
      return `## 🖼️ Image${d.altText ? `: ${d.altText}` : ''}\n\n${d.storageUrl ? `![${d.altText || 'Image'}](${d.storageUrl})` : '_No image uploaded_'}\n`;
    }
    case 'embed': {
      return `## 🌐 Embed: ${d.title || d.url || 'Untitled'}\n\nURL: ${d.url || '_No URL_'}\n`;
    }
    case 'video': {
      return `## 🎬 Video: ${d.title || 'Untitled'}\n\nURL: ${d.url || '_No URL_'}\n`;
    }
    case 'group': {
      return `## 📁 Group: ${d.label || 'Untitled'}\n`;
    }
    default:
      return `## ${type}\n\n_Unknown node type_\n`;
  }
}

function nodeToPlainText(node: Node): string {
  const d = node.data as any;
  const type = node.type || 'unknown';

  switch (type) {
    case 'aiNote':
    case 'lectureNotes': {
      const title = d.title || 'Untitled';
      const text = extractTiptapText(d.content);
      return `${title}\n${'='.repeat(title.length)}\n${text || '(empty)'}\n`;
    }
    case 'summary': {
      const title = d.title || 'Summary';
      const bullets = (d.bullets as string[]) || [];
      return `${title}\n${'='.repeat(title.length)}\n${bullets.map((b: string) => `• ${b}`).join('\n')}\n`;
    }
    case 'termQuestion': {
      const year = d.year || '';
      const questions = (d.questions as string[]) || [];
      return `Term Questions (${year})\n${questions.map((q: string, i: number) => `${i + 1}. ${q}`).join('\n')}\n`;
    }
    case 'flashcard': {
      const cards = (d.flashcards as { question: string; answer: string }[]) || [];
      return `Flashcards\n${cards.map((c, i) => `Q${i + 1}: ${c.question}\nA: ${c.answer}`).join('\n\n')}\n`;
    }
    case 'checklist': {
      const title = d.title || 'Checklist';
      const items = (d.items as { text: string; done: boolean }[]) || [];
      return `${title}\n${items.map((item) => `[${item.done ? 'x' : ' '}] ${item.text}`).join('\n')}\n`;
    }
    case 'stickyNote': return `Sticky Note\n${d.text || '(empty)'}\n`;
    case 'codeSnippet': return `${d.title || 'Code'}\n${d.code || ''}\n`;
    case 'math': return `${d.title || 'Math'}\n${d.latex || ''}\n`;
    default: return `${d.title || d.label || type}\n`;
  }
}

function downloadFile(content: string, filename: string, mimeType: string) {
  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Failed to download file:', err);
    alert('Browser blocked the download. Please check your security settings.');
  }
}

function buildContent(nodes: Node[], workspaceName: string | undefined, formatter: (node: Node) => string, separator: string, headerFn: (name: string) => string) {
  const header = headerFn(workspaceName || 'Study Canvas');
  const body = nodes
    .filter((n) => n.type !== 'group')
    .map(formatter)
    .join(separator);
  const groups = nodes.filter((n) => n.type === 'group');
  const groupSection = groups.length > 0
    ? `${separator}${formatter === nodeToMarkdown ? '# Groups\n\n' : 'GROUPS\n======\n'}${groups.map(formatter).join('\n')}`
    : '';
  return header + body + groupSection;
}

export function exportToMarkdown(nodes: Node[], workspaceName?: string): void {
  const content = buildContent(
    nodes,
    workspaceName,
    nodeToMarkdown,
    '\n---\n\n',
    (name) => `# ${name}\n\n_Exported on ${new Date().toLocaleDateString()}_\n\n---\n\n`
  );
  const safeName = (workspaceName || 'canvas').replace(/\s+/g, '-').toLowerCase();
  downloadFile(content, `${safeName}.md`, 'text/markdown');
}

export function exportToPlainText(nodes: Node[], workspaceName?: string): void {
  const content = buildContent(
    nodes,
    workspaceName,
    nodeToPlainText,
    '\n' + '-'.repeat(40) + '\n\n',
    (name) => `${name}\nExported on ${new Date().toLocaleDateString()}\n${'='.repeat(40)}\n\n`
  );
  const safeName = (workspaceName || 'canvas').replace(/\s+/g, '-').toLowerCase();
  downloadFile(content, `${safeName}.txt`, 'text/plain');
}

export function exportToJSON(nodes: Node[], workspaceName?: string): void {
  const data = {
    workspace: workspaceName || 'Study Canvas',
    exportedAt: new Date().toISOString(),
    nodes: nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: n.data,
    })),
  };
  const safeName = (workspaceName || 'canvas').replace(/\s+/g, '-').toLowerCase();
  downloadFile(JSON.stringify(data, null, 2), `${safeName}.json`, 'application/json');
}

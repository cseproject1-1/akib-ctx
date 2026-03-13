import type { Node, Edge } from '@xyflow/react';
import JSZip from 'jszip';

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

function nodeToMarkdown(node: Node, includeMetadata = false): string {
  const d = node.data as any;
  const type = node.type || 'unknown';
  let markdown = '';

  if (includeMetadata) {
    const metadata = {
      id: node.id,
      type: node.type,
      position: node.position,
      title: d.title || d.label || '',
      tags: d.tags || [],
      color: d.color || '',
      createdAt: d.createdAt || '',
      dueDate: d.dueDate || '',
      emoji: d.emoji || '',
    };
    markdown += `---\n${JSON.stringify(metadata, null, 2)}\n---\n\n`;
  }

  switch (type) {
    case 'aiNote': {
      const title = d.title || 'Untitled Note';
      const text = extractTiptapText(d.content);
      markdown += `## ${title}\n\n${text || '_Empty note_'}\n`;
      break;
    }
    case 'lectureNotes': {
      const title = d.title || 'Lecture Notes';
      const text = extractTiptapText(d.content);
      markdown += `## 📖 ${title}\n\n${text || '_Empty lecture notes_'}\n`;
      break;
    }
    case 'summary': {
      const title = d.title || 'Summary';
      const bullets = (d.bullets as string[]) || [];
      markdown += `## 📋 ${title}\n\n${bullets.map((b: string) => `- ${b}`).join('\n')}\n`;
      break;
    }
    case 'termQuestion': {
      const year = d.year || '';
      const questions = (d.questions as string[]) || [];
      markdown += `## ❓ Term Questions (${year})\n\n${questions.map((q: string, i: number) => `${i + 1}. ${q}`).join('\n')}\n`;
      break;
    }
    case 'flashcard': {
      const cards = (d.flashcards as { question: string; answer: string }[]) || [];
      const title = d.sourceTitle ? `Flashcards: ${d.sourceTitle}` : 'Flashcards';
      markdown += `## 🎓 ${title}\n\n${cards.map((c, i) => `**Q${i + 1}:** ${c.question}\n**A:** ${c.answer}`).join('\n\n')}\n`;
      break;
    }
    case 'checklist': {
      const title = d.title || 'Checklist';
      const items = (d.items as { text: string; done: boolean }[]) || [];
      markdown += `## ✅ ${title}\n\n${items.map((item) => `- [${item.done ? 'x' : ' '}] ${item.text}`).join('\n')}\n`;
      break;
    }
    case 'stickyNote': {
      const text = d.text || '';
      markdown += `## 📝 Sticky Note\n\n${text}\n`;
      break;
    }
    case 'codeSnippet': {
      const title = d.title || 'Code Snippet';
      const code = d.code || '';
      const lang = d.language || '';
      markdown += `## 💻 ${title}\n\n\`\`\`${lang}\n${code}\n\`\`\`\n`;
      break;
    }
    case 'math': {
      const title = d.title || 'Math';
      const latex = d.latex || '';
      markdown += `## 🔢 ${title}\n\n$$${latex}$$\n`;
      break;
    }
    case 'table': {
      const title = d.title || 'Table';
      const headers = (d.headers as string[]) || [];
      const rows = (d.rows as { value: string }[][]) || [];
      const headerRow = `| ${headers.join(' | ')} |`;
      const separator = `| ${headers.map(() => '---').join(' | ')} |`;
      const dataRows = rows.map((row) => `| ${row.map((c) => c.value || '').join(' | ')} |`).join('\n');
      markdown += `## 📊 ${title}\n\n${headerRow}\n${separator}\n${dataRows}\n`;
      break;
    }
    case 'pdf': {
      markdown += `## 📄 PDF: ${d.fileName || 'Untitled'}\n\n_PDF file (${Math.round((d.fileSize || 0) / 1024)}KB)_\n`;
      break;
    }
    case 'image': {
      markdown += `## 🖼️ Image${d.altText ? `: ${d.altText}` : ''}\n\n${d.storageUrl ? `![${d.altText || 'Image'}](${d.storageUrl})` : '_No image uploaded_'}\n`;
      break;
    }
    case 'embed': {
      markdown += `## 🌐 Embed: ${d.title || d.url || 'Untitled'}\n\nURL: ${d.url || '_No URL_'}\n`;
      break;
    }
    case 'video': {
      markdown += `## 🎬 Video: ${d.title || 'Untitled'}\n\nURL: ${d.url || '_No URL_'}\n`;
      break;
    }
    case 'group': {
      markdown += `## 📁 Group: ${d.label || 'Untitled'}\n`;
      break;
    }
    default:
      markdown += `## ${type}\n\n_Unknown node type_\n`;
      break;
  }
  return markdown;
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

function downloadFile(content: string | Blob, filename: string, mimeType: string) {
  try {
    const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
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

function buildContent(nodes: Node[], workspaceName: string | undefined, formatter: (node: Node, includeMetadata?: boolean) => string, separator: string, headerFn: (name: string) => string, includeMetadata = false) {
  const header = headerFn(workspaceName || 'Study Canvas');
  const body = nodes
    .filter((n) => n.type !== 'group')
    .map(n => formatter(n, includeMetadata))
    .join(separator);
  const groups = nodes.filter((n) => n.type === 'group');
  const groupSection = groups.length > 0
    ? `${separator}${formatter === nodeToMarkdown ? '# Groups\n\n' : 'GROUPS\n======\n'}${groups.map(n => formatter(n, includeMetadata)).join('\n')}`
    : '';
  return header + body + groupSection;
}

export function exportToMarkdown(nodes: Node[], workspaceName?: string, includeMetadata = false): void {
  const content = buildContent(
    nodes,
    workspaceName,
    nodeToMarkdown,
    '\n---\n\n',
    (name) => `# ${name}\n\n_Exported on ${new Date().toLocaleDateString()}_\n\n---\n\n`,
    includeMetadata
  );
  const safeName = (workspaceName || 'canvas').replace(/\s+/g, '-').toLowerCase();
  downloadFile(content, `${safeName}.md`, 'text/markdown');
}

export async function exportToZip(nodes: Node[], edges: Edge[], workspaceName?: string): Promise<void> {
  const zip = new JSZip();
  // We no longer use a subfolder to keep the structure flat and easy to parse

  // Create manifest
  const manifest = {
    workspace: workspaceName || 'Study Canvas',
    exportedAt: new Date().toISOString(),
    nodes: nodes.map(n => ({
      id: n.id,
      type: n.type,
      position: n.position,
      data: {
        title: (n.data as any).title || (n.data as any).label || '',
        tags: (n.data as any).tags || [],
        color: (n.data as any).color || '',
        emoji: (n.data as any).emoji || ''
      }
    })),
    edges: edges.map(e => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: e.type,
      data: e.data
    }))
  };

  zip.file('manifest.json', JSON.stringify(manifest, null, 2));

  nodes.forEach((node) => {
    // Include metadata in individual files for zip export
    const markdown = nodeToMarkdown(node, true);
    const title = (node.data as any).title || (node.data as any).label || node.id;
    // Keep it simple at the root
    const fileName = `nodes/${title}_${node.id}.md`.replace(/[<>:"/\\|?*]/g, '_');
    zip.file(fileName, markdown);
  });

  const blob = await zip.generateAsync({ type: 'blob' });
  const safeName = (workspaceName || 'canvas').replace(/\s+/g, '-').toLowerCase();
  downloadFile(blob, `${safeName}.zip`, 'application/zip');
}

export async function importFromMarkdown(file: File): Promise<Node | null> {
  const text = await file.text();
  const frontmatterMatch = text.match(/^---\n([\s\S]*?)\n---\n/);
  let metadata: any = {};
  let body = text;

  if (frontmatterMatch) {
    try {
      metadata = JSON.parse(frontmatterMatch[1]);
      body = text.replace(frontmatterMatch[0], '').trim();
    } catch (e) {
      console.warn('Failed to parse metadata in markdown', e);
    }
  }

  const type = metadata.type || 'aiNote';
  const node: Node = {
    id: metadata.id || crypto.randomUUID(),
    type,
    position: metadata.position || { x: Math.random() * 400, y: Math.random() * 400 },
    data: {
      title: metadata.title || file.name.replace(/\.md$/, ''),
      tags: metadata.tags || [],
      color: metadata.color || '',
      createdAt: metadata.createdAt || new Date().toISOString(),
      dueDate: metadata.dueDate || '',
      emoji: metadata.emoji || '',
      // For rich text nodes, we'll needs to handle content.
      // If full metadata is present, we might have more.
      // For now, we'll store the body. NoteEditor can handle pasteContent/pasteFormat
      pasteContent: body,
      pasteFormat: 'markdown'
    },
  };

  // Type specific adjustments
  if (type === 'stickyNote') {
    node.data.text = body.replace(/^## .*\n\n/, '');
  } else if (type === 'codeSnippet') {
    const codeMatch = body.match(/```(\w+)?\n([\s\S]*?)```/);
    if (codeMatch) {
      node.data.language = codeMatch[1] || '';
      node.data.code = codeMatch[2];
    }
  }

  return node;
}

export async function importFromZip(file: File): Promise<{ nodes: Node[], edges: Edge[] }> {
  const zip = new JSZip();
  const content = await zip.loadAsync(file);
  
  // Try manifest first
  const manifestEntry = Object.values(content.files).find(f => f.name.endsWith('manifest.json'));
  if (manifestEntry) {
    try {
      const manifestText = await manifestEntry.async('text');
      const manifest = JSON.parse(manifestText);
      console.log('Import: Found manifest with', manifest.nodes?.length, 'nodes');
      if (manifest.nodes && Array.isArray(manifest.nodes)) {
        const reconstructedNodes: Node[] = [];
        for (const mNode of manifest.nodes) {
          // Robust matching: find file that contains the ID and is a markdown file, regardless of folder
          const nodeFile = Object.values(content.files).find(f => 
            f.name.toLowerCase().endsWith('.md') && 
            f.name.includes(mNode.id)
          );
          
          if (nodeFile) {
            const text = await nodeFile.async('text');
            const virtualFile = new File([text], nodeFile.name, { type: 'text/markdown' });
            const fullNode = await importFromMarkdown(virtualFile);
            if (fullNode) {
              reconstructedNodes.push({
                ...fullNode,
                position: mNode.position, // Prioritize manifest position
                type: mNode.type
              });
            }
          }
        }
        return { 
          nodes: reconstructedNodes, 
          edges: manifest.edges || [] 
        };
      }
    } catch (e) {
      console.warn('Failed to parse manifest in zip', e);
    }
  }

  // Fallback to legacy import (just scanning files)
  const nodes: Node[] = [];
  for (const [filename, zipEntry] of Object.entries(content.files)) {
    if (filename.endsWith('.md') && !zipEntry.dir) {
      const text = await zipEntry.async('text');
      const virtualFile = new File([text], filename, { type: 'text/markdown' });
      const node = await importFromMarkdown(virtualFile);
      if (node) nodes.push(node);
    }
  }

  return { nodes, edges: [] };
}

export function exportToPlainText(nodes: Node[], workspaceName?: string): void {
  const content = buildContent(
    nodes,
    workspaceName,
    (node) => nodeToPlainText(node),
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


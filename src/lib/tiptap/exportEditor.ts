import type { Editor } from '@tiptap/react';

/**
 * Convert TipTap editor content to Markdown string.
 */
export function editorToMarkdown(editor: Editor): string {
  // Use the editor's built-in markdown export if available
  try {
    const md = (editor.storage as any)?.markdown?.getMarkdown?.();
    if (md && typeof md === 'string' && md.trim().length > 0) return md;
  } catch { /* fallback */ }

  // Fallback: walk the JSON and convert manually
  const json = editor.getJSON();
  return jsonToMarkdown(json);
}

function jsonToMarkdown(node: any, depth = 0): string {
  if (!node) return '';

  if (node.type === 'doc') {
    return (node.content || []).map((c: any) => jsonToMarkdown(c, depth)).join('\n\n');
  }

  if (node.type === 'heading') {
    const level = node.attrs?.level || 1;
    const prefix = '#'.repeat(level);
    return `${prefix} ${inlineContent(node)}`;
  }

  if (node.type === 'paragraph') {
    return inlineContent(node);
  }

  if (node.type === 'bulletList') {
    return (node.content || []).map((li: any) => {
      const text = (li.content || []).map((c: any) => jsonToMarkdown(c, depth + 1)).join('\n');
      return `${'  '.repeat(depth)}- ${text}`;
    }).join('\n');
  }

  if (node.type === 'orderedList') {
    return (node.content || []).map((li: any, i: number) => {
      const text = (li.content || []).map((c: any) => jsonToMarkdown(c, depth + 1)).join('\n');
      return `${'  '.repeat(depth)}${i + 1}. ${text}`;
    }).join('\n');
  }

  if (node.type === 'taskList') {
    return (node.content || []).map((li: any) => {
      const checked = li.attrs?.checked ? 'x' : ' ';
      const text = (li.content || []).map((c: any) => jsonToMarkdown(c, depth + 1)).join('\n');
      return `- [${checked}] ${text}`;
    }).join('\n');
  }

  if (node.type === 'blockquote') {
    const inner = (node.content || []).map((c: any) => jsonToMarkdown(c, depth)).join('\n\n');
    return inner.split('\n').map((l: string) => `> ${l}`).join('\n');
  }

  if (node.type === 'codeBlock') {
    const lang = node.attrs?.language || '';
    const code = (node.content || []).map((c: any) => c.text || '').join('');
    return `\`\`\`${lang}\n${code}\n\`\`\``;
  }

  if (node.type === 'horizontalRule') {
    return '---';
  }

  if (node.type === 'image') {
    const alt = node.attrs?.alt || '';
    const src = node.attrs?.src || '';
    return `![${alt}](${src})`;
  }

  if (node.type === 'table') {
    const rows = (node.content || []).map((row: any) => {
      const cells = (row.content || []).map((cell: any) => {
        return (cell.content || []).map((c: any) => inlineContent(c)).join(' ');
      });
      return `| ${cells.join(' | ')} |`;
    });
    if (rows.length > 0) {
      const headerCells = ((node.content?.[0]?.content) || []).length;
      const sep = `| ${Array(headerCells).fill('---').join(' | ')} |`;
      return [rows[0], sep, ...rows.slice(1)].join('\n');
    }
    return rows.join('\n');
  }

  // listItem, taskItem
  if (node.type === 'listItem' || node.type === 'taskItem') {
    return (node.content || []).map((c: any) => jsonToMarkdown(c, depth)).join('\n');
  }

  // Fallback: try to get text
  if (node.text) return applyMarks(node);
  if (node.content) {
    return (node.content || []).map((c: any) => jsonToMarkdown(c, depth)).join('');
  }

  return '';
}

function inlineContent(node: any): string {
  if (!node.content) return '';
  return node.content.map((child: any) => {
    if (child.text) return applyMarks(child);
    if (child.type === 'hardBreak') return '\n';
    if (child.type === 'image') return `![${child.attrs?.alt || ''}](${child.attrs?.src || ''})`;
    return '';
  }).join('');
}

function applyMarks(node: any): string {
  let text = node.text || '';
  const marks = node.marks || [];
  for (const mark of marks) {
    switch (mark.type) {
      case 'bold': text = `**${text}**`; break;
      case 'italic': text = `*${text}*`; break;
      case 'strike': text = `~~${text}~~`; break;
      case 'code': text = `\`${text}\``; break;
      case 'link': text = `[${text}](${mark.attrs?.href || ''})`; break;
      case 'underline': text = `<u>${text}</u>`; break;
      case 'superscript': text = `<sup>${text}</sup>`; break;
      case 'subscript': text = `<sub>${text}</sub>`; break;
    }
  }
  return text;
}

/**
 * Download a string as a file.
 */
export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Copy text to clipboard using the Modern Clipboard API.
 */
export async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error('Failed to copy: ', err);
    return false;
  }
}

/**
 * Copy content as HTML to clipboard.
 */
export async function copyHtmlToClipboard(editor: Editor) {
  const html = editor.getHTML();
  try {
    const blob = new Blob([html], { type: 'text/html' });
    const textBlob = new Blob([editor.getText()], { type: 'text/plain' });
    const item = new ClipboardItem({
      'text/html': blob,
      'text/plain': textBlob,
    });
    await navigator.clipboard.write([item]);
    return true;
  } catch (err) {
    console.error('Failed to copy HTML: ', err);
    return false;
  }
}

/**
 * Copy content as Markdown to clipboard.
 */
export async function copyMarkdownToClipboard(editor: Editor) {
  const md = editorToMarkdown(editor);
  return copyToClipboard(md);
}

/**
 * Export editor content as a PDF using the browser's print-to-PDF.
 * Creates a clean printable view in a hidden iframe.
 */
export function editorToPdf(editor: Editor, title?: string) {
  const html = editor.getHTML();
  const printWindow = window.open('', '_blank', 'width=800,height=600');
  if (!printWindow) return;

  const styledHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title || 'Document'}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, sans-serif;
      font-size: 14px;
      line-height: 1.7;
      color: #1a1a1a;
      padding: 48px 56px;
      max-width: 800px;
      margin: 0 auto;
    }
    h1 { font-size: 28px; font-weight: 700; margin: 24px 0 12px; border-bottom: 2px solid #e5e5e5; padding-bottom: 8px; }
    h2 { font-size: 22px; font-weight: 600; margin: 20px 0 10px; }
    h3 { font-size: 18px; font-weight: 600; margin: 16px 0 8px; }
    p { margin: 8px 0; }
    ul, ol { margin: 8px 0; padding-left: 24px; }
    li { margin: 4px 0; }
    blockquote { border-left: 3px solid #d4d4d4; margin: 12px 0; padding: 8px 16px; color: #525252; background: #fafafa; }
    code { background: #f4f4f5; padding: 2px 6px; border-radius: 4px; font-size: 13px; font-family: 'SF Mono', monospace; }
    pre { background: #18181b; color: #e4e4e7; padding: 16px; border-radius: 8px; margin: 12px 0; overflow-x: auto; }
    pre code { background: none; padding: 0; color: inherit; }
    table { border-collapse: collapse; width: 100%; margin: 12px 0; }
    th, td { border: 1px solid #d4d4d4; padding: 8px 12px; text-align: left; }
    th { background: #f4f4f5; font-weight: 600; }
    img { max-width: 100%; height: auto; border-radius: 4px; margin: 8px 0; }
    hr { border: none; border-top: 1px solid #e5e5e5; margin: 24px 0; }
    mark { background: #fef08a; padding: 1px 4px; border-radius: 2px; }
    a { color: #2563eb; text-decoration: underline; }
    .title-header { text-align: center; margin-bottom: 32px; padding-bottom: 16px; border-bottom: 2px solid #1a1a1a; }
    .title-header h1 { border: none; margin: 0; font-size: 32px; }
    .title-header .date { color: #737373; font-size: 12px; margin-top: 4px; }
    @media print {
      body { padding: 24px; }
      @page { margin: 1.5cm; }
    }
  </style>
</head>
<body>
  <div class="title-header">
    <h1>${title || 'Document'}</h1>
    <div class="date">Exported on ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
  </div>
  ${html}
  <script>
    setTimeout(() => { window.print(); }, 300);
  </script>
</body>
</html>`;

  printWindow.document.write(styledHtml);
  printWindow.document.close();
}

import { Node } from '@xyflow/react';
import { 
  CanvasNodeData, 
  TextNodeData, 
  StickyNoteNodeData, 
  AINoteNodeData, 
  LectureNotesNodeData, 
  SummaryNodeData,
  ImageNodeData,
  VideoNodeData,
  FileAttachmentNodeData,
  ChecklistNodeData,
  CodeSnippetNodeData,
  TableNodeData,
  BookmarkNodeData,
  CalendarNodeData,
  KanbanNodeData
} from '@/types/canvas';

/**
 * Convert Tiptap JSON content to HTML
 */
function convertTiptapToHtml(content: unknown): string {
  if (!content) return '';
  
  // If content is already a string, return it
  if (typeof content === 'string') return content;
  
  // Handle Tiptap JSON format
  if (typeof content === 'object' && content !== null && 'type' in content && 'content' in content) {
    const docContent = (content as { content: unknown[] }).content;
    if (docContent && Array.isArray(docContent)) {
      return docContent.map((node) => convertNodeToHtml(node)).join('');
    }
  }
  
  // If it's a node array
  if (Array.isArray(content)) {
    return content.map((node) => convertNodeToHtml(node)).join('');
  }
  
  return '';
}

function convertNodeToHtml(node: unknown): string {
  if (!node || typeof node !== 'object') return '';
  
  const nodeObj = node as Record<string, unknown>;
  const type = nodeObj.type;
  const content = nodeObj.content;
  const text = (nodeObj.text as string) || '';
  
  // Handle different node types
  switch (type) {
    case 'paragraph': {
      const contentArray = Array.isArray(content) ? content : [];
      return `<p>${contentArray.length > 0 ? contentArray.map((n) => convertNodeToHtml(n)).join('') : text}</p>`;
    }
    
    case 'heading': {
      const level = (nodeObj.attrs as Record<string, unknown>)?.level as number || 1;
      const contentArray = Array.isArray(content) ? content : [];
      return `<h${level}>${contentArray.length > 0 ? contentArray.map((n) => convertNodeToHtml(n)).join('') : text}</h${level}>`;
    }
    
    case 'bulletList': {
      const contentArray = Array.isArray(content) ? content : [];
      return `<ul>${contentArray.map((n) => convertNodeToHtml(n)).join('')}</ul>`;
    }
    
    case 'orderedList': {
      const contentArray = Array.isArray(content) ? content : [];
      return `<ol>${contentArray.map((n) => convertNodeToHtml(n)).join('')}</ol>`;
    }
    
    case 'listItem': {
      const contentArray = Array.isArray(content) ? content : [];
      return `<li>${contentArray.length > 0 ? contentArray.map((n) => convertNodeToHtml(n)).join('') : text}</li>`;
    }
    
    case 'blockquote': {
      const contentArray = Array.isArray(content) ? content : [];
      return `<blockquote>${contentArray.length > 0 ? contentArray.map((n) => convertNodeToHtml(n)).join('') : text}</blockquote>`;
    }
    
    case 'codeBlock':
      return `<pre><code>${text}</code></pre>`;
    
    case 'hardBreak':
      return '<br />';
    
    case 'horizontalRule':
      return '<hr />';
    
    case 'text': {
      let result = text;
      const marks = nodeObj.marks as Array<Record<string, unknown>> | undefined;
      if (marks) {
        marks.forEach((mark) => {
          const markType = mark.type as string;
          if (markType === 'bold') result = `<strong>${result}</strong>`;
          if (markType === 'italic') result = `<em>${result}</em>`;
          if (markType === 'underline') result = `<u>${result}</u>`;
          if (markType === 'strike') result = `<s>${result}</s>`;
          if (markType === 'code') result = `<code>${result}</code>`;
          if (markType === 'link') {
            const attrs = mark.attrs as Record<string, string> | undefined;
            const href = attrs?.href || '';
            result = `<a href="${href}">${result}</a>`;
          }
        });
      }
      return result;
    }
    
    default:
      return text;
  }
}

/**
 * Extract HTML content from a node based on its type
 */
export function extractNodeContent(node: Node): string {
  const data = node.data as CanvasNodeData;
  const nodeType = node.type;
  
  try {
    switch (nodeType) {
      case 'text': {
        const textData = data as TextNodeData;
        return `<p>${textData.text || ''}</p>`;
      }
        
      case 'stickyNote': {
        const stickyData = data as StickyNoteNodeData;
        return `<p>${stickyData.text || ''}</p>`;
      }
        
      case 'aiNote': {
        const aiData = data as AINoteNodeData;
        if (aiData.content) {
          // If content is already HTML/Tiptap format
          if (typeof aiData.content === 'string') {
            return aiData.content;
          }
          // If content is an object (Tiptap JSON), convert to HTML using tiptap utilities
          return convertTiptapToHtml(aiData.content);
        }
        return aiData.pasteContent || '';
      }
        
      case 'lectureNotes': {
        const lectureData = data as LectureNotesNodeData;
        if (lectureData.content) {
          if (typeof lectureData.content === 'string') {
            return lectureData.content;
          }
          return convertTiptapToHtml(lectureData.content);
        }
        return '';
      }
        
      case 'summary': {
        const summaryData = data as SummaryNodeData;
        return `<h3>${summaryData.title}</h3><ul>${summaryData.bullets.map(b => `<li>${b}</li>`).join('')}</ul>`;
      }
        
      case 'image': {
        const imageData = data as ImageNodeData;
        return `<img src="${imageData.storageUrl || ''}" alt="${imageData.altText || 'Image'}" />`;
      }
        
      case 'video': {
        const videoData = data as VideoNodeData;
        return videoData.url ? `<a href="${videoData.url}">${videoData.title || 'Video'}</a>` : '';
      }
        
      case 'fileAttachment': {
        const fileData = data as FileAttachmentNodeData;
        if (fileData.files && fileData.files.length > 0) {
          return `<ul>${fileData.files.map((f) => `<li><a href="${f.url}">${f.name}</a></li>`).join('')}</ul>`;
        }
        return '';
      }
        
      case 'checklist': {
        const checklistData = data as ChecklistNodeData;
        return `<h3>${checklistData.title || 'Checklist'}</h3><ul>${checklistData.items?.map((item) => `<li>${item.done ? '✓' : '○'} ${item.text}</li>`).join('') || ''}</ul>`;
      }
        
      case 'codeSnippet': {
        const codeData = data as CodeSnippetNodeData;
        return `<pre><code>${codeData.code || ''}</code></pre>`;
      }
        
      case 'table': {
        const tableData = data as TableNodeData;
        if (tableData.headers && tableData.rows) {
          let html = '<table><thead><tr>';
          tableData.headers.forEach((h: string) => html += `<th>${h}</th>`);
          html += '</tr></thead><tbody>';
          tableData.rows.forEach((row) => {
            html += '<tr>';
            row.forEach((cell) => html += `<td>${cell.value || ''}</td>`);
            html += '</tr>';
          });
          html += '</tbody></table>';
          return html;
        }
        return '';
      }
        
      case 'bookmark': {
        const bookmarkData = data as BookmarkNodeData;
        return bookmarkData.url ? `<a href="${bookmarkData.url}">${bookmarkData.ogTitle || bookmarkData.url}</a>` : '';
      }
        
      case 'calendar': {
        const calendarData = data as CalendarNodeData;
        return `<h3>${calendarData.title || 'Calendar'}</h3><ul>${calendarData.events?.map((e) => `<li>${e.date}: ${e.label}</li>`).join('') || ''}</ul>`;
      }
        
      case 'kanban': {
        const kanbanData = data as KanbanNodeData;
        return `<h3>${kanbanData.title || 'Kanban'}</h3>`;
      }
        
      default:
        // For unknown node types, try to extract text from data
        return JSON.stringify(data);
    }
  } catch (error) {
    console.error('Error extracting node content:', error);
    return '';
  }
}
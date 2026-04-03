/* eslint-disable @typescript-eslint/no-explicit-any */
import type { JSONContent } from '@tiptap/react';

/**
 * Fast ID generator to replace fastId() for bulk migrations
 */
const fastId = () => typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 11) + Date.now().toString(36);

/**
 * Detects the editor version of the content.
 * @param content - The content to check (either Tiptap JSON or BlockNote array).
 * @returns 1 for Tiptap, 2 for BlockNote.
 */
export function getEditorVersion(content: any): 1 | 2 {
  if (!content) return 1;
  if (Array.isArray(content) && content.length > 0 && content[0]?.id && content[0]?.type) {
    return 2;
  }
  if (content?.type === 'doc' || content?.version === 1) {
    return 1;
  }
  return 1;
}

/**
 * Converts Tiptap (ProseMirror) JSON content to BlockNote blocks.
 * @param tiptapJSON - The Tiptap JSON content.
 * @returns An array of BlockNote blocks.
 */
export function migrateToBlockNote(tiptapJSON: JSONContent | null): any[] {
  if (!tiptapJSON || !tiptapJSON.content) return [createEmptyParagraph()];

  try {
    const blocks: any[] = [];

    tiptapJSON.content.forEach((node) => {
      const block = convertTiptapNodeToBlockNote(node);
      if (block) {
        if (Array.isArray(block)) {
          blocks.push(...block);
        } else {
          blocks.push(block);
        }
      }
    });

    return blocks.length > 0 ? blocks : [createEmptyParagraph()];
  } catch (error) {
    console.error('[Migration] Failed to migrate to BlockNote:', error);
    return [{
      id: fastId(),
      type: 'paragraph',
      content: [{ type: 'text', text: 'Error migrating content. Please check console.', styles: { textColor: 'red' } }],
      props: { _backup: JSON.stringify(tiptapJSON) }
    }];
  }
}

/**
 * Converts BlockNote blocks to Tiptap-friendly JSON content.
 * @param blocks - The array of BlockNote blocks.
 * @returns Tiptap JSON content.
 */
export function migrateToTiPTap(blocks: any[]): JSONContent {
  if (!blocks || !Array.isArray(blocks)) return { type: 'doc', content: [] };

  try {
    const rawNodes: JSONContent[] = [];

    blocks.forEach((block) => {
      const node = convertBlockNoteToTiptapNode(block);
      if (node) {
        if (Array.isArray(node)) {
          rawNodes.push(...node);
        } else {
          rawNodes.push(node);
        }
      }
    });

    // Post-process to wrap consecutive listItems into bulletList/orderedList
    const content: JSONContent[] = [];
    let currentList: { type: 'bulletList' | 'orderedList' | 'taskList'; content: JSONContent[] } | null = null;

    rawNodes.forEach((node) => {
      // Determine if this is a list item and what type of list it belongs to
      // We look at the original block type if we had it, but here we only have Tiptap nodes.
      // So we'll check for 'listItem' and try to guess or use a default.
      // However, convertBlockNoteToTiptapNode returns { type: 'listItem' } for both.
      // Better: Update convertBlockNoteToTiptapNode to return temporary types like 'bulletListItem'
      // and then wrap them here.
      
      if (node.type === 'listItem' || node.type === 'bulletListItem' || node.type === 'numberedListItem' || node.type === 'taskItem') {
        let listType: 'bulletList' | 'orderedList' | 'taskList';
        if (node.type === 'numberedListItem') {
          listType = 'orderedList';
        } else if (node.type === 'taskItem') {
          listType = 'taskList';
        } else {
          listType = 'bulletList';
        }
        
        const cleanNode = node.type === 'taskItem' ? node : { ...node, type: 'listItem' };
        
        if (currentList && currentList.type === listType) {
          currentList.content.push(cleanNode);
        } else {
          currentList = { type: listType, content: [cleanNode] };
          content.push(currentList as JSONContent);
        }
      } else {
        currentList = null;
        content.push(node);
      }
    });

    if (content.length === 0) {
      return {
        type: 'doc',
        content: [{ type: 'paragraph' }]
      };
    }

    return { type: 'doc', content };
  } catch (error) {
    console.error('[Migration] Failed to migrate to Tiptap:', error);
    return {
      type: 'doc',
      content: [{ 
        type: 'paragraph', 
        content: [{ type: 'text', text: 'Error migrating content. Please check console.' }],
        attrs: { _backup: JSON.stringify(blocks) }
      }]
    };
  }
}

/* ──────────────── Tiptap → BlockNote Converters ──────────────── */

function convertTiptapNodeToBlockNote(node: JSONContent): any | any[] | null {
  const id = fastId();

  switch (node.type) {
    case 'heading': {
      const level = Math.min(Math.max(node.attrs?.level || 1, 1), 6);
      return {
        id,
        type: 'heading',
        props: {
          level,
          textColor: 'default',
          backgroundColor: 'default',
          textAlignment: node.attrs?.textAlign || 'left'
        },
        content: convertTiptapContentToInline(node.content),
        children: []
      };
    }
    case 'paragraph': {
      return {
        id,
        type: 'paragraph',
        props: {
          textColor: 'default',
          backgroundColor: 'default',
          textAlignment: node.attrs?.textAlign || 'left'
        },
        content: convertTiptapContentToInline(node.content),
        children: []
      };
    }
    case 'bulletList':
    case 'orderedList': {
      const type = node.type === 'bulletList' ? 'bulletListItem' : 'numberedListItem';
      return (node.content || []).map((item) => convertTiptapListItemToBlockNote(item, type));
    }
    case 'listItem': {
      return convertTiptapListItemToBlockNote(node, 'bulletListItem');
    }
    case 'taskList': {
      return (node.content || []).map((item) => ({
        id: fastId(),
        type: 'checkListItem',
        props: {
          textColor: 'default',
          backgroundColor: 'default',
          textAlignment: 'left',
          checked: !!item.attrs?.checked
        },
        content: convertTiptapContentToInline(item.content?.[0]?.content),
        children: item.content?.slice(1).map(convertTiptapNodeToBlockNote).flat().filter(Boolean) || []
      })) || [];
    }
    case 'blockquote': {
      return convertTiptapBlockquoteToBlockNote(node);
    }
    case 'codeBlock': {
      // M30 fix: avoid double newlines by being smarter about the join
      const codeText = node.content?.map((c: any) => c.text || '').join('') || '';
      return {
        id,
        type: 'codeBlock',
        props: {
          language: node.attrs?.language || 'plaintext'
        },
        content: [{ type: 'text', text: codeText, styles: {} }],
        children: []
      };
    }
    case 'math':
    case 'mathBlock':
    case 'inlineMath': {
      // M23 fix: map math blocks to plain paragraphs or code blocks if not supported
      const formula = node.attrs?.formula || node.content?.[0]?.text || '';
      const isBlock = node.type === 'mathBlock';
      return {
        id,
        type: 'paragraph',
        props: { textColor: 'default', backgroundColor: 'default', textAlignment: 'left' },
        content: [
          { type: 'text', text: isBlock ? `$$${formula}$$` : `$${formula}$`, styles: { code: true } }
        ],
        children: []
      };
    }

    case 'horizontalRule': {
      // NOTE: 'divider' is not a registered block type in BlockNote's default schema.
      // Map to a paragraph with a visual separator to prevent isInGroup TypeError.
      return {
        id,
        type: 'paragraph',
        props: { textColor: 'default', backgroundColor: 'default', textAlignment: 'left' },
        content: [{ type: 'text', text: '─────────────────────────────────────', styles: {} }],
        children: []
      };
    }
    case 'image': {
      return {
        id,
        type: 'image',
        props: {
          url: node.attrs?.src || '',
          caption: node.attrs?.alt || node.attrs?.title || '',
          name: node.attrs?.alt || node.attrs?.title || 'image',
          showPreview: true,
          previewWidth: 512
        },
        content: undefined,
        children: []
      };
    }
    case 'video':
    case 'audio': {
      // NOTE: 'video' and 'audio' are not registered in BlockNote's default schema.
      // Map to a paragraph with link so content is preserved and visible.
      const mediaUrl = node.attrs?.src || node.attrs?.href || '';
      const mediaName = node.attrs?.title || node.type;
      return {
        id,
        type: 'paragraph',
        props: { textColor: 'default', backgroundColor: 'default', textAlignment: 'left' },
        content: mediaUrl
          ? [{ type: 'text', text: `[${node.type === 'video' ? '🎬' : '🎵'} ${mediaName}]`, styles: { link: mediaUrl } }]
          : [{ type: 'text', text: `[${node.type === 'video' ? '🎬' : '🎵'} ${mediaName}]`, styles: {} }],
        children: []
      };
    }
    case 'table': {
      return convertTiptapTableToBlockNote(node);
    }
    case 'calloutBlock': {
      return convertTiptapCalloutToBlockNote(node);
    }
    case 'details': {
      return convertTiptapToggleToBlockNote(node);
    }
    case 'columns': {
      return convertTiptapColumnsToBlockNote(node);
    }
    case 'mermaidBlock': {
      return {
        id,
        type: 'codeBlock',
        props: {
          language: 'mermaid'
        },
        content: [{ type: 'text', text: node.content?.[0]?.text || node.attrs?.source || '', styles: {} }],
        children: []
      };
    }
    case 'wiki-link': {
      return {
        id,
        type: 'paragraph',
        props: {
          textColor: 'default',
          backgroundColor: 'default',
          textAlignment: 'left'
        },
        content: [{
          type: 'text',
          text: `[[${node.attrs?.label || node.attrs?.title || ''}]]`,
          styles: { link: node.attrs?.href || '' }
        }],
        children: []
      };
    }
    default:
      return convertUnknownNodeToBlockNote(node, id);
  }
}

function convertTiptapBlockquoteToBlockNote(node: JSONContent): any {
  const id = fastId();
  const innerContent = node.content?.[0]?.content || node.content || [];

  return {
    id,
    type: 'quote',
    props: {
      textColor: 'default',
      backgroundColor: 'default',
      textAlignment: 'left'
    },
    content: convertTiptapContentToInline(innerContent),
    children: []
  };
}

function convertTiptapCalloutToBlockNote(node: JSONContent): any {
  const emoji = node.attrs?.emoji || '💡';
  const id = fastId();
  
  // M5 fix: Map back to a paragraph with styled emoji prefix since BlockNote 
  // might not have a native callout block type registered yet.
  return {
    id,
    type: 'paragraph',
    props: {
      textColor: 'default',
      backgroundColor: 'default',
      textAlignment: 'left'
    },
    content: [
      { type: 'text', text: emoji + ' ', styles: { bold: true } },
      ...convertTiptapContentToInline(node.content || node.content?.[0]?.content)
    ],
    children: []
  };
}

function convertTiptapToggleToBlockNote(node: JSONContent): any {
  const id = fastId();
  const summary = node.content?.[0]?.content?.[0]?.text || '';
  const detailContent = node.content?.slice(1) || [];

  return {
    id,
    type: 'paragraph',
    props: {
      textColor: 'default',
      backgroundColor: 'default',
      textAlignment: 'left'
    },
    content: [
      { type: 'text', text: `▶ ${summary}`, styles: { bold: true } },
    ],
    children: detailContent.map(convertTiptapNodeToBlockNote).flat().filter(Boolean)
  };
}

function convertTiptapColumnsToBlockNote(node: JSONContent): any[] {
  const columns = node.content || [];
  const blocks: any[] = [];

  columns.forEach((column: JSONContent) => {
    const columnContent = column.content || [];
    columnContent.forEach((colNode: JSONContent) => {
      const converted = convertTiptapNodeToBlockNote(colNode);
      if (converted) {
        if (Array.isArray(converted)) {
          blocks.push(...converted);
        } else {
          blocks.push(converted);
        }
      }
    });
  });

  return blocks.length > 0 ? blocks : [createEmptyParagraph()];
}

function convertUnknownNodeToBlockNote(node: JSONContent, id: string): any {
  const extractedText = extractTextFromNode(node);
  if (extractedText) {
    return {
      id,
      type: 'paragraph',
      props: {
        textColor: 'default',
        backgroundColor: 'default',
        textAlignment: 'left'
      },
      content: [{ type: 'text', text: extractedText, styles: {} }],
      children: []
    };
  }
  return null;
}

function extractTextFromNode(node: JSONContent): string {
  if (node.text) return node.text;
  if (node.content && Array.isArray(node.content)) {
    return node.content.map(extractTextFromNode).filter(Boolean).join(' ');
  }
  return '';
}

function convertTiptapListItemToBlockNote(item: JSONContent, type: string): any {
  const id = fastId();
  const paragraph = item.content?.find((c: JSONContent) => c.type === 'paragraph');
  const nestedContent = item.content?.filter((c: JSONContent) => c.type !== 'paragraph') || [];

  return {
    id,
    type,
    props: {
      textColor: 'default',
      backgroundColor: 'default',
      textAlignment: 'left'
    },
    content: convertTiptapContentToInline(paragraph?.content),
    children: nestedContent.map(convertTiptapNodeToBlockNote).flat().filter(Boolean)
  };
}

function convertTiptapTableToBlockNote(tableNode: JSONContent): any[] {
  const rows = tableNode.content || [];
  if (rows.length === 0) return [];

  const tableId = fastId();
  const columnCount = rows[0]?.content?.length || 1;

  // BlockNote table structure:
  //   table
  //     tableRow
  //       tableCell | tableHead
  // Each row becomes a tableRow child of the table.
  // Each cell becomes a tableCell/tableHead child of the tableRow.
  const tableRowChildren: any[] = rows.map((row: JSONContent) => {
    const cells = row.content || [];
    const cellChildren: any[] = cells.map((cell: JSONContent) => {
      const isHeader = cell.type === 'tableHeader';
      const cellContent = cell.content || [];
      return {
        id: fastId(),
        type: isHeader ? 'tableHead' : 'tableCell',
        props: {
          backgroundColor: cell.attrs?.backgroundColor || 'default',
          colspan: cell.attrs?.colspan || 1,
          rowspan: cell.attrs?.rowspan || 1,
        },
        // Cell inline content (text runs)
        content: cellContent.flatMap((c: any) => convertTiptapContentToInline(c.content)),
        children: [],
      };
    });

    return {
      id: fastId(),
      type: 'tableRow',
      props: {},
      content: [],
      children: cellChildren,
    };
  });

  // Validate that we have at least one valid row with cells
  if (tableRowChildren.length === 0) return [];

  return [{
    id: tableId,
    type: 'table',
    props: {
      columnWidths: Array(columnCount).fill(undefined),
      columnCount,
      backgroundColor: 'default',
    },
    content: [],
    children: tableRowChildren,
  }];
}

function convertTiptapContentToInline(content?: JSONContent[]): any[] {
  if (!content) return [];

  const inlineContent: any[] = [];

  content.forEach(item => {
    if (!item) return;

    if (item.type === 'text') {
      const styles = convertTiptapMarksToStyles(item.marks);
      const text = item.text || '';

      if (text.includes('\n')) {
        const parts = text.split('\n');
        parts.forEach((part: string, i: number) => {
          if (part) {
            inlineContent.push({
              type: 'text',
              text: part,
              styles
            });
          }
          if (i < parts.length - 1) {
            inlineContent.push({ type: 'text', text: '\n', styles: {} });
          }
        });
      } else {
        inlineContent.push({
          type: 'text',
          text,
          styles
        });
      }
    } else if (item.type === 'hardBreak') {
      inlineContent.push({ type: 'text', text: '\n', styles: {} });
    } else if (item.type === 'link') {
      const linkText = item.content?.map((c: any) => c.text || '').join('') || item.attrs?.href || '';
      inlineContent.push({
        type: 'text',
        text: linkText,
        styles: { link: item.attrs?.href || '' }
      });
    } else if (item.type === 'mention') {
      inlineContent.push({
        type: 'text',
        text: `@${item.attrs?.label || item.attrs?.id || 'user'}`,
        styles: { bold: true }
      });
    } else if (item.type === 'wiki-link') {
      inlineContent.push({
        type: 'text',
        text: `[[${item.attrs?.label || item.attrs?.title || ''}]]`,
        styles: { link: item.attrs?.href || '' }
      });
    } else if (item.type === 'image' || item.type === 'imageInline') {
      inlineContent.push({
        type: 'text',
        text: `[${item.attrs?.alt || 'image'}](${item.attrs?.src || ''})`,
        styles: {}
      });
    } else if (item.marks && item.marks.length > 0) {
      const linkMark = item.marks.find((m: any) => m.type === 'link');
      if (linkMark) {
        inlineContent.push({
          type: 'text',
          text: item.text || '',
          styles: { ...convertTiptapMarksToStyles(item.marks), link: linkMark.attrs?.href }
        });
      } else {
        inlineContent.push({
          type: 'text',
          text: item.text || '',
          styles: convertTiptapMarksToStyles(item.marks)
        });
      }
    } else if (item.content && Array.isArray(item.content)) {
      inlineContent.push(...convertTiptapContentToInline(item.content));
    }
  });

  return inlineContent;
}

function convertTiptapMarksToStyles(marks?: any[]): Record<string, any> {
  const styles: Record<string, any> = {};
  if (!marks) return styles;

  marks.forEach(mark => {
    switch (mark.type) {
      case 'bold': styles.bold = true; break;
      case 'italic': styles.italic = true; break;
      case 'underline': styles.underline = true; break;
      case 'strike': styles.strike = true; break;
      case 'code': styles.code = true; break;
      case 'highlight':
        styles.backgroundColor = mark.attrs?.color || '#FFFF00';
        break;
      case 'link':
        styles.link = mark.attrs?.href;
        break;
      case 'textStyle':
        if (mark.attrs?.color) styles.textColor = mark.attrs.color;
        break;
    }
  });

  return styles;
}

/* ──────────────── BlockNote → Tiptap Converters ──────────────── */

/** Safely parse a value that may be a JSON-stringified array (from old sanitizeForFirestore) */
function safeArray(val: any): any[] {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  }
  return [];
}

function convertBlockNoteToTiptapNode(block: any): JSONContent | JSONContent[] | null {
  if (!block || !block.type) return null;

  switch (block.type) {
    case 'paragraph':
      return convertBlockNoteParagraphToTiptap(block);
    case 'heading': {
      const level = Math.min(Math.max(block.props?.level || 1, 1), 6);
      return {
        type: 'heading',
        attrs: { level, textAlign: block.props?.textAlignment || 'left' },
        content: convertBlockNoteInlineToTiptap(block.content)
      };
    }
    case 'bulletListItem':
    case 'numberedListItem': {
      const innerContent = convertBlockNoteInlineToTiptap(block.content);
      const nestedChildren = safeArray(block.children).map(convertBlockNoteToTiptapNode).flat().filter(Boolean) as JSONContent[];

      // Grouping happens in migrateToTiPTap, but we tag them here
      return {
        type: block.type as any, // bulletListItem or numberedListItem
        content: [
          { type: 'paragraph', content: innerContent.length > 0 ? innerContent : undefined },
          ...(nestedChildren.length > 0 ? wrapNestedChildrenInList(nestedChildren) : [])
        ]
      };
    }
    case 'checkListItem':
      return {
        type: 'taskItem',
        attrs: { checked: !!block.props?.checked },
        content: [
          { type: 'paragraph', content: convertBlockNoteInlineToTiptap(block.content) },
          ...safeArray(block.children).map(convertBlockNoteToTiptapNode).flat().filter(Boolean)
        ]
      };
    case 'codeBlock': {
      const language = block.props?.language || 'plaintext';
      // M30: avoid adding extra \n since BlockNote content is already single-string
      const code = block.content?.[0]?.text || '';
      return {
        type: 'codeBlock',
        attrs: { language },
        content: [{ type: 'text', text: code }]
      };
    }

    case 'quote': {
      const innerContent = convertBlockNoteInlineToTiptap(block.content);
      return {
        type: 'blockquote',
        content: [{
          type: 'paragraph',
          // Ensure content is always an array or undefined (never null) for TipTap
          content: innerContent.length > 0 ? innerContent : undefined
        }]
      };
    }
    case 'divider':
    case 'horizontalRule': {
      // BlockNote content that was stored as 'divider' maps back to TipTap horizontalRule
      return {
        type: 'horizontalRule'
      };
    }
    case 'image': {
      return convertBlockNoteImageToTiptap(block);
    }
    case 'video':
    case 'audio': {
      return convertBlockNoteMediaToTiptap(block);
    }
    case 'file': {
      return convertBlockNoteFileToTiptap(block);
    }
    case 'table': {
      return convertBlockNoteTableToTiptap(block);
    }
    case 'tableHead':
    case 'tableCell': {
      return {
        type: block.type === 'tableHead' ? 'tableHeader' : 'tableCell',
        attrs: {
          backgroundColor: block.props?.backgroundColor || null,
          colspan: block.props?.colspan || 1,
          rowspan: block.props?.rowspan || 1
        },
        content: [{
          type: 'paragraph',
          content: convertBlockNoteInlineToTiptap(block.content)
        }]
      };
    }
    case 'toggleListItem': {
      return convertBlockNoteToggleToTiptap(block);
    }
    default:
      return convertUnknownBlockNoteToTiptap(block);
  }
}

function convertBlockNoteParagraphToTiptap(block: any): JSONContent {
  const innerContent = convertBlockNoteInlineToTiptap(block.content);
  return {
    type: 'paragraph',
    attrs: { textAlign: block.props?.textAlignment || 'left' },
    content: innerContent.length > 0 ? innerContent : undefined
  };
}

function convertBlockNoteImageToTiptap(block: any): JSONContent {
  const src = block.props?.url || block.props?.src || '';
  const alt = block.props?.caption || block.props?.name || '';
  const title = block.props?.caption || block.props?.name || '';

  return {
    type: 'image',
    attrs: {
      src,
      alt,
      title,
      width: block.props?.previewWidth || null,
      height: null
    }
  };
}

function convertBlockNoteMediaToTiptap(block: any): JSONContent {
  const src = block.props?.url || block.props?.src || '';
  const title = block.props?.name || block.type;
  
  // M4 fix: use correct block type names for Tiptap
  const type = block.type === 'video' ? 'videoBlock' : (block.type === 'audio' ? 'audioBlock' : block.type);

  return {
    type,
    attrs: {
      src,
      title,
      controls: true,
      autoplay: false,
      loop: false
    }
  };
}

function convertBlockNoteFileToTiptap(block: any): JSONContent {
  const href = block.props?.url || block.props?.href || '';
  const name = block.props?.name || 'file';

  return {
    type: 'paragraph',
    content: [{
      type: 'text',
      text: `📎 ${name}`,
      marks: [{ type: 'link', attrs: { href } }]
    }]
  };
}

function convertBlockNoteToggleToTiptap(block: any): JSONContent {
  const summary = block.content?.[0]?.text || block.props?.summary || '';
  const detailContent = safeArray(block.children).map(convertBlockNoteToTiptapNode).flat().filter(Boolean) as JSONContent[];

  // M1 fix: follow details -> detailsSummary -> detailsContent structure
  return {
    type: 'details',
    attrs: { open: block.props?.open !== false },
    content: [
      { type: 'detailsSummary', content: [{ type: 'text', text: summary }] },
      { 
        type: 'detailsContent', 
        content: detailContent.length > 0 ? detailContent : [{ type: 'paragraph' }] 
      }
    ]
  };
}

function convertUnknownBlockNoteToTiptap(block: any): JSONContent | null {
  const extractedText = extractTextFromBlockNote(block);
  if (extractedText) {
    return {
      type: 'paragraph',
      content: [{ type: 'text', text: extractedText }]
    };
  }
  return null;
}

function extractTextFromBlockNote(block: any): string {
  if (block.content && Array.isArray(block.content)) {
    return block.content
      .filter((c: any) => c.type === 'text')
      .map((c: any) => c.text || '')
      .join('');
  }
  const childArr = safeArray(block.children);
  if (childArr.length > 0) {
    return childArr.map(extractTextFromBlockNote).filter(Boolean).join(' ');
  }
  return '';
}

function convertBlockNoteTableToTiptap(tableBlock: any): JSONContent {
  const children = safeArray(tableBlock.children);
  if (children.length === 0) {
    return {
      type: 'table',
      attrs: { rowsCount: 0, withHeaderRow: false },
      content: []
    };
  }

  const columnCount = tableBlock.props?.columnCount || inferColumnCount(children);
  const rows: any[][] = [];

  for (let i = 0; i < children.length; i += columnCount) {
    rows.push(children.slice(i, i + columnCount));
  }

  return {
    type: 'table',
    attrs: { rowsCount: rows.length, withHeaderRow: rows.some(row => row.some((c: any) => c.type === 'tableHead')) },
    content: rows.map((rowCells) => ({
      type: 'tableRow',
      content: rowCells.map((cell: any) => {
        const isHeader = cell.type === 'tableHead';
        return {
          type: isHeader ? 'tableHeader' : 'tableCell',
          attrs: {
            backgroundColor: cell.props?.backgroundColor || null,
            colspan: cell.props?.colspan || 1,
            rowspan: cell.props?.rowspan || 1
          },
          content: [{
            type: 'paragraph',
            content: convertBlockNoteInlineToTiptap(cell.content)
          }]
        };
      })
    }))
  };
}

function inferColumnCount(cells: any[]): number {
  if (cells.length === 0) return 0;
  if (cells.length <= 3) return cells.length;
  return Math.ceil(Math.sqrt(cells.length));
}

function convertBlockNoteInlineToTiptap(content?: any): JSONContent[] {
  // Handle JSON-stringified arrays from old sanitizeForFirestore
  if (typeof content === 'string') {
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) content = parsed;
      else return [];
    } catch { return []; }
  }
  if (!content || !Array.isArray(content)) return [];

  return content.map(item => {
    if (!item || item.type !== 'text') return null;

    const text = item.text || '';
    const marks: any[] = [];

    if (item.styles?.bold) marks.push({ type: 'bold' });
    if (item.styles?.italic) marks.push({ type: 'italic' });
    if (item.styles?.underline) marks.push({ type: 'underline' });
    if (item.styles?.strike) marks.push({ type: 'strike' });
    if (item.styles?.code) marks.push({ type: 'code' });
    if (item.styles?.backgroundColor) {
      marks.push({ type: 'highlight', attrs: { color: item.styles.backgroundColor } });
    }
    if (item.styles?.link) {
      const href = item.styles.link;
      if (href.startsWith('node://') || text.startsWith('[[') && text.endsWith(']]')) {
        marks.push({ 
          type: 'wiki-link', 
          attrs: { 
            href, 
            label: text.replace(/^\[\[|\]\]$/g, ''),
            title: text.replace(/^\[\[|\]\]$/g, '') 
          } 
        });
      } else {
        marks.push({ type: 'link', attrs: { href } });
      }
    }
    if (item.styles?.textColor) {
      marks.push({ type: 'textStyle', attrs: { color: item.styles.textColor } });
    }

    if (text.includes('\n')) {

      const parts = text.split('\n');
      const nodes: JSONContent[] = [];
      parts.forEach((part: string, i: number) => {
        if (part) {
          nodes.push({
            type: 'text',
            text: part,
            ...(marks.length > 0 ? { marks } : {})
          });
        }
        if (i < parts.length - 1) {
          nodes.push({ type: 'hardBreak' });
        }
      });
      return nodes;
    }

    return {
      type: 'text',
      text,
      ...(marks.length > 0 ? { marks } : {})
    };
  }).flat().filter(Boolean) as JSONContent[];
}

function wrapNestedChildrenInList(nodes: JSONContent[]): JSONContent[] {
  const content: JSONContent[] = [];
  let currentList: { type: 'bulletList' | 'orderedList'; content: JSONContent[] } | null = null;

  nodes.forEach((node) => {
    if (node.type === 'listItem' || node.type === 'bulletListItem' || node.type === 'numberedListItem') {
      const listType = node.type === 'numberedListItem' ? 'orderedList' : 'bulletList';
      const cleanNode = { ...node, type: 'listItem' };
      
      if (currentList && currentList.type === listType) {
        currentList.content.push(cleanNode);
      } else {
        currentList = { type: listType, content: [cleanNode] };
        content.push(currentList as JSONContent);
      }
    } else {
      currentList = null;
      content.push(node);
    }
  });

  return content;
}

/* ──────────────── Helpers ──────────────── */

/**
 * Migrates date fields during editor content conversion.
 * Preserves createdAt from source, sets updatedAt to now.
 */
export function migrateDateFields(source: any, target: any): any {
  const now = new Date().toISOString();
  return {
    ...target,
    createdAt: source?.createdAt || target?.createdAt || now,
    updatedAt: new Date().toISOString(),
  };
}

function createEmptyParagraph() {
  return {
    id: fastId(),
    type: 'paragraph',
    props: { textColor: 'default', backgroundColor: 'default', textAlignment: 'left' },
    content: [],
    children: []
  };
}

function createErrorParagraph(message: string) {
  return {
    id: fastId(),
    type: 'paragraph',
    props: { textColor: 'default', backgroundColor: 'default', textAlignment: 'left' },
    content: [{ type: 'text', text: message, styles: {} }],
    children: []
  };
}

import type { JSONContent } from '@tiptap/react';
import { Block } from '@blocknote/core';

/**
 * Fast ID generator to replace fastId() for bulk migrations
 */
const fastId = () => Math.random().toString(36).substring(2, 11) + Date.now().toString(36);

/**
 * Detects the editor version of the content.
 * @param content - The content to check (either Tiptap JSON or BlockNote array).
 * @returns 1 for Tiptap, 2 for BlockNote.
 */
export function getEditorVersion(content: any): 1 | 2 {
  if (Array.isArray(content) && content.length > 0 && content[0].id && content[0].type) {
    return 2;
  }
  return 1;
}

/**
 * Converts Tiptap (ProseMirror) JSON content to BlockNote blocks.
 * @param tiptapJSON - The Tiptap JSON content.
 * @returns An array of BlockNote blocks.
 */
export function migrateToBlockNote(tiptapJSON: JSONContent | null): any[] {
  if (!tiptapJSON || !tiptapJSON.content) return [];

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

    return blocks.length > 0 ? blocks : [{
      id: fastId(),
      type: 'paragraph',
      props: { textColor: 'default', backgroundColor: 'default', textAlignment: 'left' },
      content: [],
      children: []
    }];
  } catch (error) {
    console.error('[Migration] Failed to migrate to BlockNote:', error);
    // Graceful fallback: return a single paragraph block with raw text or error message
    return [{
      id: fastId(),
      type: 'paragraph',
      props: { textColor: 'default', backgroundColor: 'default', textAlignment: 'left' },
      content: [{ type: 'text', text: 'Error migrating content. Please check logs.', styles: {} }],
      children: []
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
    return {
      type: 'doc',
      content: blocks.map(convertBlockNoteToTiptapNode).filter(Boolean) as JSONContent[]
    };
  } catch (error) {
    console.error('[Migration] Failed to migrate to Tiptap:', error);
    return {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Error migrating content.' }] }]
    };
  }
}

/* ──────────────── Helper Functions ──────────────── */

function convertTiptapNodeToBlockNote(node: JSONContent): any | any[] | null {
  const id = fastId();
  
  switch (node.type) {
    case 'heading': {
      const level = node.attrs?.level || 1;
      return {
        id,
        type: 'heading',
        props: {
          level: level > 3 ? 3 : level, // BlockNote supports levels 1-3
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
      return node.content?.map((item) => ({
        id: fastId(),
        type,
        props: {
          textColor: 'default',
          backgroundColor: 'default',
          textAlignment: 'left'
        },
        content: convertTiptapContentToInline(item.content?.[0]?.content), // Expecting a paragraph inside li
        children: item.content?.slice(1).map(convertTiptapNodeToBlockNote).filter(Boolean) || []
      })) || [];
    }
    case 'taskList': {
      return node.content?.map((item) => ({
        id: fastId(),
        type: 'checkListItem',
        props: {
          textColor: 'default',
          backgroundColor: 'default',
          textAlignment: 'left',
          checked: !!item.attrs?.checked
        },
        content: convertTiptapContentToInline(item.content?.[0]?.content),
        children: item.content?.slice(1).map(convertTiptapNodeToBlockNote).filter(Boolean) || []
      })) || [];
    }
    case 'blockquote': {
      // BlockNote doesn't have a native blockquote block in the core basic pack,
      // but we can map it to a paragraph with a specific style or use a custom block later.
      // For now, let's use a paragraph.
      return {
        id,
        type: 'paragraph',
        props: {
          textColor: 'default',
          backgroundColor: 'default',
          textAlignment: 'left'
        },
        content: [
          { type: 'text', text: '> ', styles: { italic: true } },
          ...convertTiptapContentToInline(node.content)
        ],
        children: []
      };
    }
    case 'codeBlock': {
      return {
        id,
        type: 'codeBlock', // BlockNote has codeBlock in modern versions
        props: {
          language: node.attrs?.language || 'plaintext'
        },
        content: [{ type: 'text', text: node.content?.[0]?.text || '', styles: {} }],
        children: []
      };
    }
    case 'horizontalRule': {
      // Horizontal rule fallback or skip
      return null;
    }
    default:
      // Fallback for unknown nodes
      return {
        id,
        type: 'paragraph',
        content: [{ type: 'text', text: `[Unsupported node: ${node.type}]`, styles: {} }],
        children: []
      };
  }
}

function convertTiptapContentToInline(content?: JSONContent[]): any[] {
  if (!content) return [];
  
  // Recursively handle nested content for certain Tiptap nodes (like paragraphs in list items)
  // But usually, BlockNote content is just a flat array of inline markers
  const inlineContent: any[] = [];
  
  content.forEach(item => {
    if (item.type === 'text') {
      inlineContent.push({
        type: 'text',
        text: item.text || '',
        styles: convertTiptapMarksToStyles(item.marks)
      });
    } else if (item.type === 'hardBreak') {
        inlineContent.push({ type: 'text', text: '\n', styles: {} });
    }
    // Handle other inline types (mention, link, etc.) if needed
  });
  
  return inlineContent;
}

function convertTiptapMarksToStyles(marks?: any[]): Record<string, boolean> {
  const styles: Record<string, boolean> = {};
  if (!marks) return styles;
  
  marks.forEach(mark => {
    switch (mark.type) {
      case 'bold': styles.bold = true; break;
      case 'italic': styles.italic = true; break;
      case 'underline': styles.underline = true; break;
      case 'strike': styles.strike = true; break;
      case 'code': styles.code = true; break;
    }
  });
  
  return styles;
}

function convertBlockNoteToTiptapNode(block: any): JSONContent | null {
  switch (block.type) {
    case 'heading':
      return {
        type: 'heading',
        attrs: { level: block.props.level, textAlign: block.props.textAlignment },
        content: convertInlineToTiptapContent(block.content)
      };
    case 'paragraph':
      return {
        type: 'paragraph',
        attrs: { textAlign: block.props.textAlignment },
        content: convertInlineToTiptapContent(block.content)
      };
    case 'bulletListItem':
    case 'numberedListItem': {
      const type = block.type === 'bulletListItem' ? 'bulletList' : 'orderedList';
      // In Tiptap, nested lists are often wrapped in a list container
      // This conversion is simplified for canvas display
      return {
        type: 'listItem',
        content: [
          { type: 'paragraph', content: convertInlineToTiptapContent(block.content) },
          ...(block.children?.map(convertBlockNoteToTiptapNode).filter(Boolean) || [])
        ]
      };
    }
    case 'checkListItem':
      return {
        type: 'taskItem',
        attrs: { checked: !!block.props.checked },
        content: [
          { type: 'paragraph', content: convertInlineToTiptapContent(block.content) },
          ...(block.children?.map(convertBlockNoteToTiptapNode).filter(Boolean) || [])
        ]
      };
    case 'codeBlock':
      return {
        type: 'codeBlock',
        attrs: { language: block.props.language },
        content: [{ type: 'text', text: block.content?.[0]?.text || '' }]
      };
    default:
      return {
        type: 'paragraph',
        content: convertInlineToTiptapContent(block.content)
      };
  }
}

function convertInlineToTiptapContent(content?: any): JSONContent[] {
  if (!content || !Array.isArray(content)) return [];
  
  return content.map(item => {
    if (item.type === 'text') {
      const marks: any[] = [];
      if (item.styles?.bold) marks.push({ type: 'bold' });
      if (item.styles?.italic) marks.push({ type: 'italic' });
      if (item.styles?.underline) marks.push({ type: 'underline' });
      if (item.styles?.strike) marks.push({ type: 'strike' });
      if (item.styles?.code) marks.push({ type: 'code' });
      
      return {
        type: 'text',
        text: item.text,
        ...(marks.length > 0 ? { marks } : {})
      };
    }
    return null;
  }).filter(Boolean) as JSONContent[];
}

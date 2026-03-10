import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { MermaidBlock } from '@/components/tiptap/MermaidBlock';

export interface MermaidOptions {
  HTMLAttributes: Record<string, any>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mermaid: {
      /**
       * Insert a Mermaid diagram block
       */
      insertMermaidBlock: (options?: { code?: string }) => ReturnType;
    };
  }
}

export const MermaidExtension = Node.create<MermaidOptions>({
  name: 'mermaid',
  group: 'block',
  content: 'text*',
  atom: true,

  addOptions() {
    return {
      HTMLAttributes: {
        class: 'mermaid-block-wrapper',
      },
    };
  },

  addAttributes() {
    return {
      code: {
        default: 'graph TD\n  A[Start] --> B[End]',
        parseHTML: (element) => element.getAttribute('data-code') || element.textContent,
        renderHTML: (attributes) => ({
          'data-code': attributes.code,
        }),
      },
      previewMode: {
        default: true,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-type="mermaid"]',
      },
      {
        tag: 'code.language-mermaid', 
        getAttrs: (node) => {
           // parse code blocks that are actually mermaid
           return {
              code: (node as HTMLElement).textContent
           }
        }
      }
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, { 'data-type': 'mermaid' }), ['div', { class: 'mermaid-content' }, 0]];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MermaidBlock);
  },

  addCommands() {
    return {
      insertMermaidBlock:
        (options) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              code: options?.code || 'graph TD\n  A[Start] --> B[End]',
              previewMode: true,
            },
          });
        },
    };
  },
});

export default MermaidExtension;

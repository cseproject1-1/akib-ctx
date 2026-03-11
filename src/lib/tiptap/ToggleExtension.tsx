import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent } from '@tiptap/react';
import React from 'react';
import { ChevronRight } from 'lucide-react';

/**
 * Professional Toggle (Details/Summary) Extension
 * Uses React NodeViews for reliable interaction and premium look.
 */

const ToggleView = ({ node, updateAttributes, selected }: any) => {
  const isOpen = node.attrs.open;

  const toggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    updateAttributes({ open: !isOpen });
  };

  return (
    <NodeViewWrapper className={`toggle-block my-2 transition-all duration-300 ${isOpen ? 'is-open' : 'is-closed'} ${selected ? 'ProseMirror-selectednode' : ''}`}>
      <div className="flex items-start group">
        <button
          onClick={toggle}
          contentEditable={false}
          className="mt-1 mr-2 p-0.5 rounded-md hover:bg-muted/50 transition-colors text-muted-foreground hover:text-foreground focus:outline-none"
        >
          <ChevronRight 
            className={`h-4 w-4 transition-transform duration-200 ${isOpen ? 'rotate-90' : ''}`} 
          />
        </button>
        <div className="flex-1 min-w-0">
          <NodeViewContent className="toggle-content-hole" />
        </div>
      </div>
    </NodeViewWrapper>
  );
};

export const ToggleExtension = Node.create({
  name: 'details',
  group: 'block',
  content: 'detailsSummary detailsContent',
  defining: true,
  selectable: true,
  allowGapCursor: true,

  addAttributes() {
    return {
      open: {
        default: true,
        parseHTML: element => element.hasAttribute('open'),
        renderHTML: attributes => {
          if (attributes.open) return { open: '' };
          return {};
        },
      },
    };
  },

  parseHTML() {
    return [{ tag: 'details' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['details', mergeAttributes(HTMLAttributes), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ToggleView);
  },

  addCommands() {
    return {
      insertToggle:
        () =>
        ({ chain }) => {
          return chain()
            .insertContent({
              type: this.name,
              attrs: { open: true },
              content: [
                { type: 'detailsSummary', content: [{ type: 'text', text: 'Toggle' }] },
                { 
                  type: 'detailsContent', 
                  content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Empty toggle content…' }] }] 
                },
              ],
            })
            .run();
        },
    } as any;
  },
});

export const DetailsSummary = Node.create({
  name: 'detailsSummary',
  group: 'block',
  content: 'inline*',
  defining: true,

  parseHTML() {
    return [{ tag: 'summary' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['summary', mergeAttributes(HTMLAttributes), 0];
  },
});

export const DetailsContent = Node.create({
  name: 'detailsContent',
  group: 'block',
  content: 'block+',
  defining: true,

  parseHTML() {
    return [{ tag: 'div', attrs: { 'data-type': 'details-content' } }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'details-content', class: 'toggle-content' }), 0];
  },
});

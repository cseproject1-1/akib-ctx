import { Node, mergeAttributes } from '@tiptap/react';

export const CalloutExtension = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',

  addAttributes() {
    return {
      type: {
        default: 'info',
        parseHTML: (element) => element.getAttribute('data-callout-type') || 'info',
        renderHTML: (attributes) => ({ 'data-callout-type': attributes.type }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-callout]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-callout': '',
        class: 'callout-block',
      }),
      0,
    ];
  },

  addCommands() {
    return {
      setCallout:
        (attrs?: { type?: string }) =>
        ({ commands }: any) => {
          return commands.wrapIn(this.name, attrs);
        },
    } as any;
  },
});

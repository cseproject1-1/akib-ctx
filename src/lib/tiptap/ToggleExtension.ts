import { Node, mergeAttributes } from '@tiptap/core';

export const ToggleExtension = Node.create({
  name: 'details',
  group: 'block',
  content: 'block+',
  defining: true,

  parseHTML() {
    return [{ tag: 'details' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['details', mergeAttributes(HTMLAttributes), ['summary', {}, 'Toggle'], ['div', {}, 0]];
  },

  addCommands() {
    return {
      insertToggle:
        () =>
        ({ chain }) => {
          return chain()
            .insertContent({
              type: 'details',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Content here…' }] }],
            })
            .run();
        },
    } as any;
  },
});

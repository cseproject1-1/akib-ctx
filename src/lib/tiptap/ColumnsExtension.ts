import { Node, mergeAttributes } from '@tiptap/react';

export const ColumnsExtension = Node.create({
  name: 'columns',
  group: 'block',
  content: 'column column+',

  parseHTML() {
    return [{ tag: 'div[data-columns]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-columns': '',
        class: 'columns-layout',
      }),
      0,
    ];
  },

  addCommands() {
    return {
      insertColumns:
        () =>
        ({ chain }: any) => {
          return chain()
            .insertContent({
              type: 'columns',
              content: [
                { type: 'column', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Column 1' }] }] },
                { type: 'column', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Column 2' }] }] },
              ],
            })
            .run();
        },
    } as any;
  },
});

export const ColumnExtension = Node.create({
  name: 'column',
  group: '',
  content: 'block+',

  parseHTML() {
    return [{ tag: 'div[data-column]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-column': '',
        class: 'column-item',
      }),
      0,
    ];
  },
});

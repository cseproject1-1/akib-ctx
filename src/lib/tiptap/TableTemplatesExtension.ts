import { Extension } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    tableTemplates: {
      insertBudgetTable: () => ReturnType;
      insertCalendarTable: () => ReturnType;
    };
  }
}

export const TableTemplatesExtension = Extension.create({
  name: 'tableTemplates',

  addCommands() {
    return {
      insertBudgetTable: () => ({ chain }) => {
        return chain()
          .insertContent({
            type: 'table',
            content: [
              {
                type: 'tableRow',
                content: [
                  { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item' }] }] },
                  { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Category' }] }] },
                  { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Budgeted' }] }] },
                  { type: 'tableHeader', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Actual' }] }] },
                ],
              },
              {
                type: 'tableRow',
                content: [
                  { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Rent' }] }] },
                  { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Housing' }] }] },
                  { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '1200' }] }] },
                  { type: 'tableCell', content: [{ type: 'paragraph', content: [{ type: 'text', text: '1200' }] }] },
                ],
              },
            ],
          })
          .run();
      },
      insertCalendarTable: () => ({ chain }) => {
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const header = days.map(day => ({
          type: 'tableHeader',
          content: [{ type: 'paragraph', content: [{ type: 'text', text: day }] }],
        }));
        const rows = Array.from({ length: 5 }, () => ({
          type: 'tableRow',
          content: days.map(() => ({
            type: 'tableCell',
            content: [{ type: 'paragraph', content: [] }],
          })),
        }));

        return chain()
          .insertContent({
            type: 'table',
            content: [
              { type: 'tableRow', content: header },
              ...rows,
            ],
          })
          .run();
      },
    };
  },
});

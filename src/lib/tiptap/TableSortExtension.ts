import { Extension } from '@tiptap/core';
import { Table } from '@tiptap/extension-table';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    tableSort: {
      sortColumn: (columnIndex: number, direction?: 'asc' | 'desc') => ReturnType;
    };
  }
}

export const TableSortExtension = Extension.create({
  name: 'tableSort',

  addCommands() {
    return {
      sortColumn: (columnIndex: number, direction = 'asc') => ({ state, dispatch }) => {
        const { selection } = state;
        const { $from } = selection;
        
        // Find the table node
        let table = null;
        let tablePos = -1;
        
        for (let d = $from.depth; d > 0; d--) {
          if ($from.node(d).type.name === 'table') {
            table = $from.node(d);
            tablePos = $from.before(d);
            break;
          }
        }

        if (!table || tablePos === -1) return false;

        if (dispatch) {
          const rows: any[] = [];
          table.forEach((row, offset) => {
             rows.push({ row, offset });
          });

          // Skip header row if it exists (assuming first row is header)
          // Tiptap's Table extension uses tableHeader, but some rows might be all headers.
          // For simplicity, we'll sort all rows except the first one if it contains tableHeader nodes.
          const hasHeader = rows[0].row.firstChild?.type.name === 'tableHeader';
          const headerRow = hasHeader ? rows.shift() : null;

          rows.sort((a, b) => {
            const cellA = a.row.child(columnIndex);
            const cellB = b.row.child(columnIndex);
            
            const textA = cellA.textContent.trim().toLowerCase();
            const textB = cellB.textContent.trim().toLowerCase();

            // Try numeric sort
            const numA = parseFloat(textA.replace(/[^\d.-]/g, ''));
            const numB = parseFloat(textB.replace(/[^\d.-]/g, ''));

            if (!isNaN(numA) && !isNaN(numB)) {
              return direction === 'asc' ? numA - numB : numB - numA;
            }

            if (textA < textB) return direction === 'asc' ? -1 : 1;
            if (textA > textB) return direction === 'asc' ? 1 : -1;
            return 0;
          });

          // Re-insert rows
          const newRows = headerRow ? [headerRow.row, ...rows.map(r => r.row)] : rows.map(r => r.row);
          const newTable = state.schema.nodes.table.create(table.attrs, newRows);
          
          dispatch(state.tr.replaceWith(tablePos, tablePos + table.nodeSize, newTable));
        }

        return true;
      },
    };
  },
});

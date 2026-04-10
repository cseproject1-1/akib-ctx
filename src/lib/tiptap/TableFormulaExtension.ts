import { Extension } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    tableFormula: {
      calculateFormulas: () => ReturnType;
    };
  }
}

export const TableFormulaExtension = Extension.create({
  name: 'tableFormula',

  addCommands() {
    return {
      calculateFormulas: () => ({ state, dispatch }) => {
        const { tr, doc } = state;
        let modified = false;

        doc.descendants((node, pos) => {
          if (node.type.name === 'tableCell' && node.attrs.formula) {
            const result = evaluateFormula(node.attrs.formula, state.doc, pos);
            if (result !== node.textContent) {
              const start = pos + 1;
              const end = pos + node.nodeSize - 1;
              tr.insertText(result, start, end);
              modified = true;
            }
          }
        });

        if (modified && dispatch) {
          dispatch(tr);
        }
        return modified;
      },
    };
  },
});

import { evaluate } from 'mathjs';

function evaluateFormula(formula: string, doc: any, cellPos: number): string {
  const expression = formula.replace(/^=/, '').trim();
  try {
    // Basic sanitization: only allow math characters for now
    const cleanExpr = expression.replace(/[^-+*/().\d\s]/g, '');
    if (!cleanExpr) return '';
    
    const result = evaluate(cleanExpr);
    return String(result);
  } catch {
    return '#ERROR!';
  }
}


import { Node, mergeAttributes } from '@tiptap/react';
import katex from 'katex';

export const KaTeXExtension = Node.create({
  name: 'mathBlock',
  group: 'block',
  content: 'text*',
  marks: '',
  code: true,

  addAttributes() {
    return {
      latex: {
        default: 'E = mc^2',
        parseHTML: (el: HTMLElement) => {
          // Try data-latex attribute first
          const dataLatex = el.getAttribute('data-latex');
          if (dataLatex) return dataLatex;

          // Try extracting from KaTeX annotation
          const annotation = el.querySelector('annotation[encoding="application/x-tex"]');
          if (annotation?.textContent) return annotation.textContent.trim();

          // Fall back to text content
          return el.textContent?.trim() || 'E = mc^2';
        },
        renderHTML: (attrs: Record<string, any>) => ({ 'data-latex': attrs.latex }),
      },
    };
  },

  parseHTML() {
    return [
      { tag: 'div[data-math-block]' },
      // Recognize KaTeX rendered output directly
      {
        tag: 'span.katex-display',
        priority: 60,
      },
      {
        tag: 'span.katex',
        priority: 50,
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    let rendered = '';
    try {
      rendered = katex.renderToString(HTMLAttributes['data-latex'] || '', {
        throwOnError: false,
        displayMode: true,
      });
    } catch {
      rendered = HTMLAttributes['data-latex'] || '';
    }
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-math-block': '',
        class: 'math-block',
      }),
      ['div', { class: 'math-block-rendered', contenteditable: 'false' }, rendered],
      ['code', { class: 'math-block-source' }, 0],
    ];
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const container = document.createElement('div');
      container.classList.add('math-block');
      container.setAttribute('data-math-block', '');

      const rendered = document.createElement('div');
      rendered.classList.add('math-block-rendered');
      rendered.contentEditable = 'false';

      const source = document.createElement('code');
      source.classList.add('math-block-source');
      source.textContent = node.attrs.latex || '';

      const renderMath = (latex: string) => {
        try {
          katex.render(latex || '', rendered, {
            displayMode: true,
            throwOnError: false,
            trust: true,
            strict: false,
            output: 'html',
          });
        } catch {
          rendered.textContent = latex || '';
        }
      };

      renderMath(node.attrs.latex);

      // Click to edit
      let editing = false;
      rendered.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!editor.isEditable) return;
        editing = true;
        container.classList.add('editing');
        source.style.display = 'block';
        rendered.style.display = 'none';
        source.focus();
      });

      source.contentEditable = 'true';
      source.style.display = 'none';

      source.addEventListener('blur', () => {
        const newLatex = source.textContent || '';
        editing = false;
        container.classList.remove('editing');
        source.style.display = 'none';
        rendered.style.display = '';
        renderMath(newLatex);

        if (typeof getPos === 'function') {
          const pos = getPos();
          if (pos != null) {
            editor.view.dispatch(
              editor.view.state.tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                latex: newLatex,
              })
            );
          }
        }
      });

      source.addEventListener('keydown', (e) => {
        e.stopPropagation();
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          source.blur();
        }
        if (e.key === 'Escape') {
          source.blur();
        }
      });

      container.append(rendered, source);

      return {
        dom: container,
        contentDOM: undefined,
        stopEvent: (e: Event) => {
          if (editing && (e instanceof KeyboardEvent || e instanceof InputEvent)) return true;
          return false;
        },
        update: (updatedNode) => {
          if (updatedNode.type.name !== 'mathBlock') return false;
          if (!editing) {
            source.textContent = updatedNode.attrs.latex || '';
            renderMath(updatedNode.attrs.latex);
          }
          return true;
        },
      };
    };
  },

  addCommands() {
    return {
      insertMathBlock:
        (attrs?: { latex?: string }) =>
        ({ chain }: any) => {
          return chain()
            .insertContent({
              type: this.name,
              attrs: { latex: attrs?.latex || 'E = mc^2' },
              content: [{ type: 'text', text: attrs?.latex || 'E = mc^2' }],
            })
            .run();
        },
    } as any;
  },
});

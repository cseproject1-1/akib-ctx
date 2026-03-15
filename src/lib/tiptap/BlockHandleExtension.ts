import { Extension } from '@tiptap/react';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { EditorView } from '@tiptap/pm/view';
import { NodeSelection } from '@tiptap/pm/state';

export interface BlockHandleOptions {
  handleClassName: string;
}

export const BlockHandleExtension = Extension.create<BlockHandleOptions>({
  name: 'blockHandle',

  addOptions() {
    return {
      handleClassName: 'block-handle-trigger',
    };
  },

  addProseMirrorPlugins() {
    let handle: HTMLElement | null = null;
    let currentPos: number | null = null;

    return [
      new Plugin({
        key: new PluginKey('blockHandle'),
        props: {
          handleDOMEvents: {
            mousemove(view, event) {
              if (!view.editable) return false;

              const target = event.target as HTMLElement;
              const coords = { left: event.clientX, top: event.clientY };
              const pos = view.posAtCoords(coords);

              if (!pos) return false;

              // Find the top-level block node at this position
              const resolved = view.state.doc.resolve(pos.pos);
              let nodePos = resolved.before(1);
              if (nodePos === undefined) return false;

              const node = view.state.doc.nodeAt(nodePos);
              if (!node || node.type.name === 'doc') return false;

              currentPos = nodePos;

              // Position the handle
              if (!handle) {
                handle = document.createElement('div');
                handle.className = 'absolute z-50 cursor-grab opacity-0 transition-opacity hover:opacity-100 flex items-center justify-center w-6 h-6 rounded hover:bg-muted group';
                handle.innerHTML = `
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" class="text-muted-foreground group-hover:text-primary">
                    <path d="M4 2.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm4 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm4 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm-8 7a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm4 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0zm4 0a1 1 0 1 1-2 0 1 1 0 0 1 2 0z" fill="currentColor"/>
                  </svg>
                `;
                
                // Add drag behavior
                handle.draggable = true;
                handle.addEventListener('dragstart', (e) => {
                  if (currentPos === null) return;
                  const selection = NodeSelection.create(view.state.doc, currentPos);
                  view.dispatch(view.state.tr.setSelection(selection));
                  
                  // Optional: style the node being dragged
                  e.dataTransfer?.setDragImage(view.nodeDOM(currentPos) as Element, 0, 0);
                });

                view.dom.parentElement?.appendChild(handle);
              }

              const dom = view.nodeDOM(nodePos) as HTMLElement;
              if (dom) {
                const rect = dom.getBoundingClientRect();
                const parentRect = view.dom.parentElement?.getBoundingClientRect() || { top: 0, left: 0 };
                
                handle.style.top = `${rect.top - parentRect.top + 4}px`;
                handle.style.left = `${-28}px`; // Margin-left offset
                handle.style.opacity = '0.5';
              }

              return false;
            },
            mouseleave() {
                if (handle) handle.style.opacity = '0';
                return false;
            }
          },
        },
      }),
    ];
  },
});

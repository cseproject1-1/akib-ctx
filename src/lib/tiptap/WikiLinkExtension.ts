import { Extension } from '@tiptap/react';
import Suggestion from '@tiptap/suggestion';
import { ReactRenderer } from '@tiptap/react';
import tippy, { type Instance } from 'tippy.js';
import { useCanvasStore } from '@/store/canvasStore';
import { WikiLinkList } from '@/components/tiptap/WikiLinkList';
import { PluginKey } from '@tiptap/pm/state';

const WikiLinkKey = new PluginKey('wikiLink');

export const WikiLinkExtension = Extension.create({
  name: 'wikiLink',

  addOptions() {
    return {
      suggestion: {
        char: '[[',
        command: ({ editor, range, props }: any) => {
          // props will have the node title and id
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent([
              {
                type: 'text',
                text: `[[${props.title}]]`,
                marks: [
                  {
                    type: 'link',
                    attrs: {
                      href: `#node-${props.id}`,
                      class: 'wiki-link',
                      'data-node-id': props.id,
                    },
                  },
                ],
              },
              {
                type: 'text',
                text: ' ',
              }
            ])
            .run();
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
        pluginKey: WikiLinkKey,
        items: ({ query }: { query: string }) => {
          const nodes = useCanvasStore.getState().nodes;
          // Return nodes that are not the current one (maybe?) and match the query
          // In practice, we just show all nodes for now
          return nodes
            .filter(n => (n.data as any).title?.toLowerCase().includes(query.toLowerCase()))
            .map(n => ({
              id: n.id,
              title: (n.data as any).title || 'Untitled',
            }))
            .slice(0, 10);
        },
        render: () => {
          let component: ReactRenderer | null = null;
          let popup: Instance[] | null = null;

          return {
            onStart: (props: any) => {
              component = new ReactRenderer(WikiLinkList, {
                props,
                editor: props.editor,
              });

              if (!props.clientRect) return;

              popup = tippy('body', {
                getReferenceClientRect: props.clientRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: 'manual',
                placement: 'bottom-start',
              });
            },

            onUpdate: (props: any) => {
              component?.updateProps(props);
              if (popup && props.clientRect) {
                popup[0]?.setProps({
                  getReferenceClientRect: props.clientRect,
                });
              }
            },

            onKeyDown: (props: any) => {
              if (props.event.key === 'Escape') {
                popup?.[0]?.hide();
                return true;
              }
              return (component?.ref as any)?.onKeyDown?.(props) || false;
            },

            onExit: () => {
              popup?.[0]?.destroy();
              component?.destroy();
            },
          };
        },
      }),
    ];
  },
});

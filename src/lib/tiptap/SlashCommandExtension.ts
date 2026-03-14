import { Extension } from '@tiptap/react';
import Suggestion from '@tiptap/suggestion';
import { ReactRenderer } from '@tiptap/react';
import tippy, { type Instance } from 'tippy.js';
import Fuse from 'fuse.js';
import { SlashMenuList, slashMenuItems, type SlashMenuItem } from '@/components/tiptap/SlashMenu';
import { PluginKey } from '@tiptap/pm/state';

const SlashSearchKey = new PluginKey('slashCommand');

const SlashCommand = Extension.create({
  name: 'slashCommand',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        command: ({ editor, range, props }: any) => {
          props.command({ editor, range });
          // If the item has a popover config, trigger it via the editor's handler
          if (props.popover) {
            const handler = (editor as any).__popoverHandler;
            if (handler) handler(props);
          }
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
        pluginKey: SlashSearchKey,
        items: ({ query }: { query: string }) => {
          if (!query) return slashMenuItems;
          const fuse = new Fuse(slashMenuItems, {
            keys: ['title', 'group'],
            threshold: 0.3,
          });
          return fuse.search(query).map((res) => res.item);
        },
        render: () => {
          let component: ReactRenderer | null = null;
          let popup: Instance[] | null = null;

          return {
            onStart: (props: any) => {
              component = new ReactRenderer(SlashMenuList, {
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
              if (popup) {
                popup.forEach(instance => instance.destroy());
                popup = null;
              }
              component?.destroy();
            },
          };
        },
      }),
    ];
  },
});

export default SlashCommand;

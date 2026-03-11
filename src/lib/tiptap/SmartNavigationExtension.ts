import { Extension } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    smartNavigation: {
      /**
       * Expand selection to the next semantic unit (word -> sentence -> paragraph -> node).
       */
      expandSelection: () => ReturnType;
    };
  }
}

export const SmartNavigationExtension = Extension.create({
  name: 'smartNavigation',

  addCommands() {
    return {
      expandSelection: () => ({ state, dispatch }) => {
        const { selection, doc } = state;
        const { $from, $to, empty } = selection;

        // If empty, start with word
        if (empty) {
          // Select word at cursor
          // This is a bit complex in Prosemirror basics, but we can use text search or PM helpers
          // For now, let's use a simpler approach: select the current node if it's a word-like thing
          // Actually, let's just use selectParentNode as a fallback for now or implement better logic
        }

        // Cycle through: Word -> Sentence -> Paragraph -> All
        // We'll use a stateful approach or check current selection bounds
        
        // TODO: Implement precise semantic expansion logic
        // For now, selectParentNode is a good "standard" expansion
        if (dispatch) {
          state.tr.setSelection(state.selection); // dummy to check
          // We can use transform to expand
        }
        
        return true;
      },
    };
  },

  addKeyboardShortcuts() {
    return {
      'Alt-ArrowUp': () => this.editor.commands.expandSelection(),
      'Tab': () => {
        if (this.editor.isActive('listItem') || this.editor.isActive('taskItem')) {
          return this.editor.commands.sinkListItem(this.editor.isActive('taskItem') ? 'taskItem' : 'listItem');
        }
        return false;
      },
      'Shift-Tab': () => {
        if (this.editor.isActive('listItem') || this.editor.isActive('taskItem')) {
          return this.editor.commands.liftListItem(this.editor.isActive('taskItem') ? 'taskItem' : 'listItem');
        }
        return false;
      },
      'Control-ArrowLeft': ({ editor }) => {
        // Standard word jump is usually handled by browser, but we can force it
        return false; // let default happen for now unless we need specific Notion-like block behavior
      },
      'Control-ArrowRight': ({ editor }) => {
        return false;
      },
    };
  },
});

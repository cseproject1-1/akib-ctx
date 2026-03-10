import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Step } from '@tiptap/pm/transform';

export interface Macro {
  id: string;
  name: string;
  steps: any[];
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    macro: {
      startRecording: () => ReturnType;
      stopRecording: (name: string) => ReturnType;
      playMacro: (id: string) => ReturnType;
    };
  }
}

export const MacroExtension = Extension.create({
  name: 'macro',

  addStorage() {
    return {
      isRecording: false,
      currentSteps: [] as any[],
      macros: JSON.parse(localStorage.getItem('editor-macros') || '[]') as Macro[],
    };
  },

  addCommands() {
    return {
      startRecording: () => () => {
        this.storage.isRecording = true;
        this.storage.currentSteps = [];
        return true;
      },
      stopRecording: (name: string) => () => {
        if (!this.storage.isRecording) return false;
        this.storage.isRecording = false;
        
        if (this.storage.currentSteps.length > 0) {
          const newMacro: Macro = {
            id: crypto.randomUUID(),
            name: name || `Macro ${this.storage.macros.length + 1}`,
            steps: [...this.storage.currentSteps],
          };
          this.storage.macros.push(newMacro);
          localStorage.setItem('editor-macros', JSON.stringify(this.storage.macros));
        }
        return true;
      },
      playMacro: (id: string) => ({ editor }) => {
        const macro = this.storage.macros.find((m: Macro) => m.id === id);
        if (!macro) return false;

        macro.steps.forEach((stepJson: any) => {
          try {
            const step = Step.fromJSON(editor.schema, stepJson);
            editor.view.dispatch(editor.state.tr.step(step));
          } catch (e) {
            console.warn('Failed to replay macro step', e);
          }
        });
        return true;
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('macroRecorder'),
        appendTransaction: (transactions) => {
          if (!this.storage.isRecording) return null;

          transactions.forEach(tr => {
            if (tr.docChanged) {
              tr.steps.forEach(step => {
                this.storage.currentSteps.push(step.toJSON());
              });
            }
          });
          return null;
        },
      }),
    ];
  },
});

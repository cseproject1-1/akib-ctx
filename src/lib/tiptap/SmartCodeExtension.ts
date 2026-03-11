import { Extension } from '@tiptap/react';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { detectCode, autoFormatText } from '../codeDetection';
import { toast } from 'sonner';

/**
 * @extension SmartCodeExtension
 * @description Advanced code detection and auto-formatting for Tiptap.
 */
export const SmartCodeExtension = Extension.create({
  name: 'smartCode',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey('smartCodePaste'),
        props: {
          handlePaste: (view, event, slice) => {
            const pastedText = event.clipboardData?.getData('text/plain');
            if (!pastedText) return false;

            // Run advanced detection
            const detection = detectCode(pastedText);

            // If it's a significant block of code (confidence > 0.8) and NOT already markdown
            if (detection.isCode && detection.confidence > 0.7 && !pastedText.includes('```')) {
              // Ask user if they want to format as code (or just do it if very high confidence)
              if (detection.confidence > 0.85) {
                const formatted = `\`\`\`${detection.language}\n${pastedText}\n\`\`\``;
                const { schema, tr } = view.state;
                // Since Tiptap handles markdown via its own logic, we insert it as markdown content
                // But for simplicity in this extension, we'll let the user decide or just toast
                toast.info(`Detected ${detection.language} code. Formatting as code block.`);
                
                // We'll use the editor's insertContent to handle the markdown
                this.editor.commands.insertContent(formatted);
                return true; // Intercepted
              }
            }

            // If it's natural text with embedded code blocks
            if (detection.confidence < 0.7 && pastedText.split('\n').length > 5 && !pastedText.includes('```')) {
              const autoFormatted = autoFormatText(pastedText);
              if (autoFormatted !== pastedText) {
                toast.info('Smart Code Detection: Automatically formatted code snippets in your paste.');
                this.editor.commands.insertContent(autoFormatted);
                return true;
              }
            }

            return false;
          },
        },
      }),
    ];
  },

  addStorage() {
    return {
      lastDetectedLanguage: 'plaintext',
    };
  },
});

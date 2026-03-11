import { Extension } from '@tiptap/core';
import '@tiptap/extension-text-style';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    typographyProps: {
      setFontFamily: (fontFamily: string) => ReturnType;
      unsetFontFamily: () => ReturnType;
      setLineHeight: (lineHeight: string) => ReturnType;
      unsetLineHeight: () => ReturnType;
      setLetterSpacing: (letterSpacing: string) => ReturnType;
      unsetLetterSpacing: () => ReturnType;
      setParagraphSpacing: (spacing: { before?: string; after?: string }) => ReturnType;
      unsetParagraphSpacing: () => ReturnType;
    };
  }
}

export const TypographyExtensions = Extension.create({
  name: 'typographyProps',

  addOptions() {
    return {
      types: ['paragraph', 'heading', 'list_item', 'task_item'],
    };
  },

  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: element => element.style.lineHeight,
            renderHTML: attributes => {
              if (!attributes.lineHeight) return {};
              return { style: `line-height: ${attributes.lineHeight}` };
            },
          },
          letterSpacing: {
            default: null,
            parseHTML: element => element.style.letterSpacing,
            renderHTML: attributes => {
              if (!attributes.letterSpacing) return {};
              return { style: `letter-spacing: ${attributes.letterSpacing}` };
            },
          },
          marginTop: {
            default: null,
            parseHTML: element => element.style.marginTop,
            renderHTML: attributes => {
              if (!attributes.marginTop) return {};
              return { style: `margin-top: ${attributes.marginTop}` };
            },
          },
          marginBottom: {
            default: null,
            parseHTML: element => element.style.marginBottom,
            renderHTML: attributes => {
              if (!attributes.marginBottom) return {};
              return { style: `margin-bottom: ${attributes.marginBottom}` };
            },
          },
        },
      },
      {
        types: ['textStyle'],
        attributes: {
          fontFamily: {
            default: null,
            parseHTML: element => element.style.fontFamily?.replace(/['"]/g, ''),
            renderHTML: attributes => {
              if (!attributes.fontFamily) return {};
              return { style: `font-family: ${attributes.fontFamily}` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      setFontFamily: (fontFamily: string) => ({ chain }) => {
        return chain().setMark('textStyle', { fontFamily }).run();
      },
      unsetFontFamily: () => ({ chain }) => {
        return chain().setMark('textStyle', { fontFamily: null }).removeEmptyTextStyle().run();
      },
      setLineHeight: (lineHeight: string) => ({ commands }) => {
        return this.options.types.every(type => commands.updateAttributes(type, { lineHeight }));
      },
      unsetLineHeight: () => ({ commands }) => {
        return this.options.types.every(type => commands.updateAttributes(type, { lineHeight: null }));
      },
      setLetterSpacing: (letterSpacing: string) => ({ commands }) => {
        return this.options.types.every(type => commands.updateAttributes(type, { letterSpacing }));
      },
      unsetLetterSpacing: () => ({ commands }) => {
        return this.options.types.every(type => commands.updateAttributes(type, { letterSpacing: null }));
      },
      setParagraphSpacing: ({ before, after }) => ({ commands }) => {
        return this.options.types.every(type => 
          commands.updateAttributes(type, { 
            ...(before !== undefined && { marginTop: before }),
            ...(after !== undefined && { marginBottom: after })
          })
        );
      },
      unsetParagraphSpacing: () => ({ commands }) => {
        return this.options.types.every(type => commands.updateAttributes(type, { marginTop: null, marginBottom: null }));
      },
    };
  },
});

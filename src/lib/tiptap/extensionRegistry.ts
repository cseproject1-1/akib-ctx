import type { Extension, Node, Mark } from '@tiptap/core';

export type AnyExtension = Extension | Node | Mark;

export const extensionRegistry = {
  loadMath: async (): Promise<AnyExtension> => {
    const { KaTeXExtension } = await import('./KaTeXExtension');
    return KaTeXExtension;
  },
  
  loadCode: async (): Promise<AnyExtension> => {
    const { default: CodeBlockLowlight } = await import('@tiptap/extension-code-block-lowlight');
    const { createLowlight, all } = await import('lowlight');
    const lowlight = createLowlight(all);
    return CodeBlockLowlight.configure({ lowlight });
  },

  loadCustomBlocks: async (): Promise<AnyExtension[]> => {
    const blocks = await import('./CustomBlockExtensions');
    return [
      blocks.CaptionExtension,
      blocks.ProgressExtension,
      blocks.BadgeExtension,
      blocks.BookmarkExtension,
      blocks.AudioBlockExtension,
      blocks.VideoBlockExtension,
      blocks.FootnoteRefExtension,
      blocks.FootnoteItemExtension,
    ];
  },

  loadMermaid: async (): Promise<AnyExtension> => {
    const { MermaidExtension } = await import('./MermaidExtension');
    return MermaidExtension;
  },

  loadMacro: async (): Promise<AnyExtension> => {
    const { MacroExtension } = await import('./MacroExtension');
    return MacroExtension;
  }
};

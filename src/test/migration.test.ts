import { describe, it, expect } from 'vitest';
import { migrateToBlockNote, migrateToTiPTap, getEditorVersion } from '@/lib/editor/migration';

describe('Migration', () => {
  describe('getEditorVersion', () => {
    it('should return 1 for Tiptap content (type: doc)', () => {
      const tiptapContent = { type: 'doc', content: [] };
      expect(getEditorVersion(tiptapContent)).toBe(1);
    });

    it('should return 2 for BlockNote content (array with id and type)', () => {
      const blocknoteContent = [{ id: '1', type: 'paragraph', props: {}, content: [], children: [] }];
      expect(getEditorVersion(blocknoteContent)).toBe(2);
    });

    it('should return 1 for null/undefined', () => {
      expect(getEditorVersion(null)).toBe(1);
      expect(getEditorVersion(undefined)).toBe(1);
    });
  });

  describe('migrateToBlockNote', () => {
    it('should convert paragraph node', () => {
      const tiptap = {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Hello' }] }
        ]
      };
      const result = migrateToBlockNote(tiptap);
      expect(result[0].type).toBe('paragraph');
      expect(result[0].content[0].text).toBe('Hello');
    });

    it('should convert heading node', () => {
      const tiptap = {
        type: 'doc',
        content: [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Title' }] }
        ]
      };
      const result = migrateToBlockNote(tiptap);
      expect(result[0].type).toBe('heading');
      expect(result[0].props.level).toBe(2);
      expect(result[0].content[0].text).toBe('Title');
    });

    it('should convert blockquote to quote block (not paragraph)', () => {
      const tiptap = {
        type: 'doc',
        content: [
          {
            type: 'blockquote',
            content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Quote text' }] }]
          }
        ]
      };
      const result = migrateToBlockNote(tiptap);
      expect(result[0].type).toBe('quote');
      expect(result[0].content[0].text).toBe('Quote text');
    });

    it('should convert horizontalRule to a paragraph separator (not the invalid divider type)', () => {
      const tiptap = {
        type: 'doc',
        content: [{ type: 'horizontalRule' }]
      };
      const result = migrateToBlockNote(tiptap);
      // NOTE: 'divider' is NOT in BlockNote's default schema — using it crashes with
      // TypeError: Cannot read properties of undefined (reading 'isInGroup')
      // We map to a paragraph with a visual separator character instead.
      expect(result[0].type).toBe('paragraph');
      expect(result[0].content[0].text).toContain('─');
    });

    it('should convert image node to image block', () => {
      const tiptap = {
        type: 'doc',
        content: [
          { type: 'image', attrs: { src: 'https://example.com/img.png', alt: 'Test' } }
        ]
      };
      const result = migrateToBlockNote(tiptap);
      expect(result[0].type).toBe('image');
      expect(result[0].props.url).toBe('https://example.com/img.png');
    });

    it('should convert codeBlock with language', () => {
      const tiptap = {
        type: 'doc',
        content: [
          { type: 'codeBlock', attrs: { language: 'javascript' }, content: [{ type: 'text', text: 'console.log("hi")' }] }
        ]
      };
      const result = migrateToBlockNote(tiptap);
      expect(result[0].type).toBe('codeBlock');
      expect(result[0].props.language).toBe('javascript');
      expect(result[0].content[0].text).toBe('console.log("hi")');
    });

    it('should convert bulletList to bulletListItem', () => {
      const tiptap = {
        type: 'doc',
        content: [
          {
            type: 'bulletList',
            content: [
              { type: 'listItem', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Item 1' }] }] }
            ]
          }
        ]
      };
      const result = migrateToBlockNote(tiptap);
      expect(result[0].type).toBe('bulletListItem');
      expect(result[0].content[0].text).toBe('Item 1');
    });

    it('should convert bold text with marks', () => {
      const tiptap = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Bold', marks: [{ type: 'bold' }] }]
          }
        ]
      };
      const result = migrateToBlockNote(tiptap);
      expect(result[0].content[0].styles.bold).toBe(true);
    });

    it('should convert link marks', () => {
      const tiptap = {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Link', marks: [{ type: 'link', attrs: { href: 'https://test.com' } }] }]
          }
        ]
      };
      const result = migrateToBlockNote(tiptap);
      expect(result[0].content[0].styles.link).toBe('https://test.com');
    });

    it('should preserve original payload in fallback when migration crashes (M27)', () => {
      // Pass something that has content but will crash (e.g., content is not an array)
      const tiptapCrash = { type: 'doc', content: {} as any };
      const result = migrateToBlockNote(tiptapCrash);
      
      expect(result[0].type).toBe('paragraph');
      expect(result[0].content[0].text).toContain('Error migrating content');
      expect(result[0].props._backup).toBe(JSON.stringify(tiptapCrash));
    });
  });

  describe('migrateToTiPTap', () => {
    it('should convert paragraph block', () => {
      const blocknote = [
        { id: '1', type: 'paragraph', props: {}, content: [{ type: 'text', text: 'Hello', styles: {} }], children: [] }
      ];
      const result = migrateToTiPTap(blocknote);
      expect(result.type).toBe('doc');
      expect(result.content[0].type).toBe('paragraph');
      expect(result.content[0].content[0].text).toBe('Hello');
    });

    it('should convert heading block', () => {
      const blocknote = [
        { id: '1', type: 'heading', props: { level: 3 }, content: [{ type: 'text', text: 'Title', styles: {} }], children: [] }
      ];
      const result = migrateToTiPTap(blocknote);
      expect(result.content[0].type).toBe('heading');
      expect(result.content[0].attrs.level).toBe(3);
    });

    it('should convert quote block to blockquote', () => {
      const blocknote = [
        { id: '1', type: 'quote', props: {}, content: [{ type: 'text', text: 'Quote', styles: {} }], children: [] }
      ];
      const result = migrateToTiPTap(blocknote);
      expect(result.content[0].type).toBe('blockquote');
    });

    it('should convert divider to horizontalRule', () => {
      const blocknote = [
        { id: '1', type: 'divider', props: {}, content: [], children: [] }
      ];
      const result = migrateToTiPTap(blocknote);
      expect(result.content[0].type).toBe('horizontalRule');
    });

    it('should convert image block to image node', () => {
      const blocknote = [
        { id: '1', type: 'image', props: { url: 'https://example.com/img.png', caption: 'Test' }, content: [], children: [] }
      ];
      const result = migrateToTiPTap(blocknote);
      expect(result.content[0].type).toBe('image');
      expect(result.content[0].attrs.src).toBe('https://example.com/img.png');
    });

    it('should convert codeBlock with language', () => {
      const blocknote = [
        { id: '1', type: 'codeBlock', props: { language: 'python' }, content: [{ type: 'text', text: 'print("hi")', styles: {} }], children: [] }
      ];
      const result = migrateToTiPTap(blocknote);
      expect(result.content[0].type).toBe('codeBlock');
      expect(result.content[0].attrs.language).toBe('python');
    });

    it('should convert bold styles to marks', () => {
      const blocknote = [
        { id: '1', type: 'paragraph', props: {}, content: [{ type: 'text', text: 'Bold', styles: { bold: true } }], children: [] }
      ];
      const result = migrateToTiPTap(blocknote);
      expect(result.content[0].content[0].marks[0].type).toBe('bold');
    });

    it('should convert link styles to link marks', () => {
      const blocknote = [
        { id: '1', type: 'paragraph', props: {}, content: [{ type: 'text', text: 'Link', styles: { link: 'https://test.com' } }], children: [] }
      ];
      const result = migrateToTiPTap(blocknote);
      expect(result.content[0].content[0].marks[0].type).toBe('link');
      expect(result.content[0].content[0].marks[0].attrs.href).toBe('https://test.com');
    });

    it('should convert bulletListItem to a bulletList wrapping a listItem', () => {
      const blocknote = [
        { id: '1', type: 'bulletListItem', props: {}, content: [{ type: 'text', text: 'Item', styles: {} }], children: [] }
      ];
      const result = migrateToTiPTap(blocknote);
      // bulletListItem gets grouped into a bulletList by the post-processor
      expect(result.content[0].type).toBe('bulletList');
      expect(result.content[0].content[0].type).toBe('listItem');
    });

    it('should convert checkListItem to a taskList wrapping a taskItem', () => {
      const blocknote = [
        { id: '1', type: 'checkListItem', props: { checked: true }, content: [{ type: 'text', text: 'Done', styles: {} }], children: [] }
      ];
      const result = migrateToTiPTap(blocknote);
      expect(result.content[0].type).toBe('taskList');
      expect(result.content[0].content[0].type).toBe('taskItem');
      expect(result.content[0].content[0].attrs.checked).toBe(true);
    });

    it('should handle undefined content gracefully', () => {
      const blocknoteWithUndefined = [{ type: 'paragraph', content: undefined as any }];
      const result = migrateToTiPTap(blocknoteWithUndefined);
      
      expect(result.type).toBe('doc');
      expect(result.content).toBeDefined();
    });

    it('should handle invalid blocks (not an array) with early return', () => {
      const blocknoteCrash = {} as any[];
      const result = migrateToTiPTap(blocknoteCrash);
      
      expect(result.type).toBe('doc');
      expect(result.content).toEqual([]);
    });
  });

  describe('Round-trip conversion', () => {
    it('should preserve text through Tiptap -> BlockNote -> Tiptap conversion', () => {
      const original = {
        type: 'doc',
        content: [
          { type: 'paragraph', content: [{ type: 'text', text: 'Test content' }] },
          { type: 'heading', attrs: { level: 1 }, content: [{ type: 'text', text: 'Header' }] }
        ]
      };

      const blocknote = migrateToBlockNote(original);
      const backToTiptap = migrateToTiPTap(blocknote);

      expect(backToTiptap.content[0].type).toBe('paragraph');
      expect(backToTiptap.content[0].content[0].text).toBe('Test content');
      expect(backToTiptap.content[1].type).toBe('heading');
      expect(backToTiptap.content[1].content[0].text).toBe('Header');
    });

    it('should preserve image through Tiptap -> BlockNote -> Tiptap conversion', () => {
      const original = {
        type: 'doc',
        content: [
          { type: 'image', attrs: { src: 'https://example.com/photo.jpg', alt: 'Photo' } }
        ]
      };

      const blocknote = migrateToBlockNote(original);
      expect(blocknote[0].type).toBe('image');
      expect(blocknote[0].props.url).toBe('https://example.com/photo.jpg');

      const backToTiptap = migrateToTiPTap(blocknote);
      expect(backToTiptap.content[0].type).toBe('image');
      expect(backToTiptap.content[0].attrs.src).toBe('https://example.com/photo.jpg');
    });

    it('should preserve blockquote through BlockNote -> Tiptap -> BlockNote conversion', () => {
      const original = [
        { id: '1', type: 'quote', props: {}, content: [{ type: 'text', text: 'Quote text', styles: {} }], children: [] }
      ];

      const tiptap = migrateToTiPTap(original);
      expect(tiptap.content[0].type).toBe('blockquote');

      const backToBlockNote = migrateToBlockNote(tiptap);
      expect(backToBlockNote[0].type).toBe('quote');
      expect(backToBlockNote[0].content[0].text).toBe('Quote text');
    });

    it('should preserve divider through BlockNote -> Tiptap -> BlockNote conversion', () => {
      const original = [
        { id: '1', type: 'divider', props: {}, content: [], children: [] }
      ];

      const tiptap = migrateToTiPTap(original);
      // 'divider' BN block (if stored from old data) -> Tiptap horizontalRule
      expect(tiptap.content[0].type).toBe('horizontalRule');

      const backToBlockNote = migrateToBlockNote(tiptap);
      // horizontalRule comes back as a paragraph separator (safe – no isInGroup crash)
      expect(backToBlockNote[0].type).toBe('paragraph');
      expect(backToBlockNote[0].content[0].text).toContain('─');
    });
  });
});

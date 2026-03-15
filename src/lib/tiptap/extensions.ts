import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import TaskList from '@tiptap/extension-task-list';
import { CustomTaskItem } from './TaskItemExtension';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { CustomTableCell, CustomTableHeader } from './TableExtensions';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import Color from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import Superscript from '@tiptap/extension-superscript';
import Subscript from '@tiptap/extension-subscript';
import { ColumnsExtension, ColumnExtension } from './ColumnsExtension';
import SlashCommand from './SlashCommandExtension';
import { CalloutExtension } from './CalloutExtension';
import { ToggleExtension } from './ToggleExtension';
import { WikiLinkExtension } from './WikiLinkExtension';
import { SmartCodeExtension } from './SmartCodeExtension';
import { SmartNavigationExtension } from './SmartNavigationExtension';
import { TypographyExtensions } from './TypographyExtensions';
import { TableSortExtension } from './TableSortExtension';
import { TableTemplatesExtension } from './TableTemplatesExtension';
import { TableFormulaExtension } from './TableFormulaExtension';
import { BlockHandleExtension } from './BlockHandleExtension';

export function getEditorExtensions(placeholder = 'Type / for commands, or start typing…') {
  return [
    StarterKit.configure({
      codeBlock: false,
      heading: {
        levels: [1, 2, 3, 4, 5, 6],
      },
    }),
    Typography,
    Placeholder.configure({ placeholder }),
    TaskList,
    CustomTaskItem.configure({ nested: true }),
    Image.configure({ inline: false, allowBase64: true }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Table.configure({ resizable: true, HTMLAttributes: { class: 'tiptap-table' } }),
    TableRow,
    CustomTableCell,
    CustomTableHeader,
    Highlight.configure({ multicolor: true }),
    TextStyle,
    Color,
    Superscript,
    Subscript,
    CalloutExtension,
    ToggleExtension,
    ColumnsExtension,
    ColumnExtension,
    SlashCommand,
    WikiLinkExtension,
    SmartCodeExtension,
    SmartNavigationExtension,
    TypographyExtensions,
    TableSortExtension,
    TableTemplatesExtension,
    TableFormulaExtension,
    BlockHandleExtension,
  ];
}

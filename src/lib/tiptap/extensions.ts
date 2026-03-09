import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import Highlight from '@tiptap/extension-highlight';
import Underline from '@tiptap/extension-underline';
import Color from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import Superscript from '@tiptap/extension-superscript';
import Subscript from '@tiptap/extension-subscript';
import { common, createLowlight } from 'lowlight';
import SlashCommand from './SlashCommandExtension';
import { CalloutExtension } from './CalloutExtension';
import { ToggleExtension } from './ToggleExtension';
import { KaTeXExtension } from './KaTeXExtension';
import { ColumnsExtension, ColumnExtension } from './ColumnsExtension';
import {
  CaptionExtension,
  ProgressExtension,
  BadgeExtension,
  BookmarkExtension,
  AudioBlockExtension,
  VideoBlockExtension,
  FootnoteRefExtension,
  FootnoteItemExtension,
} from './CustomBlockExtensions';

const lowlight = createLowlight(common);

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
    CodeBlockLowlight.configure({ lowlight }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Image.configure({ inline: false, allowBase64: true }),
    Link.configure({ openOnClick: true, HTMLAttributes: { class: 'tiptap-link' } }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    Table.configure({ resizable: false, HTMLAttributes: { class: 'tiptap-table' } }),
    TableRow,
    TableCell,
    TableHeader,
    Highlight.configure({ multicolor: true }),
    Underline,
    TextStyle,
    Color,
    Superscript,
    Subscript,
    CalloutExtension,
    ToggleExtension,
    KaTeXExtension,
    ColumnsExtension,
    ColumnExtension,
    CaptionExtension,
    ProgressExtension,
    BadgeExtension,
    BookmarkExtension,
    AudioBlockExtension,
    VideoBlockExtension,
    FootnoteRefExtension,
    FootnoteItemExtension,
    SlashCommand,
  ];
}

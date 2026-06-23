import { StarterKit } from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import { CustomTable } from './CustomTable';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Placeholder from '@tiptap/extension-placeholder';
import Typography from '@tiptap/extension-typography';
import Highlight from '@tiptap/extension-highlight';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import TextAlign from '@tiptap/extension-text-align';
import CharacterCount from '@tiptap/extension-character-count';
import { Markdown } from 'tiptap-markdown';

import { Callout } from './Callout';
import { CustomCodeBlock } from './CustomCodeBlock';
import { EquationBlock } from './EquationBlock';
import { ImagePlaceholder } from './ImagePlaceholder';
import { HeadingWithId } from './HeadingWithId';
import { lowlight } from './lowlight';

export { lowlight } from './lowlight';

export let buildExtensions = () => [
  StarterKit.configure({
    codeBlock: false,
    heading: false,
    dropcursor: {
      color: '#0099ff',
      width: 3,
      class: 'editor-dropcursor'
    },
    link: {
      openOnClick: false,
      autolink: true,
      HTMLAttributes: {
        rel: 'noopener noreferrer nofollow',
        target: '_blank'
      }
    }
  }),

  HeadingWithId.configure({
    levels: [1, 2, 3, 4, 5, 6]
  }),

  CustomCodeBlock.configure({
    lowlight,
    defaultLanguage: 'plaintext'
  }),

  EquationBlock,

  Image.configure({
    inline: false,
    allowBase64: true,
    HTMLAttributes: {
      class: 'editor-image'
    }
  }),

  Highlight.configure({
    multicolor: false
  }),

  Subscript,
  Superscript,
  Typography,

  TextAlign.configure({
    types: ['heading', 'paragraph']
  }),

  CustomTable.configure({
    resizable: false,
    HTMLAttributes: {
      class: 'editor-table'
    }
  }),
  TableRow,
  TableHeader.extend({
    content: 'paragraph'
  }),
  TableCell.extend({
    content: 'paragraph'
  }),

  TaskList.configure({
    HTMLAttributes: {
      class: 'task-list'
    }
  }),
  TaskItem.configure({
    nested: true,
    HTMLAttributes: {
      class: 'task-item'
    }
  }),

  Placeholder.configure({
    placeholder: ({ node }) => {
      if (node.type.name === 'heading') {
        return `Heading ${node.attrs.level}`;
      }
      if (node.type.name === 'paragraph') {
        return "Type '/' for commands, or just start writing…";
      }
      return '';
    },
    showOnlyCurrent: true,
    includeChildren: false
  }),

  CharacterCount,

  Callout,
  ImagePlaceholder,

  Markdown.configure({
    html: true,
    tightLists: true,
    bulletListMarker: '-',
    linkify: true,
    breaks: false,
    transformPastedText: true,
    transformCopiedText: true
  })
];

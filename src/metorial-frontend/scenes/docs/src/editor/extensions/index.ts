import { StarterKit } from '@tiptap/starter-kit';
import '@tiptap/extension-blockquote';
import '@tiptap/extension-bold';
import '@tiptap/extension-bullet-list';
import '@tiptap/extension-code';
import '@tiptap/extension-horizontal-rule';
import '@tiptap/extension-italic';
import '@tiptap/extension-link';
import '@tiptap/extension-ordered-list';
import '@tiptap/extension-paragraph';
import '@tiptap/extension-strike';
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
import Underline from '@tiptap/extension-underline';
import CharacterCount from '@tiptap/extension-character-count';
import Collaboration from '@tiptap/extension-collaboration';
import { Markdown } from 'tiptap-markdown';
import type { Awareness } from 'y-protocols/awareness';
import type { Doc as YDoc } from 'yjs';

import { Callout } from './Callout';
import { CustomCodeBlock } from './CustomCodeBlock';
import { EquationBlock } from './EquationBlock';
import { ImagePlaceholder } from './ImagePlaceholder';
import { HeadingWithId } from './HeadingWithId';
import { lowlight } from './lowlight';
import { RemoteCursorOverlay } from './RemoteCursorOverlay';

export { lowlight } from './lowlight';

export let buildExtensions = (opts?: {
  collaboration?: {
    ydoc: YDoc;
    awareness: Awareness;
    user: {
      name: string;
      color: string;
      imageUrl?: string;
    };
    onFirstRender?: () => void;
  };
}) => [
  StarterKit.configure({
    codeBlock: false,
    heading: false,
    undoRedo: opts?.collaboration ? false : undefined,
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

  Underline,
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

  ...(opts?.collaboration
    ? [
        Collaboration.configure({
          document: opts.collaboration.ydoc,
          field: 'body',
          onFirstRender: opts.collaboration.onFirstRender
        }),
        RemoteCursorOverlay({
          awareness: opts.collaboration.awareness,
          user: opts.collaboration.user
        })
      ]
    : []),

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

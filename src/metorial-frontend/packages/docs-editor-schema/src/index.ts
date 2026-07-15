import { Editor, Node, mergeAttributes } from '@tiptap/core';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Heading from '@tiptap/extension-heading';
import Image from '@tiptap/extension-image';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import { Table } from '@tiptap/extension-table';
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
import { StarterKit } from '@tiptap/starter-kit';
import {
  prosemirrorJSONToYXmlFragment,
  yXmlFragmentToProsemirrorJSON
} from '@tiptap/y-tiptap';
import { createLowlight } from 'lowlight';
import { Markdown } from 'tiptap-markdown';
import * as Y from 'yjs';

export type CalloutType = 'info' | 'warning' | 'success' | 'danger';

let VALID_CALLOUT_TYPES: CalloutType[] = ['info', 'warning', 'success', 'danger'];

let isCalloutType = (value: string | null | undefined): value is CalloutType =>
  !!value && VALID_CALLOUT_TYPES.includes(value as CalloutType);

let escapeHtml = (input: string) =>
  input.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

export let Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      type: {
        default: 'info',
        parseHTML: element => {
          let tag = element.tagName.toLowerCase();
          if (isCalloutType(tag)) return tag;
          let attr = element.getAttribute('data-callout-type');
          return isCalloutType(attr) ? attr : 'info';
        },
        renderHTML: attrs => ({
          'data-callout-type': (attrs as { type?: string }).type ?? 'info'
        })
      }
    };
  },

  parseHTML() {
    return [
      ...VALID_CALLOUT_TYPES.map(type => ({ tag: type })),
      { tag: 'div[data-callout-type]' }
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'callout' }), 0];
  },

  addStorage() {
    return {
      markdown: {
        serialize(
          state: {
            write: (text: string) => void;
            ensureNewLine: () => void;
            renderContent: (node: unknown) => void;
            closeBlock: (node: unknown) => void;
          },
          node: { attrs: { type?: CalloutType } }
        ) {
          let type = (node.attrs.type ?? 'info') as CalloutType;
          state.write(`<${type}>\n\n`);
          state.renderContent(node);
          state.ensureNewLine();
          state.write(`</${type}>`);
          state.closeBlock(node);
        },
        parse: {}
      }
    };
  }
});

export let EquationBlock = Node.create({
  name: 'equationBlock',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      latex: {
        default: '',
        parseHTML: element => element.getAttribute('data-latex') ?? element.textContent ?? '',
        renderHTML: () => ({})
      }
    };
  },

  parseHTML() {
    return [{ tag: 'equation' }, { tag: 'div[data-equation-block]' }];
  },

  renderHTML({ HTMLAttributes, node }) {
    let latex = (node.attrs.latex as string | null) ?? '';
    return [
      'equation',
      mergeAttributes(HTMLAttributes, {
        'data-equation-block': 'true',
        'data-latex': latex
      }),
      latex
    ];
  },

  addStorage() {
    return {
      markdown: {
        serialize(
          state: {
            write: (text: string) => void;
            closeBlock: (node: unknown) => void;
          },
          node: { attrs: { latex?: string } }
        ) {
          state.write(`<equation>${escapeHtml(node.attrs.latex ?? '')}</equation>`);
          state.closeBlock(node);
        },
        parse: {}
      }
    };
  }
});

export let ImagePlaceholder = Node.create({
  name: 'imagePlaceholder',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addStorage() {
    return {
      pendingFiles: new Map<string, unknown>(),
      markdown: {
        serialize(state: { closeBlock: (node: unknown) => void }, node: unknown) {
          state.closeBlock(node);
        },
        parse: {}
      }
    };
  },

  addAttributes() {
    return {
      id: {
        default: '',
        parseHTML: el => el.getAttribute('data-id') ?? '',
        renderHTML: attrs => ({
          'data-id': (attrs as { id?: string }).id ?? ''
        })
      },
      fileName: {
        default: null,
        parseHTML: el => el.getAttribute('data-file-name'),
        renderHTML: attrs => {
          let v = (attrs as { fileName?: string | null }).fileName;
          return v ? { 'data-file-name': v } : {};
        }
      },
      autoUpload: {
        default: false,
        parseHTML: () => false,
        renderHTML: () => ({})
      },
      pendingFileKey: {
        default: null,
        parseHTML: () => null,
        renderHTML: () => ({})
      },
      status: {
        default: 'idle',
        parseHTML: () => 'idle',
        renderHTML: () => ({})
      },
      errorMessage: {
        default: null,
        parseHTML: () => null,
        renderHTML: () => ({})
      }
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-image-placeholder]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-image-placeholder': 'true' })];
  }
});

let lowlight = createLowlight();

export let buildHeadlessExtensions = (opts?: {
  collaboration?: {
    ydoc: Y.Doc;
    field?: string;
  };
}) => [
  StarterKit.configure({
    codeBlock: false,
    heading: false,
    underline: false,
    undoRedo: opts?.collaboration ? false : undefined,
    dropcursor: false,
    link: {
      openOnClick: false,
      autolink: true,
      HTMLAttributes: {
        rel: 'noopener noreferrer nofollow',
        target: '_blank'
      }
    }
  }),
  CodeBlockLowlight.configure({
    lowlight,
    defaultLanguage: 'plaintext'
  }),
  Heading.configure({
    levels: [1, 2, 3, 4, 5, 6]
  }),
  Image.configure({
    inline: false,
    allowBase64: true,
    HTMLAttributes: {
      class: 'editor-image'
    }
  }),
  Highlight.configure({ multicolor: false }),
  Underline,
  Subscript,
  Superscript,
  Typography,
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  Table.configure({
    resizable: false,
    HTMLAttributes: {
      class: 'editor-table'
    }
  }),
  TableRow,
  TableHeader.extend({ content: 'paragraph' }),
  TableCell.extend({ content: 'paragraph' }),
  TaskList.configure({ HTMLAttributes: { class: 'task-list' } }),
  TaskItem.configure({ nested: true, HTMLAttributes: { class: 'task-item' } }),
  Placeholder.configure({
    placeholder: ({ node }) => {
      if (node.type.name === 'heading') return `Heading ${node.attrs.level}`;
      if (node.type.name === 'paragraph')
        return "Type '/' for commands, or just start writing...";
      return '';
    },
    showOnlyCurrent: true,
    includeChildren: false
  }),
  CharacterCount,
  Callout,
  EquationBlock,
  ImagePlaceholder,
  ...(opts?.collaboration
    ? [
        Collaboration.configure({
          document: opts.collaboration.ydoc,
          field: opts.collaboration.field ?? 'body'
        })
      ]
    : []),
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

export let encodeYjsUpdate = (update: Uint8Array) => {
  let binary = '';
  let chunkSize = 0x8000;
  for (let i = 0; i < update.length; i += chunkSize) {
    binary += String.fromCharCode(...update.subarray(i, i + chunkSize));
  }
  return btoa(binary);
};

export let decodeYjsUpdate = (update: string) => {
  let binary = atob(update);
  let bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

export let markdownToYjsUpdate = (markdown: string, origin?: unknown) => {
  if (markdown.trim().length === 0) return null;

  let ydoc = new Y.Doc();
  let body = ydoc.getXmlFragment('body');
  let editor = new Editor({
    extensions: buildHeadlessExtensions(),
    content: markdown,
    editable: false
  });

  try {
    ydoc.transact(() => {
      prosemirrorJSONToYXmlFragment(editor.schema, editor.getJSON(), body);
    }, origin);
    return body.length > 0 ? encodeYjsUpdate(Y.encodeStateAsUpdate(ydoc)) : null;
  } finally {
    editor.destroy();
    ydoc.destroy();
  }
};

export let yjsUpdateToMarkdown = (update: string) => {
  let ydoc = new Y.Doc();
  try {
    Y.applyUpdate(ydoc, decodeYjsUpdate(update));
    let body = ydoc.getXmlFragment('body');
    let json = yXmlFragmentToProsemirrorJSON(body);
    let editor = new Editor({
      extensions: buildHeadlessExtensions(),
      content: json,
      editable: false
    });

    try {
      return (
        (
          editor.storage as {
            markdown?: { getMarkdown: () => string };
          }
        ).markdown?.getMarkdown() ?? ''
      );
    } finally {
      editor.destroy();
    }
  } finally {
    ydoc.destroy();
  }
};

export let yjsUpdateToDocumentSnapshot = (update: string) => {
  let ydoc = new Y.Doc();
  try {
    Y.applyUpdate(ydoc, decodeYjsUpdate(update));
    let meta = ydoc.getMap<string>('meta');
    return {
      title: meta.get('title'),
      frontMatter: meta.get('frontMatter'),
      body: yjsUpdateToMarkdown(update)
    };
  } finally {
    ydoc.destroy();
  }
};

export let composeFullMarkdown = (d: {
  frontMatter?: string;
  title?: string;
  body: string;
}) => {
  let parts: string[] = [];
  let frontMatter = d.frontMatter?.trim();
  let title = d.title?.trim();
  let body = d.body.trim();

  if (frontMatter) {
    parts.push(`---\n${frontMatter}\n---`);
  }
  if (title) {
    parts.push(`# ${title}`);
  }
  if (body) {
    parts.push(body);
  }

  return parts.join('\n\n').trimEnd();
};

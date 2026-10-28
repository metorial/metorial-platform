import { Editor, Node, getSchema, mergeAttributes } from '@tiptap/core';
import { Fragment, type Schema } from '@tiptap/pm/model';
import { EditorState, type Transaction } from '@tiptap/pm/state';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import HardBreak from '@tiptap/extension-hard-break';
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
  initProseMirrorDoc,
  prosemirrorJSONToYXmlFragment,
  updateYFragment,
  yXmlFragmentToProsemirrorJSON
} from '@tiptap/y-tiptap';
import { createLowlight } from 'lowlight';
import { Markdown } from 'tiptap-markdown';
import * as Y from 'yjs';
import { CommentThreadMark, DocumentAnnotationAttributes } from './annotationSchema';
import {
  addCommentThreadMark,
  alignAnnotationsToTexts,
  applyAnnotationModel,
  createDocumentBody,
  encodeAnnotationModel,
  getTextblockTexts,
  modelFromDoc,
  readStoredAnnotations,
  reconcileAnnotationModel,
  removeCommentThreadMark,
  type DocumentAnnotations,
  type DocumentBody,
  type DocumentCommentAnchor
} from './annotations';
import {
  hardBreakMarkdownSpec,
  htmlMarkMarkdownSpec,
  tableMarkdownSpec
} from './markdownHtml';

export * from './annotationGuard';
export * from './annotationSchema';
export {
  addCommentThreadMark,
  alignAnnotationsToTexts,
  alignSequences,
  applyAnnotationModel,
  applyEditorChange,
  areAnnotationCommentsEqual,
  areDocumentBodiesEqual,
  collectTextblocks,
  getAnnotationsBlockEditors,
  getAnnotationsCommentThreadIds,
  getChangeRatio,
  getCommentAnchorForRange,
  getTextblockTexts,
  hashText,
  isAnnotatedTextblock,
  isDocumentAnnotations,
  modelFromDoc,
  posToTextOffset,
  readStoredAnnotations,
  removeCommentThreadMark,
  resolveCommentAnchor,
  textOffsetToPos,
  withCommentAnchor,
  withoutCommentAnchor
} from './annotations';
export type {
  AnnotationModel,
  DocumentAnnotationBlock,
  DocumentAnnotationComment,
  DocumentAnnotations,
  DocumentBody,
  DocumentCommentAnchor,
  Textblock
} from './annotations';

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
          let type = isCalloutType(node.attrs.type) ? node.attrs.type : 'info';
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

export type AgentBlockStatus = 'idle' | 'running' | 'review' | 'error';

let dataAttribute = (name: string, fallback: unknown) => ({
  default: fallback,
  parseHTML: (element: HTMLElement) => element.getAttribute(`data-${name}`) ?? fallback,
  renderHTML: (attrs: Record<string, unknown>) => {
    let key = name.replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase());
    let value = attrs[key];
    return value == null || value === '' ? {} : { [`data-${name}`]: String(value) };
  }
});

export let agentBlockNodeName = 'agentBlock';

export let AgentBlock = Node.create({
  name: agentBlockNodeName,
  group: 'block',
  content: 'block+',
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      blockId: dataAttribute('block-id', null),
      mode: dataAttribute('mode', 'block'),
      status: dataAttribute('status', 'idle'),
      prompt: dataAttribute('prompt', '')
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-agent-block]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-agent-block': 'true' }), 0];
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: { renderContent: (node: unknown) => void }, node: unknown) {
          state.renderContent(node);
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

let withMarkdownSpec = <T extends { extend: (config: any) => T }>(
  extension: T,
  markdown: unknown
) =>
  extension.extend({
    addStorage(this: { parent?: () => Record<string, unknown> }) {
      return { ...this.parent?.(), markdown };
    }
  });

export let buildHeadlessExtensions = (opts?: {
  collaboration?: {
    ydoc: Y.Doc;
    field?: string;
  };
}) => [
  StarterKit.configure({
    codeBlock: false,
    heading: false,
    hardBreak: false,
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
  withMarkdownSpec(HardBreak, hardBreakMarkdownSpec),
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
  withMarkdownSpec(Highlight, htmlMarkMarkdownSpec).configure({ multicolor: false }),
  withMarkdownSpec(Underline, htmlMarkMarkdownSpec),
  withMarkdownSpec(Subscript, htmlMarkMarkdownSpec),
  withMarkdownSpec(Superscript, htmlMarkMarkdownSpec),
  Typography,
  TextAlign.configure({ types: ['heading', 'paragraph'] }),
  withMarkdownSpec(Table, tableMarkdownSpec).configure({
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
  AgentBlock,
  DocumentAnnotationAttributes,
  CommentThreadMark,
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

let headlessSchema: Schema | undefined;

let getHeadlessSchema = () => {
  headlessSchema ??= getSchema(buildHeadlessExtensions());
  return headlessSchema;
};

let createMarkdownEditor = (markdown: string) =>
  new Editor({
    extensions: buildHeadlessExtensions(),
    content: markdown,
    editable: false
  });

let getAnnotatedDocJSON = (editor: Editor, annotations?: DocumentAnnotations | null) => {
  let tr = editor.state.tr;
  let model = alignAnnotationsToTexts(annotations ?? null, getTextblockTexts(tr.doc));
  applyAnnotationModel(tr, model);

  return tr.doc.toJSON();
};

export let markdownToYjsUpdate = (
  markdown: string,
  origin?: unknown,
  annotations?: DocumentAnnotations | null
) => {
  if (markdown.trim().length === 0) return null;

  let ydoc = new Y.Doc();
  let body = ydoc.getXmlFragment('body');
  let editor = createMarkdownEditor(markdown);

  try {
    let json = getAnnotatedDocJSON(editor, annotations);

    ydoc.transact(() => {
      prosemirrorJSONToYXmlFragment(editor.schema, json, body);
    }, origin);

    return body.length > 0 ? encodeYjsUpdate(Y.encodeStateAsUpdate(ydoc)) : null;
  } finally {
    editor.destroy();
    ydoc.destroy();
  }
};

export let replaceYjsBodyFromMarkdown = (d: {
  ydoc: Y.Doc;
  markdown: string;
  origin?: unknown;
  annotations?: DocumentAnnotations | null;
}) => {
  let body = d.ydoc.getXmlFragment('body');
  let editor = createMarkdownEditor(d.markdown);

  try {
    let json = getAnnotatedDocJSON(editor, d.annotations);

    d.ydoc.transact(() => {
      if (body.length > 0) body.delete(0, body.length);
      prosemirrorJSONToYXmlFragment(editor.schema, json, body);
    }, d.origin);
  } finally {
    editor.destroy();
  }
};

let splitStoredFrontMatter = (content: string) => {
  let input = content.replace(/^\uFEFF/, '');
  let match = input.match(/^---\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)\r?\n?/);
  if (!match) return { frontMatter: undefined, body: input };

  return {
    frontMatter: (match[1] ?? '').trim(),
    body: input.slice(match[0].length)
  };
};

let stripMatchingStoredTitle = (body: string, title: string) => {
  let match = body.match(/^\s*#\s+([^\r\n]+)(?:\r?\n|$)/);
  if (!match) return body;
  if ((match[1] ?? '').trim() !== title.trim()) return body;

  return body.slice(match[0].length).replace(/^\s+/, '');
};

export let getDocumentBodyMarkdown = (d: { content: string; title: string }) => {
  let { frontMatter, body } = splitStoredFrontMatter(d.content);
  return {
    frontMatter,
    body: stripMatchingStoredTitle(body, d.title)
  };
};

let getMarkdownTextblockTexts = (markdown: string) => {
  let editor = createMarkdownEditor(markdown);

  try {
    return getTextblockTexts(editor.state.doc);
  } finally {
    editor.destroy();
  }
};

export let reconcileDocumentBody = (d: {
  previous: { content: string; title: string; annotations: unknown } | null;
  next: { content: string; title: string };
  actorIds: string[];
}): DocumentBody => {
  let stored = d.previous ? readStoredAnnotations(d.previous) : null;
  let isSameContent =
    !!d.previous && d.previous.content === d.next.content && d.previous.title === d.next.title;

  if (isSameContent && stored?.status === 'verified') {
    return createDocumentBody(d.next.content, stored.annotations);
  }

  let previousTexts = d.previous
    ? getMarkdownTextblockTexts(getDocumentBodyMarkdown(d.previous).body)
    : [];
  let nextTexts = isSameContent
    ? previousTexts
    : getMarkdownTextblockTexts(getDocumentBodyMarkdown(d.next).body);

  let model = reconcileAnnotationModel({
    previous: alignAnnotationsToTexts(stored?.annotations ?? null, previousTexts),
    texts: nextTexts,
    actorIds: d.actorIds
  });

  return createDocumentBody(d.next.content, encodeAnnotationModel(model));
};

export let yjsUpdateToDocumentBody = (
  update: string,
  fallback: { title: string; frontMatter?: string }
) => {
  let ydoc = new Y.Doc();

  try {
    Y.applyUpdate(ydoc, decodeYjsUpdate(update));

    let meta = ydoc.getMap<string>('meta');
    let editor = new Editor({
      extensions: buildHeadlessExtensions(),
      content: yXmlFragmentToProsemirrorJSON(ydoc.getXmlFragment('body')),
      editable: false
    });

    try {
      let markdown =
        (
          editor.storage as { markdown?: { getMarkdown: () => string } }
        ).markdown?.getMarkdown() ?? '';
      let title = meta.get('title') ?? fallback.title;
      let frontMatter = meta.get('frontMatter') ?? fallback.frontMatter;
      let content = composeFullMarkdown({ frontMatter, title, body: markdown });

      return {
        title,
        frontMatter,
        body: createDocumentBody(
          content,
          encodeAnnotationModel(modelFromDoc(editor.state.doc))
        )
      };
    } finally {
      editor.destroy();
    }
  } finally {
    ydoc.destroy();
  }
};

let transformYjsBody = <T>(stateUpdate: string, transform: (tr: Transaction) => T | null) => {
  let ydoc = new Y.Doc();

  try {
    Y.applyUpdate(ydoc, decodeYjsUpdate(stateUpdate));

    let fragment = ydoc.getXmlFragment('body');
    let { doc, meta } = initProseMirrorDoc(fragment, getHeadlessSchema());
    let tr = EditorState.create({ doc }).tr;

    let result = transform(tr);
    if (result === null || !tr.docChanged) return null;

    let stateVector = Y.encodeStateVector(ydoc);
    updateYFragment(ydoc, fragment, tr.doc, meta);

    return {
      result,
      update: encodeYjsUpdate(Y.encodeStateAsUpdate(ydoc, stateVector))
    };
  } finally {
    ydoc.destroy();
  }
};

export let applyCommentAnchorToYjsUpdate = (d: {
  stateUpdate: string;
  threadId: string;
  anchor: DocumentCommentAnchor;
}) => {
  let transformed = transformYjsBody(d.stateUpdate, tr =>
    addCommentThreadMark({ tr, threadId: d.threadId, anchor: d.anchor })
  );
  if (!transformed) return null;

  return { update: transformed.update, quote: transformed.result.quote };
};

export let removeCommentAnchorFromYjsUpdate = (d: {
  stateUpdate: string;
  threadId: string;
}) => {
  let transformed = transformYjsBody(d.stateUpdate, tr =>
    removeCommentThreadMark({ tr, threadId: d.threadId }) ? true : null
  );

  return transformed ? { update: transformed.update } : null;
};

export let getYjsBodyAnnotationModel = (stateUpdate: string | Uint8Array) => {
  let ydoc = new Y.Doc();

  try {
    Y.applyUpdate(
      ydoc,
      typeof stateUpdate == 'string' ? decodeYjsUpdate(stateUpdate) : stateUpdate
    );

    let { doc } = initProseMirrorDoc(ydoc.getXmlFragment('body'), getHeadlessSchema());
    return modelFromDoc(doc);
  } finally {
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

export type YjsDocumentBlock = {
  ref: string;
  index: number;
  type: string;
  markdown: string;
};

type MarkdownSerializerStorage = {
  markdown?: {
    serializer: { serialize: (content: unknown) => string };
  };
};

export let encodeRelativePosition = (position: Y.RelativePosition) =>
  encodeYjsUpdate(Y.encodeRelativePosition(position));

export let decodeRelativePosition = (encoded: string) =>
  Y.decodeRelativePosition(decodeYjsUpdate(encoded));

export let createBlockRef = (body: Y.XmlFragment, index: number) =>
  encodeRelativePosition(Y.createRelativePositionFromTypeIndex(body, index));

let sameItem = (a: Y.RelativePosition, b: Y.RelativePosition) =>
  !!a.item && !!b.item && a.item.client == b.item.client && a.item.clock == b.item.clock;

export let resolveBlockRef = (d: { ydoc: Y.Doc; ref: string; field?: string }) => {
  let body = d.ydoc.getXmlFragment(d.field ?? 'body');
  let position = decodeRelativePosition(d.ref);
  let absolute = Y.createAbsolutePositionFromRelativePosition(position, d.ydoc);
  if (!absolute || absolute.type != body) return null;
  if (absolute.index >= body.length) return null;

  let current = Y.createRelativePositionFromTypeIndex(body, absolute.index);
  if (!sameItem(position, current)) return null;

  return { index: absolute.index };
};

export let yjsDocToBlocks = (ydoc: Y.Doc, field = 'body'): YjsDocumentBlock[] => {
  let body = ydoc.getXmlFragment(field);
  if (body.length == 0) return [];

  let json = yXmlFragmentToProsemirrorJSON(body);
  let editor = new Editor({
    extensions: buildHeadlessExtensions(),
    content: json,
    editable: false
  });

  try {
    let serializer = (editor.storage as MarkdownSerializerStorage).markdown?.serializer;
    let blocks: YjsDocumentBlock[] = [];

    editor.state.doc.forEach((node, _offset, index) => {
      blocks.push({
        ref: createBlockRef(body, index),
        index,
        type: node.type.name,
        markdown: (serializer?.serialize(Fragment.from(node)) ?? node.textContent).trim()
      });
    });

    return blocks;
  } finally {
    editor.destroy();
  }
};

export let yjsUpdateToBlocks = (update: string, field = 'body') => {
  let ydoc = new Y.Doc();
  try {
    Y.applyUpdate(ydoc, decodeYjsUpdate(update));
    return yjsDocToBlocks(ydoc, field);
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

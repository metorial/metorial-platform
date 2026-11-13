import { Extension, Mark, mergeAttributes } from '@tiptap/core';

export let PRIMARY_EDITOR_THRESHOLD = 0.6;
export let annotatedTextblockTypes = ['paragraph', 'heading', 'codeBlock'];
export let commentThreadMarkName = 'commentThread';

let blockIdAlphabet = 'abcdefghijklmnopqrstuvwxyz0123456789';
let blockIdLength = 12;

export let generateBlockId = () => {
  let bytes = new Uint8Array(blockIdLength);
  globalThis.crypto.getRandomValues(bytes);

  let id = '';
  for (let byte of bytes) id += blockIdAlphabet[byte % blockIdAlphabet.length];
  return id;
};

export let normalizeEditors = (value: unknown): string[] => {
  if (!Array.isArray(value)) return [];

  let seen = new Set<string>();
  let editors: string[] = [];

  for (let editor of value) {
    if (typeof editor !== 'string' || !editor || seen.has(editor)) continue;
    seen.add(editor);
    editors.push(editor);
  }

  return editors;
};

export let DocumentAnnotationAttributes = Extension.create({
  name: 'documentAnnotationAttributes',

  addGlobalAttributes() {
    return [
      {
        types: annotatedTextblockTypes,
        attributes: {
          blockId: {
            default: null,
            keepOnSplit: false,
            rendered: false,
            parseHTML: () => null
          },
          editors: {
            default: [],
            keepOnSplit: true,
            rendered: false,
            parseHTML: () => []
          }
        }
      }
    ];
  }
});

export let CommentThreadMark = Mark.create({
  name: commentThreadMarkName,
  inclusive: false,
  excludes: '',
  spanning: true,

  addAttributes() {
    return {
      threadId: {
        default: null,
        parseHTML: element => element.getAttribute('data-thread-id'),
        renderHTML: attrs => {
          let threadId = (attrs as { threadId?: string | null }).threadId;
          return threadId ? { 'data-thread-id': threadId } : {};
        }
      }
    };
  },

  parseHTML() {
    return [{ tag: 'span[data-comment-thread]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-comment-thread': 'true',
        class: 'docs-comment'
      }),
      0
    ];
  },

  addStorage() {
    return {
      markdown: {
        serialize: {
          open: '',
          close: '',
          mixable: true,
          expelEnclosingWhitespace: false
        },
        parse: {}
      }
    };
  }
});

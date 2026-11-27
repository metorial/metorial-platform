import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import type { Editor } from '@tiptap/core';
import { ImagePlaceholderView } from './ImagePlaceholderView';

export interface ImagePlaceholderAttrs {
  /** Stable client-side id used to find this placeholder across edits. */
  id: string;
  /** Original file name shown in the upload UI. */
  fileName?: string | null;
  /** Auto-start a file upload using the file at `pendingFileKey` when the
   *  NodeView mounts. Used for drag-and-drop. */
  autoUpload?: boolean;
  /** Key into the storage's pending-file map, when a file is queued. */
  pendingFileKey?: string | null;
  /** Lifecycle status. */
  status?: 'idle' | 'uploading' | 'error';
  /** Last error message, if `status === 'error'`. */
  errorMessage?: string | null;
}

/** Storage attached to the extension so the React NodeView and the
 *  drop handler can hand a `File` over to the placeholder without having
 *  to put it on a node attribute (attributes need to round-trip through
 *  JSON / HTML). */
export interface ImagePlaceholderStorage {
  pendingFiles: Map<string, File>;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    imagePlaceholder: {
      /** Insert a placeholder at the current selection. */
      insertImagePlaceholder: (attrs?: Partial<ImagePlaceholderAttrs>) => ReturnType;
      /** Replace the placeholder with the given id with a real image. */
      replaceImagePlaceholder: (args: { id: string; src: string; alt?: string }) => ReturnType;
      /** Remove a placeholder (e.g. when the user cancels). */
      removeImagePlaceholder: (id: string) => ReturnType;
    };
  }
}

/** Generate a short, sufficiently-unique id for placeholders. */
export function makePlaceholderId(): string {
  return `img-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/** Locate a placeholder node by its `id` attribute. */
export function findPlaceholder(
  editor: Editor,
  id: string
): { pos: number; nodeSize: number } | null {
  let result: { pos: number; nodeSize: number } | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (result) return false;
    if (node.type.name === 'imagePlaceholder' && node.attrs.id === id) {
      result = { pos, nodeSize: node.nodeSize };
      return false;
    }
    return true;
  });
  return result;
}

/** Stash a `File` in the extension's storage so the placeholder NodeView
 *  can pick it up on mount. Returns the lookup key. */
export function stashPendingFile(editor: Editor, file: File): string {
  let storage = (editor.storage as { imagePlaceholder?: ImagePlaceholderStorage })
    .imagePlaceholder;
  if (!storage) return '';
  let key = makePlaceholderId();
  storage.pendingFiles.set(key, file);
  return key;
}

/** Pull (and delete) a pending file from storage. */
export function takePendingFile(editor: Editor, key: string): File | null {
  let storage = (editor.storage as { imagePlaceholder?: ImagePlaceholderStorage })
    .imagePlaceholder;
  if (!storage) return null;
  let file = storage.pendingFiles.get(key) ?? null;
  if (file) storage.pendingFiles.delete(key);
  return file;
}

/* eslint-disable @typescript-eslint/no-explicit-any -- prosemirror state is loosely typed here. */
type SerializerState = {
  closeBlock: (node: any) => void;
};

export let ImagePlaceholder = Node.create({
  name: 'imagePlaceholder',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addOptions() {
    return {
      HTMLAttributes: {}
    };
  },

  addStorage() {
    return {
      pendingFiles: new Map<string, File>(),
      // Markdown serializer is a no-op: placeholders are intentionally
      // omitted from exported markdown so unsaved upload slots never leak
      // into a saved document.
      markdown: {
        serialize(state: SerializerState, node: any) {
          state.closeBlock(node);
        },
        parse: {}
      }
    } as ImagePlaceholderStorage & {
      markdown: {
        serialize: (state: SerializerState, node: any) => void;
        parse: Record<string, unknown>;
      };
    };
  },

  addAttributes() {
    return {
      id: {
        default: '',
        parseHTML: el => el.getAttribute('data-id') ?? '',
        renderHTML: attrs => ({
          'data-id': (attrs as ImagePlaceholderAttrs).id
        })
      },
      fileName: {
        default: null,
        parseHTML: el => el.getAttribute('data-file-name'),
        renderHTML: attrs => {
          let v = (attrs as ImagePlaceholderAttrs).fileName;
          return v ? { 'data-file-name': v } : {};
        }
      },
      // The remaining attrs are transient runtime state. We don't write
      // them to the DOM and we don't read them back — they only exist on
      // the in-memory node so the NodeView can react to changes.
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
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-image-placeholder': 'true'
      })
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImagePlaceholderView);
  },

  addCommands() {
    return {
      insertImagePlaceholder:
        (attrs = {}) =>
        ({ commands }) => {
          let id = attrs.id ?? makePlaceholderId();
          return commands.insertContent({
            type: this.name,
            attrs: {
              id,
              fileName: attrs.fileName ?? null,
              autoUpload: attrs.autoUpload ?? false,
              pendingFileKey: attrs.pendingFileKey ?? null,
              status: attrs.status ?? 'idle',
              errorMessage: null
            }
          });
        },

      replaceImagePlaceholder:
        ({ id, src, alt }) =>
        ({ tr, state, dispatch }) => {
          let target = findNodeById(state.doc, id);
          if (!target) return false;
          if (!dispatch) return true;

          let imageType = state.schema.nodes.image;
          if (!imageType) return false;

          let imageNode = imageType.create({ src, alt: alt ?? null });
          tr.replaceWith(target.pos, target.pos + target.nodeSize, imageNode);
          dispatch(tr);
          return true;
        },

      removeImagePlaceholder:
        id =>
        ({ tr, state, dispatch }) => {
          let target = findNodeById(state.doc, id);
          if (!target) return false;
          if (!dispatch) return true;
          tr.delete(target.pos, target.pos + target.nodeSize);
          dispatch(tr);
          return true;
        }
    };
  }
});

function findNodeById(
  doc: { descendants: (cb: (n: any, pos: number) => boolean | void) => void },
  id: string
): { pos: number; nodeSize: number } | null {
  let target: { pos: number; nodeSize: number } | null = null;
  doc.descendants((node, pos) => {
    if (target) return false;
    if (node.type?.name === 'imagePlaceholder' && node.attrs?.id === id) {
      target = { pos, nodeSize: node.nodeSize };
      return false;
    }
    return true;
  });
  return target;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

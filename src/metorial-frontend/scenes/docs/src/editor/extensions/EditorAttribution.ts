import { isAnnotatedTextblock, normalizeEditors } from '@metorial/docs-editor-schema';
import { Extension } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey, type Transaction } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { ySyncPluginKey } from '@tiptap/y-tiptap';
import {
  collectBlockTouches,
  computeAttributionUpdates,
  type BlockEditStats
} from '../attribution';

export type EditorAttributionOptions = {
  getActorId: () => string | null;
  getEditorColor: (actorId: string) => string;
};

type EditorAttributionState = {
  decorations: DecorationSet;
  showEditors: boolean;
};

type EditorAttributionMeta = { refresh?: boolean; showEditors?: boolean };

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    editorAttribution: {
      setShowEditors: (show: boolean) => ReturnType;
      refreshEditorAttribution: () => ReturnType;
    };
  }
}

export let editorAttributionKey = new PluginKey<EditorAttributionState>(
  'docsEditorAttribution'
);

let isRemoteTransaction = (tr: Transaction) =>
  !!(tr.getMeta(ySyncPluginKey) as { isChangeOrigin?: boolean } | undefined)?.isChangeOrigin;

let buildDecorations = (doc: ProseMirrorNode, getEditorColor: (actorId: string) => string) => {
  let decorations: Decoration[] = [];

  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    if (!isAnnotatedTextblock(node)) return false;

    let primary = normalizeEditors(node.attrs.editors)[0];
    if (!primary) return false;

    decorations.push(
      Decoration.node(pos, pos + node.nodeSize, {
        class: 'docs-attributed',
        'data-primary-editor': primary,
        style: `--editor-color: ${getEditorColor(primary)};`
      })
    );
    return false;
  });

  return DecorationSet.create(doc, decorations);
};

export let getBlockEditorsAtDom = (
  view: { posAtDOM: (node: Node, offset: number) => number; state: { doc: ProseMirrorNode } },
  element: HTMLElement
) => {
  let pos: number;
  try {
    pos = view.posAtDOM(element, 0);
  } catch {
    return null;
  }

  let $pos = view.state.doc.resolve(Math.min(pos, view.state.doc.content.size));
  for (let depth = $pos.depth; depth > 0; depth--) {
    let node = $pos.node(depth);
    if (node.isTextblock) return normalizeEditors(node.attrs.editors);
  }

  return null;
};

export let EditorAttribution = Extension.create<EditorAttributionOptions>({
  name: 'editorAttribution',

  addOptions() {
    return {
      getActorId: () => null,
      getEditorColor: () => 'transparent'
    };
  },

  addCommands() {
    return {
      setShowEditors:
        show =>
        ({ tr, dispatch }) => {
          dispatch?.(tr.setMeta(editorAttributionKey, { showEditors: show }));
          return true;
        },
      refreshEditorAttribution:
        () =>
        ({ tr, dispatch }) => {
          dispatch?.(tr.setMeta(editorAttributionKey, { refresh: true }));
          return true;
        }
    };
  },

  addProseMirrorPlugins() {
    let { getActorId, getEditorColor } = this.options;
    let editor = this.editor;
    let stats = new Map<string, BlockEditStats>();

    return [
      new Plugin<EditorAttributionState>({
        key: editorAttributionKey,

        state: {
          init: (_config, state) => ({
            decorations: buildDecorations(state.doc, getEditorColor),
            showEditors: false
          }),
          apply: (tr, previous, _oldState, newState) => {
            let meta = tr.getMeta(editorAttributionKey) as EditorAttributionMeta | undefined;
            let showEditors = meta?.showEditors ?? previous.showEditors;

            if (tr.docChanged || meta?.refresh) {
              return {
                decorations: buildDecorations(newState.doc, getEditorColor),
                showEditors
              };
            }

            return showEditors === previous.showEditors
              ? previous
              : { decorations: previous.decorations, showEditors };
          }
        },

        appendTransaction: (transactions, _oldState, newState) => {
          if (!editor.isEditable) return null;
          if (!transactions.some(tr => tr.docChanged)) return null;
          if (
            transactions.some(
              tr => isRemoteTransaction(tr) || tr.getMeta(editorAttributionKey)
            )
          ) {
            return null;
          }

          let updates = computeAttributionUpdates({
            doc: newState.doc,
            touches: collectBlockTouches(transactions),
            actorId: getActorId(),
            stats
          });
          if (!updates.length) return null;

          let tr = newState.tr;
          for (let update of updates) {
            let node = tr.doc.nodeAt(update.pos);
            if (!node) continue;

            tr.setNodeMarkup(update.pos, undefined, {
              ...node.attrs,
              blockId: update.blockId,
              editors: update.editors
            });
          }

          return tr.setMeta(editorAttributionKey, { refresh: true });
        },

        props: {
          decorations: state => editorAttributionKey.getState(state)?.decorations,
          attributes: (state): Record<string, string> =>
            editorAttributionKey.getState(state)?.showEditors
              ? { class: 'docs-show-editors' }
              : {}
        }
      })
    ];
  }
});

import { commentThreadMarkName } from '@metorial/docs-editor-schema';
import { Extension } from '@tiptap/core';
import { Fragment, Slice, type Node as ProseMirrorNode } from '@tiptap/pm/model';
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';

export type CommentHighlightsOptions = {
  onActivate: (threadId: string) => void;
};

export type CommentRange = { from: number; to: number };

type CommentHighlightsState = {
  visibleThreadIds: Set<string>;
  activeThreadId: string | null;
  pending: CommentRange | null;
  decorations: DecorationSet;
};

type CommentHighlightsMeta = {
  visibleThreadIds?: string[];
  activeThreadId?: string | null;
  pending?: CommentRange | null;
};

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    commentHighlights: {
      setCommentThreads: (threadIds: string[]) => ReturnType;
      setActiveCommentThread: (threadId: string | null) => ReturnType;
      setPendingComment: (range: CommentRange | null) => ReturnType;
    };
  }
}

export let commentHighlightsKey = new PluginKey<CommentHighlightsState>(
  'docsCommentHighlights'
);

let getThreadIds = (node: ProseMirrorNode) =>
  node.marks
    .filter(mark => mark.type.name === commentThreadMarkName)
    .map(mark => mark.attrs.threadId as string | null)
    .filter((threadId): threadId is string => !!threadId);

let buildDecorations = (
  doc: ProseMirrorNode,
  d: Omit<CommentHighlightsState, 'decorations'>
) => {
  let decorations: Decoration[] = [];

  if (d.visibleThreadIds.size) {
    doc.descendants((node, pos) => {
      if (!node.isText) return true;

      for (let threadId of getThreadIds(node)) {
        if (!d.visibleThreadIds.has(threadId)) continue;

        decorations.push(
          Decoration.inline(pos, pos + node.nodeSize, {
            class:
              threadId === d.activeThreadId
                ? 'docs-comment-highlight docs-comment-highlight--active'
                : 'docs-comment-highlight',
            'data-highlight-thread-id': threadId
          })
        );
      }

      return false;
    });
  }

  if (d.pending) {
    decorations.push(
      Decoration.inline(d.pending.from, d.pending.to, { class: 'docs-comment-pending' })
    );
  }

  return DecorationSet.create(doc, decorations);
};

let stripCommentMarks = (fragment: Fragment): Fragment => {
  let nodes: ProseMirrorNode[] = [];
  fragment.forEach(node => {
    if (node.isText) {
      nodes.push(
        node.mark(node.marks.filter(mark => mark.type.name !== commentThreadMarkName))
      );
      return;
    }

    nodes.push(node.copy(stripCommentMarks(node.content)));
  });

  return Fragment.fromArray(nodes);
};

export let getCommentThreadAnchors = (state: EditorState) => {
  let visible = commentHighlightsKey.getState(state)?.visibleThreadIds ?? new Set<string>();
  let anchors = new Map<string, CommentRange>();

  state.doc.descendants((node, pos) => {
    if (!node.isText) return true;

    for (let threadId of getThreadIds(node)) {
      if (!visible.has(threadId)) continue;

      let existing = anchors.get(threadId);
      anchors.set(threadId, {
        from: existing ? Math.min(existing.from, pos) : pos,
        to: Math.max(existing?.to ?? 0, pos + node.nodeSize)
      });
    }

    return false;
  });

  return anchors;
};

export let getPendingCommentRange = (state: EditorState) =>
  commentHighlightsKey.getState(state)?.pending ?? null;

export let CommentHighlights = Extension.create<CommentHighlightsOptions>({
  name: 'commentHighlights',

  addOptions() {
    return {
      onActivate: () => {}
    };
  },

  addCommands() {
    return {
      setCommentThreads:
        threadIds =>
        ({ tr, dispatch }) => {
          dispatch?.(tr.setMeta(commentHighlightsKey, { visibleThreadIds: threadIds }));
          return true;
        },
      setActiveCommentThread:
        threadId =>
        ({ tr, dispatch }) => {
          dispatch?.(tr.setMeta(commentHighlightsKey, { activeThreadId: threadId }));
          return true;
        },
      setPendingComment:
        range =>
        ({ tr, dispatch }) => {
          dispatch?.(tr.setMeta(commentHighlightsKey, { pending: range }));
          return true;
        }
    };
  },

  addProseMirrorPlugins() {
    let options = this.options;

    return [
      new Plugin<CommentHighlightsState>({
        key: commentHighlightsKey,

        state: {
          init: (_config, state) => {
            let base = {
              visibleThreadIds: new Set<string>(),
              activeThreadId: null,
              pending: null
            };
            return { ...base, decorations: buildDecorations(state.doc, base) };
          },
          apply: (tr, previous, _oldState, newState) => {
            let meta = tr.getMeta(commentHighlightsKey) as CommentHighlightsMeta | undefined;
            if (!meta && !tr.docChanged) return previous;

            let pending = previous.pending;
            if (pending && tr.docChanged) {
              let from = tr.mapping.map(pending.from, 1);
              let to = tr.mapping.map(pending.to, -1);
              pending = from < to ? { from, to } : null;
            }

            let next = {
              visibleThreadIds: meta?.visibleThreadIds
                ? new Set(meta.visibleThreadIds)
                : previous.visibleThreadIds,
              activeThreadId:
                meta && 'activeThreadId' in meta
                  ? (meta.activeThreadId ?? null)
                  : previous.activeThreadId,
              pending: meta && 'pending' in meta ? (meta.pending ?? null) : pending
            };

            return { ...next, decorations: buildDecorations(newState.doc, next) };
          }
        },

        props: {
          decorations: state => commentHighlightsKey.getState(state)?.decorations,

          transformPasted: slice =>
            new Slice(stripCommentMarks(slice.content), slice.openStart, slice.openEnd),

          handleClick: (view, pos) => {
            let visible = commentHighlightsKey.getState(view.state)?.visibleThreadIds;
            if (!visible?.size) return false;

            let $pos = view.state.doc.resolve(pos);
            let candidates = [$pos.nodeAfter, $pos.nodeBefore].filter(
              (node): node is ProseMirrorNode => !!node?.isText
            );
            for (let node of candidates) {
              let threadId = getThreadIds(node).find(id => visible.has(id));
              if (threadId) {
                options.onActivate(threadId);
                return false;
              }
            }

            return false;
          }
        }
      })
    ];
  }
});

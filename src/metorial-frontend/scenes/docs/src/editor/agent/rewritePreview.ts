import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Editor } from '@tiptap/react';
import { resolvePositionRef } from './positions';

export type RewritePreviewEntry = {
  from: string;
  to: string;
  content: string;
  status: 'running' | 'review' | 'error';
  error?: string;
  onAccept: () => void;
  onDiscard: () => void;
};

type RewritePreviewStorage = {
  entries: Map<string, RewritePreviewEntry>;
};

let rewritePreviewKey = new PluginKey('agentRewritePreview');

let createButton = (label: string, className: string, onClick: () => void) => {
  let button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = label;
  button.addEventListener('mousedown', event => event.preventDefault());
  button.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    onClick();
  });
  return button;
};

let createWidget = (entry: RewritePreviewEntry) => {
  let root = document.createElement('span');
  root.className = 'agent-rewrite-new';
  root.contentEditable = 'false';

  let text = document.createElement('span');
  text.className = 'agent-rewrite-new__text';
  text.textContent =
    entry.status == 'error'
      ? (entry.error ?? 'The rewrite failed.')
      : entry.content || 'Rewriting…';
  if (entry.status == 'running') text.classList.add('agent-rewrite-new__text--streaming');
  if (entry.status == 'error') text.classList.add('agent-rewrite-new__text--error');
  root.appendChild(text);

  let actions = document.createElement('span');
  actions.className = 'agent-rewrite-new__actions';
  if (entry.status == 'review') {
    actions.appendChild(createButton('Accept', 'agent-rewrite-accept', entry.onAccept));
  }
  actions.appendChild(
    createButton(
      entry.status == 'running' ? 'Stop' : 'Discard',
      'agent-rewrite-discard',
      entry.onDiscard
    )
  );
  root.appendChild(actions);

  return root;
};

let buildDecorations = (state: EditorState, entries: Map<string, RewritePreviewEntry>) => {
  if (entries.size == 0) return DecorationSet.empty;

  let decorations: Decoration[] = [];
  for (let [id, entry] of entries) {
    let from = resolvePositionRef(state, entry.from);
    let to = resolvePositionRef(state, entry.to);
    if (from == null || to == null || to < from) continue;

    if (to > from) {
      decorations.push(Decoration.inline(from, to, { class: 'agent-rewrite-old' }));
    }
    decorations.push(
      Decoration.widget(to, () => createWidget(entry), {
        side: 1,
        key: `${id}:${entry.status}:${entry.content.length}`,
        ignoreSelection: true,
        stopEvent: () => true
      })
    );
  }

  return DecorationSet.create(state.doc, decorations);
};

let getStorage = (editor: Editor) =>
  (editor.storage as unknown as { agentRewritePreview?: RewritePreviewStorage })
    .agentRewritePreview;

let refresh = (editor: Editor) => {
  if (editor.isDestroyed) return;
  editor.view.dispatch(
    editor.state.tr.setMeta(rewritePreviewKey, true).setMeta('addToHistory', false)
  );
};

export let setRewritePreview = (editor: Editor, id: string, entry: RewritePreviewEntry) => {
  let storage = getStorage(editor);
  if (!storage) return;
  storage.entries.set(id, entry);
  refresh(editor);
};

export let clearRewritePreview = (editor: Editor, id: string) => {
  let storage = getStorage(editor);
  if (!storage?.entries.delete(id)) return;
  refresh(editor);
};

export let AgentRewritePreview = Extension.create<{}, RewritePreviewStorage>({
  name: 'agentRewritePreview',

  addStorage() {
    return { entries: new Map() };
  },

  onDestroy() {
    this.storage.entries.clear();
  },

  addProseMirrorPlugins() {
    let storage = this.storage;

    return [
      new Plugin({
        key: rewritePreviewKey,
        props: {
          decorations: state => buildDecorations(state, storage.entries)
        }
      })
    ];
  }
});

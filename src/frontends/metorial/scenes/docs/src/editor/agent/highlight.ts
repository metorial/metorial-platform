import { Extension } from '@tiptap/core';
import { Plugin, PluginKey, type EditorState } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Editor } from '@tiptap/react';
import { resolveTopLevelRef, topLevelPos } from './positions';

type HighlightEntry = {
  refs: string[];
  streaming: boolean;
  timer?: ReturnType<typeof setTimeout>;
};

type HighlightStorage = {
  entries: Map<string, HighlightEntry>;
};

let highlightDurationMs = 2400;

let agentChangeHighlightKey = new PluginKey('agentChangeHighlight');

let buildDecorations = (state: EditorState, entries: Map<string, HighlightEntry>) => {
  if (entries.size == 0) return DecorationSet.empty;

  let decorations: Decoration[] = [];
  let seen = new Set<number>();

  for (let entry of entries.values()) {
    for (let ref of entry.refs) {
      let resolved = resolveTopLevelRef(state, ref);
      if (!resolved || seen.has(resolved.index)) continue;

      let node = state.doc.maybeChild(resolved.index);
      if (!node) continue;

      seen.add(resolved.index);
      let from = topLevelPos(state.doc, resolved.index);
      decorations.push(
        Decoration.node(from, from + node.nodeSize, {
          class: entry.streaming ? 'agent-change agent-change--streaming' : 'agent-change'
        })
      );
    }
  }

  return DecorationSet.create(state.doc, decorations);
};

let getStorage = (editor: Editor) =>
  (editor.storage as unknown as { agentChangeHighlight?: HighlightStorage })
    .agentChangeHighlight;

let refresh = (editor: Editor) => {
  if (editor.isDestroyed) return;
  editor.view.dispatch(
    editor.state.tr.setMeta(agentChangeHighlightKey, true).setMeta('addToHistory', false)
  );
};

export let setAgentChangeHighlight = (
  editor: Editor,
  id: string,
  d: { refs: string[]; streaming: boolean }
) => {
  let storage = getStorage(editor);
  if (!storage) return;

  let previous = storage.entries.get(id);
  if (previous?.timer) clearTimeout(previous.timer);

  let entry: HighlightEntry = { refs: d.refs, streaming: d.streaming };
  if (!d.streaming) {
    entry.timer = setTimeout(() => {
      if (storage.entries.get(id) != entry) return;
      storage.entries.delete(id);
      refresh(editor);
    }, highlightDurationMs);
  }

  storage.entries.set(id, entry);
};

export let clearAgentChangeHighlight = (editor: Editor, id: string) => {
  let storage = getStorage(editor);
  let entry = storage?.entries.get(id);
  if (!storage || !entry) return;

  if (entry.timer) clearTimeout(entry.timer);
  storage.entries.delete(id);
  refresh(editor);
};

export let AgentChangeHighlight = Extension.create<{}, HighlightStorage>({
  name: 'agentChangeHighlight',

  addStorage() {
    return { entries: new Map() };
  },

  onDestroy() {
    for (let entry of this.storage.entries.values()) {
      if (entry.timer) clearTimeout(entry.timer);
    }
    this.storage.entries.clear();
  },

  addProseMirrorPlugins() {
    let storage = this.storage;

    return [
      new Plugin({
        key: agentChangeHighlightKey,
        props: {
          decorations: state => buildDecorations(state, storage.entries)
        }
      })
    ];
  }
});

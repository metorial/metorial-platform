import {
  createBlockRef,
  decodeRelativePosition,
  encodeRelativePosition,
  resolveBlockRef
} from '@metorial/docs-editor-schema';
import { DOMParser as ProseMirrorDOMParser, type Fragment, type Node } from '@tiptap/pm/model';
import type { EditorState } from '@tiptap/pm/state';
import type { Editor } from '@tiptap/react';
import {
  absolutePositionToRelativePosition,
  relativePositionToAbsolutePosition,
  ySyncPluginKey
} from '@tiptap/y-tiptap';
import type * as Y from 'yjs';

type YSyncState = {
  doc: Y.Doc;
  type: Y.XmlFragment;
  binding: { mapping: Parameters<typeof relativePositionToAbsolutePosition>[3] };
};

export type TopLevelRange = { from: number; to: number };

export let getYSync = (state: EditorState) => {
  let sync = ySyncPluginKey.getState(state) as YSyncState | undefined;
  return sync?.doc && sync.type ? sync : null;
};

export let topLevelPos = (doc: Node, index: number) => {
  let pos = 0;
  let end = Math.min(index, doc.childCount);
  for (let i = 0; i < end; i++) pos += doc.child(i).nodeSize;
  return pos;
};

export let topLevelIndexAt = (doc: Node, pos: number) => {
  let clamped = Math.max(0, Math.min(pos, doc.content.size));
  return doc.resolve(clamped).index(0);
};

export let topLevelIndexRange = (doc: Node, range: TopLevelRange) => ({
  from: topLevelPos(doc, range.from),
  to: topLevelPos(doc, range.to + 1)
});

export let createTopLevelRef = (state: EditorState, index: number) => {
  let sync = getYSync(state);
  return sync ? createBlockRef(sync.type, index) : null;
};

export let resolveTopLevelRef = (state: EditorState, ref: string | undefined) => {
  let sync = getYSync(state);
  if (!sync || !ref || ref.startsWith('op:')) return null;

  try {
    return resolveBlockRef({ ydoc: sync.doc, ref });
  } catch {
    return null;
  }
};

export let encodePositionRef = (state: EditorState, pos: number) => {
  let sync = getYSync(state);
  if (!sync || sync.binding.mapping.size == 0) return null;

  return encodeRelativePosition(
    absolutePositionToRelativePosition(pos, sync.type, sync.binding.mapping)
  );
};

export let resolvePositionRef = (state: EditorState, ref: string | undefined) => {
  let sync = getYSync(state);
  if (!sync || !ref || ref.startsWith('op:')) return null;

  try {
    let pos = relativePositionToAbsolutePosition(
      sync.doc,
      sync.type,
      decodeRelativePosition(ref),
      sync.binding.mapping
    );
    return pos == null ? null : Math.max(0, Math.min(pos, state.doc.content.size));
  } catch {
    return null;
  }
};

type MarkdownStorage = {
  markdown?: {
    parser: { parse: (content: string) => string };
    serializer: { serialize: (content: Fragment | Node) => string };
  };
};

export let markdownToFragment = (editor: Editor, markdown: string) => {
  let parser = (editor.storage as MarkdownStorage).markdown?.parser;
  let element = document.createElement('div');
  element.innerHTML = parser ? parser.parse(markdown) : markdown;
  return ProseMirrorDOMParser.fromSchema(editor.schema).parse(element).content;
};

export let fragmentToMarkdown = (editor: Editor, content: Fragment | Node) =>
  (editor.storage as MarkdownStorage).markdown?.serializer.serialize(content).trim() ?? '';

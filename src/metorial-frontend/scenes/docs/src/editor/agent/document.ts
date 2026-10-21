import { agentBlockNodeName, type AgentBlockStatus } from '@metorial/docs-editor-schema';
import type { Node } from '@tiptap/pm/model';
import type { Editor } from '@tiptap/react';
import { yUndoPluginKey } from '@tiptap/y-tiptap';
import type * as Y from 'yjs';
import {
  encodePositionRef,
  fragmentToMarkdown,
  topLevelIndexAt,
  topLevelPos,
  type TopLevelRange
} from './positions';

export let createAgentJobId = () =>
  `agent_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

export let findAgentBlock = (doc: Node, blockId: string) => {
  for (let index = 0; index < doc.childCount; index++) {
    let node = doc.child(index);
    if (node.type.name == agentBlockNodeName && node.attrs.blockId == blockId) {
      return { node, index, pos: topLevelPos(doc, index) };
    }
  }
  return null;
};

export let stopUndoCapturing = (editor: Editor) => {
  let undoManager = (
    yUndoPluginKey.getState(editor.state) as { undoManager?: Y.UndoManager } | undefined
  )?.undoManager;
  undoManager?.stopCapturing();
};

export let updateAgentBlock = (
  editor: Editor,
  blockId: string,
  attrs: Partial<{ status: AgentBlockStatus; prompt: string; mode: string }>
) => {
  let found = findAgentBlock(editor.state.doc, blockId);
  if (!found) return false;

  let changed = Object.entries(attrs).some(([key, value]) => found.node.attrs[key] !== value);
  if (!changed) return true;

  let tr = editor.state.tr.setNodeMarkup(found.pos, undefined, {
    ...found.node.attrs,
    ...attrs
  });
  tr.setMeta('addToHistory', false);
  editor.view.dispatch(tr);
  return true;
};

export let agentBlockHasContent = (editor: Editor, blockId: string) => {
  let found = findAgentBlock(editor.state.doc, blockId);
  return !!found && found.node.textContent.trim().length > 0;
};

export let resetAgentBlockContent = (editor: Editor, blockId: string) => {
  let found = findAgentBlock(editor.state.doc, blockId);
  if (!found) return;

  let tr = editor.state.tr.replaceWith(
    found.pos + 1,
    found.pos + found.node.nodeSize - 1,
    editor.schema.nodes.paragraph!.create()
  );
  tr.setMeta('addToHistory', false);
  editor.view.dispatch(tr);
};

export let acceptAgentBlock = (editor: Editor, blockId: string) => {
  let found = findAgentBlock(editor.state.doc, blockId);
  if (!found) return;

  stopUndoCapturing(editor);
  let tr = editor.state.tr.replaceWith(
    found.pos,
    found.pos + found.node.nodeSize,
    found.node.content
  );
  editor.view.dispatch(tr);
  stopUndoCapturing(editor);
};

export let removeAgentBlock = (editor: Editor, blockId: string) => {
  let found = findAgentBlock(editor.state.doc, blockId);
  if (!found) return;

  let tr = editor.state.tr.delete(found.pos, found.pos + found.node.nodeSize);
  if (editor.state.doc.childCount == 1) {
    tr.insert(0, editor.schema.nodes.paragraph!.create());
  }
  editor.view.dispatch(tr);
};

export let insertAgentBlock = (
  editor: Editor,
  d: {
    index: number;
    blockId: string;
    mode: 'block' | 'summarize';
    status: AgentBlockStatus;
    replaceEmpty?: boolean;
  }
) => {
  let doc = editor.state.doc;
  let block = editor.schema.nodes[agentBlockNodeName]!.create(
    { blockId: d.blockId, mode: d.mode, status: d.status, prompt: '' },
    editor.schema.nodes.paragraph!.create()
  );

  let existing = doc.maybeChild(d.index);
  let replace = d.replaceEmpty && existing?.isTextblock && existing.content.size == 0;
  let from = topLevelPos(doc, d.index);
  let to = replace && existing ? from + existing.nodeSize : from;

  editor.view.dispatch(editor.state.tr.replaceWith(from, to, block));
};

export let topLevelMarkdown = (editor: Editor, range: TopLevelRange, exclude?: number) => {
  let doc = editor.state.doc;
  let nodes: Node[] = [];
  for (let index = range.from; index <= range.to; index++) {
    let node = doc.maybeChild(index);
    if (node && index != exclude) nodes.push(node);
  }
  if (!nodes.length) return '';
  return fragmentToMarkdown(editor, doc.type.create(null, nodes));
};

export let findSectionRange = (doc: Node, pos: number): TopLevelRange => {
  let index = topLevelIndexAt(doc, pos);
  let start = 0;
  let level = Number.POSITIVE_INFINITY;

  for (let i = index; i >= 0; i--) {
    let node = doc.child(i);
    if (node.type.name == 'heading') {
      start = i;
      level = node.attrs.level as number;
      break;
    }
  }

  let end = doc.childCount - 1;
  for (let i = start + 1; i < doc.childCount; i++) {
    let node = doc.child(i);
    if (node.type.name == 'heading' && (node.attrs.level as number) <= level) {
      end = i - 1;
      break;
    }
  }

  return { from: start, to: Math.max(start, end) };
};

export let getSelectionContext = (editor: Editor) => {
  let { from, to, empty } = editor.state.selection;
  if (empty) return null;

  let fromRef = encodePositionRef(editor.state, from);
  let toRef = encodePositionRef(editor.state, to);
  if (!fromRef || !toRef) return null;

  let text = fragmentToMarkdown(editor, editor.state.doc.slice(from, to).content);
  if (!text) return null;

  return { from: fromRef, to: toRef, text };
};

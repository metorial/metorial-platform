import { agentBlockNodeName } from '@metorial/docs-editor-schema';
import type { AssistantLiveStateItem } from '@metorial/state';
import type { JSONContent } from '@tiptap/core';
import { Fragment, Node } from '@tiptap/pm/model';
import type { Editor } from '@tiptap/react';
import { yUndoPluginKey } from '@tiptap/y-tiptap';
import type * as Y from 'yjs';
import { clearAgentChangeHighlight, setAgentChangeHighlight } from './highlight';
import {
  createTopLevelRef,
  getYSync,
  markdownToFragment,
  resolvePositionRef,
  resolveTopLevelRef,
  topLevelIndexAt,
  topLevelPos,
  type TopLevelRange
} from './positions';

export type DocumentEditItem = Extract<AssistantLiveStateItem, { type: 'document/edit' }>;
export type DocumentEditOperation = DocumentEditItem['operations'][number];

export let agentTargets = {
  documentStart: 'doc_start',
  documentEnd: 'doc_end',
  title: '@title',
  frontMatter: '@frontMatter',
  block: 'block',
  selection: 'selection',
  anchor: 'anchor'
} as const;

type OperationState = {
  content: string;
  finished: boolean;
  refs: string[];
  blockRef?: string;
  original?: JSONContent[];
  updatedAt: number;
};

type QueuedItem = { item: DocumentEditItem; jobId?: string };

let flushDelayMs = 50;
let maxPersistedOperations = 300;
let storagePrefix = 'metorial:agent-edits:';

let isRewriteOperation = (item: DocumentEditItem, operation: DocumentEditOperation) =>
  item.review == 'pending' &&
  operation.target == agentTargets.selection &&
  operation.kind == 'replace';

export let isRewriteItem = (item: DocumentEditItem) =>
  item.operations.some(operation => isRewriteOperation(item, operation));

export class AgentEditApplier {
  private operations: Record<string, OperationState> = {};
  private queue = new Map<string, QueuedItem>();
  private groups = new Set<string>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;

  constructor(
    private d: {
      editor: Editor;
      documentId: string;
      setTitle?: (title: string) => void;
      setFrontMatter?: (frontMatter: string) => void;
    }
  ) {
    this.restore();
  }

  get documentId() {
    return this.d.documentId;
  }

  private get editor() {
    return this.d.editor;
  }

  sync(items: DocumentEditItem[], opts?: { jobId?: string }) {
    if (this.destroyed) return;

    for (let item of items) {
      if (item.documentId != this.d.documentId) continue;
      this.queue.set(item.toolCallId, { item, jobId: opts?.jobId });
    }

    if (this.queue.size && !this.timer) {
      this.timer = setTimeout(() => {
        this.timer = null;
        this.flush();
      }, flushDelayMs);
    }
  }

  flush() {
    if (this.destroyed || this.editor.isDestroyed || !getYSync(this.editor.state)) return;

    let queued = [...this.queue.values()];
    this.queue.clear();
    if (!queued.length) return;

    for (let { item, jobId } of queued) this.applyItem(item, jobId);

    this.refreshDecorations();
    this.persist();
  }

  destroy() {
    this.destroyed = true;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    this.queue.clear();
  }

  private stopCapturing() {
    let undoManager = (
      yUndoPluginKey.getState(this.editor.state) as { undoManager?: Y.UndoManager } | undefined
    )?.undoManager;
    undoManager?.stopCapturing();
  }

  private applyItem(item: DocumentEditItem, jobId?: string) {
    let direct = item.review == 'direct';

    if (direct && !this.groups.has(item.toolCallId)) {
      this.groups.add(item.toolCallId);
      this.stopCapturing();
    }

    item.operations.forEach((operation, index) => {
      if (isRewriteOperation(item, operation)) return;
      this.applyOperation({ item, operation, key: `${item.toolCallId}:${index}`, jobId });
    });

    if (direct && item.status != 'running') this.stopCapturing();
  }

  private applyOperation(d: {
    item: DocumentEditItem;
    operation: DocumentEditOperation;
    key: string;
    jobId?: string;
  }) {
    let state = (this.operations[d.key] ??= {
      content: '',
      finished: false,
      refs: [],
      updatedAt: Date.now()
    });
    if (state.finished) return;

    let operation = d.operation;
    let direct = d.item.review == 'direct';

    if (operation.error) {
      if (direct) this.revert(d.key, state);
      this.finish(d.key, state, false);
      return;
    }

    if (
      operation.target == agentTargets.title ||
      operation.target == agentTargets.frontMatter
    ) {
      if (!operation.finished) return;
      if (operation.target == agentTargets.title)
        this.d.setTitle?.(
          operation.content
            .trim()
            .replace(/^#+\s*/, '')
            .trim()
        );
      else this.d.setFrontMatter?.(operation.content.trim());
      this.finish(d.key, state, false);
      return;
    }

    if (operation.kind == 'delete') {
      if (!operation.finished) return;
      let range = this.resolveTargetRange(operation);
      if (range) this.replaceTopLevel(range.from, range.to + 1, Fragment.empty, true);
      this.finish(d.key, state, false);
      return;
    }

    if (!operation.content.trim()) {
      if (operation.finished) this.finish(d.key, state, false);
      return;
    }

    if (operation.content == state.content) {
      if (operation.finished) this.finish(d.key, state, direct);
      return;
    }

    let rendered = direct
      ? this.renderDirect(state, operation)
      : this.renderPending(state, operation, d.jobId);

    if (rendered == 'abandoned') {
      this.finish(d.key, state, false);
      return;
    }
    if (rendered == 'unresolved') {
      if (operation.finished) this.finish(d.key, state, false);
      return;
    }

    state.content = operation.content;
    state.updatedAt = Date.now();

    if (direct) {
      setAgentChangeHighlight(this.editor, d.key, {
        refs: state.refs,
        streaming: !operation.finished
      });
    }

    if (operation.finished) this.finish(d.key, state, direct);
  }

  private finish(key: string, state: OperationState, highlight: boolean) {
    state.finished = true;
    state.updatedAt = Date.now();
    if (highlight)
      setAgentChangeHighlight(this.editor, key, { refs: state.refs, streaming: false });
    else clearAgentChangeHighlight(this.editor, key);
  }

  private resolveRef(ref: string | undefined): TopLevelRange | null {
    if (!ref) return null;

    if (ref.startsWith('op:')) {
      let state = this.operations[ref.slice(3)];
      if (!state) return null;
      if (state.blockRef) return this.resolveRef(state.blockRef);
      return this.rangeFromRefs(state.refs);
    }

    let resolved = resolveTopLevelRef(this.editor.state, ref);
    return resolved ? { from: resolved.index, to: resolved.index } : null;
  }

  private rangeFromRefs(refs: string[]): TopLevelRange | null {
    let indices = refs
      .map(ref => resolveTopLevelRef(this.editor.state, ref)?.index)
      .filter((index): index is number => index !== undefined);
    if (!indices.length) return null;

    return { from: Math.min(...indices), to: Math.max(...indices) };
  }

  private resolveTargetRange(operation: DocumentEditOperation): TopLevelRange | null {
    let first = this.resolveRef(operation.ref);
    if (!first) return null;
    if (!operation.targetEnd) return first;

    let last = this.resolveRef(operation.refEnd);
    if (!last || last.to < first.from) return null;
    return { from: first.from, to: last.to };
  }

  private insertionIndex(operation: DocumentEditOperation) {
    if (operation.target == agentTargets.documentStart) return 0;
    if (operation.target == agentTargets.documentEnd) return this.editor.state.doc.childCount;

    let range = this.resolveRef(operation.ref);
    if (!range) return null;
    return operation.kind == 'insert_before' ? range.from : range.to + 1;
  }

  private replaceTopLevel(
    start: number,
    end: number,
    content: Fragment,
    addToHistory: boolean
  ) {
    let state = this.editor.state;
    let before = state.doc.childCount;
    let tr = state.tr.replaceWith(
      topLevelPos(state.doc, start),
      topLevelPos(state.doc, end),
      content
    );
    if (!addToHistory) tr.setMeta('addToHistory', false);
    this.editor.view.dispatch(tr);

    let created = this.editor.state.doc.childCount - (before - (end - start));
    let refs: string[] = [];
    for (let index = start; index < start + created; index++) {
      let ref = createTopLevelRef(this.editor.state, index);
      if (ref) refs.push(ref);
    }
    return refs;
  }

  private nodesJSON(range: TopLevelRange) {
    let nodes: JSONContent[] = [];
    for (let index = range.from; index <= range.to; index++) {
      let node = this.editor.state.doc.maybeChild(index);
      if (node) nodes.push(node.toJSON());
    }
    return nodes;
  }

  private isEmptyDocument() {
    let doc = this.editor.state.doc;
    return (
      doc.childCount == 1 && !!doc.firstChild?.isTextblock && doc.firstChild.content.size == 0
    );
  }

  private renderDirect(state: OperationState, operation: DocumentEditOperation) {
    let content = markdownToFragment(this.editor, operation.content);
    if (content.childCount == 0) return 'unresolved' as const;

    if (state.refs.length) {
      let range = this.rangeFromRefs(state.refs);
      if (!range) return 'abandoned' as const;
      state.refs = this.replaceTopLevel(range.from, range.to + 1, content, true);
      return 'rendered' as const;
    }

    if (operation.kind == 'replace') {
      let range = this.resolveTargetRange(operation);
      if (!range) return 'unresolved' as const;
      state.original = this.nodesJSON(range);
      state.refs = this.replaceTopLevel(range.from, range.to + 1, content, true);
      return 'rendered' as const;
    }

    if (this.isEmptyDocument()) {
      state.original = this.nodesJSON({ from: 0, to: 0 });
      state.refs = this.replaceTopLevel(0, 1, content, true);
      return 'rendered' as const;
    }

    let index = this.insertionIndex(operation);
    if (index == null) return 'unresolved' as const;
    state.refs = this.replaceTopLevel(index, index, content, true);
    return 'rendered' as const;
  }

  private revert(key: string, state: OperationState) {
    if (!state.refs.length) return;

    let range = this.rangeFromRefs(state.refs);
    if (range) {
      let original = Fragment.fromArray(
        (state.original ?? []).map(node => Node.fromJSON(this.editor.schema, node))
      );
      this.replaceTopLevel(range.from, range.to + 1, original, true);
    }

    state.refs = [];
    clearAgentChangeHighlight(this.editor, key);
  }

  private ensureAgentBlock(operation: DocumentEditOperation, jobId?: string) {
    let doc = this.editor.state.doc;
    let index: number | null = null;

    if (operation.target == agentTargets.block) return operation.ref ?? null;

    if (operation.target == agentTargets.documentEnd) {
      index = doc.childCount;
    } else {
      let anchor = resolveTopLevelRef(this.editor.state, operation.ref);
      if (anchor) {
        if (doc.maybeChild(anchor.index)?.type.name == agentBlockNodeName) {
          return operation.ref ?? null;
        }
        index = anchor.index + 1;
      } else {
        let pos = resolvePositionRef(this.editor.state, operation.ref);
        if (pos == null) return null;
        index = topLevelIndexAt(doc, pos) + 1;
      }
    }

    let schema = this.editor.schema;
    let block = schema.nodes[agentBlockNodeName]!.create(
      { blockId: jobId ?? null, mode: 'summarize', status: 'running' },
      schema.nodes.paragraph!.create()
    );
    let [ref] = this.replaceTopLevel(index, index, Fragment.from(block), false);
    return ref ?? null;
  }

  private renderPending(
    state: OperationState,
    operation: DocumentEditOperation,
    jobId?: string
  ) {
    state.blockRef ??= this.ensureAgentBlock(operation, jobId) ?? undefined;
    if (!state.blockRef) return 'unresolved' as const;

    let resolved = resolveTopLevelRef(this.editor.state, state.blockRef);
    let doc = this.editor.state.doc;
    let node = resolved ? doc.maybeChild(resolved.index) : null;
    if (!resolved || node?.type.name != agentBlockNodeName) return 'abandoned' as const;

    let content = markdownToFragment(this.editor, operation.content);
    if (content.childCount == 0) return 'unresolved' as const;

    let pos = topLevelPos(doc, resolved.index);
    let tr = this.editor.state.tr.replaceWith(pos + 1, pos + node.nodeSize - 1, content);
    tr.setMeta('addToHistory', false);
    this.editor.view.dispatch(tr);
    return 'rendered' as const;
  }

  private refreshDecorations() {
    if (this.editor.isDestroyed) return;
    this.editor.view.dispatch(this.editor.state.tr.setMeta('addToHistory', false));
  }

  private get storageKey() {
    return `${storagePrefix}${this.d.documentId}`;
  }

  private restore() {
    try {
      let raw = window.sessionStorage.getItem(this.storageKey);
      if (raw) this.operations = JSON.parse(raw) as Record<string, OperationState>;
    } catch {
      this.operations = {};
    }
  }

  private persist() {
    let entries = Object.entries(this.operations);
    if (entries.length > maxPersistedOperations) {
      entries.sort((a, b) => b[1].updatedAt - a[1].updatedAt);
      this.operations = Object.fromEntries(entries.slice(0, maxPersistedOperations));
    }

    try {
      window.sessionStorage.setItem(this.storageKey, JSON.stringify(this.operations));
    } catch {}
  }
}

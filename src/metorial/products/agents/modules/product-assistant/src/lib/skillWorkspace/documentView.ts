import type { DocumentEditOperation } from '../../types';
import {
  composeFullMarkdown,
  decodeYjsUpdate,
  resolveBlockRef,
  yjsDocToBlocks
} from '@metorial/docs-editor-schema';
import * as Y from 'yjs';
import {
  diffBlocks,
  documentEndTarget,
  documentStartTarget,
  type BlockEditOperation
} from './blockDiff';

export let documentTitleTarget = '@title';
export let documentFrontMatterTarget = '@frontMatter';

let readChunkCharacters = 32_000;

type ShadowBlock = {
  alias: string;
  ref: string;
  pending: boolean;
  markdown: string;
};

export type DocumentSnapshotSource = {
  getStateUpdate: () => Promise<string | null>;
  getFallbackMarkdown: () => Promise<{ title: string; content: string }>;
};

export type ResolvedBlockOperation = {
  operation: DocumentEditOperation;
  error?: string;
};

let splitFrontMatter = (content: string) => {
  let input = content.replace(/^\uFEFF/, '');
  let match = input.match(/^---\r?\n([\s\S]*?)\r?\n(?:---|\.\.\.)\r?\n?/);
  if (!match) return { frontMatter: undefined, body: input };

  return { frontMatter: (match[1] ?? '').trim(), body: input.slice(match[0].length) };
};

let splitTitle = (body: string) => {
  let match = body.match(/^\s*#\s+([^\r\n]+)(?:\r?\n|$)/);
  if (!match) return { title: undefined, body };

  return { title: match[1]!.trim(), body: body.slice(match[0].length) };
};

let splitMarkdownBlocks = (body: string) => {
  let blocks: string[] = [];
  let current: string[] = [];
  let fence: string | null = null;

  for (let line of body.split('\n')) {
    let fenceMatch = line.match(/^\s*(```|~~~)/);
    if (fenceMatch) fence = fence ? (fence == fenceMatch[1] ? null : fence) : fenceMatch[1]!;

    if (!fence && line.trim() == '') {
      if (current.length) blocks.push(current.join('\n'));
      current = [];
      continue;
    }

    current.push(line);
  }

  if (current.length) blocks.push(current.join('\n'));
  return blocks;
};

export class ActiveDocumentView {
  private blocks: ShadowBlock[] = [];
  private aliasCounter = 0;
  private title: string | undefined;
  private frontMatter: string | undefined;
  private loaded = false;

  constructor(
    readonly documentId: string,
    private source: DocumentSnapshotSource
  ) {}

  private nextAlias() {
    this.aliasCounter++;
    return `b${this.aliasCounter}`;
  }

  get hasPendingBlocks() {
    return this.blocks.some(block => block.pending);
  }

  get isEmpty() {
    return this.blocks.length == 0;
  }

  private async loadFresh() {
    let update = await this.source.getStateUpdate();
    if (update) {
      let ydoc = new Y.Doc();
      try {
        Y.applyUpdate(ydoc, decodeYjsUpdate(update));
        let meta = ydoc.getMap<string>('meta');
        return {
          title: meta.get('title'),
          frontMatter: meta.get('frontMatter'),
          blocks: yjsDocToBlocks(ydoc).map(block => ({
            ref: block.ref,
            markdown: block.markdown
          }))
        };
      } finally {
        ydoc.destroy();
      }
    }

    let fallback = await this.source.getFallbackMarkdown();
    let { frontMatter, body } = splitFrontMatter(fallback.content);
    let titled = splitTitle(body);

    return {
      title: titled.title ?? fallback.title,
      frontMatter,
      blocks: splitMarkdownBlocks(titled.body).map(markdown => ({ ref: '', markdown }))
    };
  }

  async ensureLoaded() {
    if (!this.loaded) await this.refresh();
  }

  async refresh() {
    let fresh = await this.loadFresh();
    this.title = fresh.title;
    this.frontMatter = fresh.frontMatter;

    if (!this.loaded || !this.hasPendingBlocks) {
      let previousByRef = new Map(this.blocks.map(block => [block.ref, block.alias]));
      this.blocks = fresh.blocks.map(block => ({
        alias: (block.ref && previousByRef.get(block.ref)) || this.nextAlias(),
        ref: block.ref,
        pending: false,
        markdown: block.markdown
      }));
      this.loaded = true;
      return;
    }

    let freshByRef = new Map(fresh.blocks.map(block => [block.ref, block.markdown]));
    this.blocks = this.blocks.filter(block => block.pending || freshByRef.has(block.ref));
    for (let block of this.blocks) {
      if (!block.pending) block.markdown = freshByRef.get(block.ref)!;
    }
  }

  getTitle() {
    return this.title;
  }

  toBody() {
    return this.blocks.map(block => block.markdown).join('\n\n');
  }

  toMarkdown() {
    return composeFullMarkdown({
      frontMatter: this.frontMatter,
      title: this.title ?? '',
      body: this.toBody()
    });
  }

  async read(d: { from?: string; to?: string } = {}) {
    await this.ensureLoaded();

    let start = d.from ? this.blocks.findIndex(block => block.alias == d.from) : 0;
    if (start < 0)
      return { error: `Unknown block ${d.from}. Call read_document without arguments.` };

    let end = d.to
      ? this.blocks.findIndex(block => block.alias == d.to)
      : this.blocks.length - 1;
    if (end < 0)
      return { error: `Unknown block ${d.to}. Call read_document without arguments.` };

    let lines: string[] = [];
    let size = 0;
    let index = start;

    for (; index <= end; index++) {
      let block = this.blocks[index]!;
      let entry = `[${block.alias}] ${block.markdown}`;
      if (lines.length > 0 && size + entry.length > readChunkCharacters) break;

      lines.push(entry);
      size += entry.length + 2;
    }

    let nextBlock = index <= end ? this.blocks[index] : undefined;

    return {
      title: this.title ?? null,
      frontMatter: start == 0 ? (this.frontMatter ?? null) : undefined,
      totalBlocks: this.blocks.length,
      content: lines.length ? lines.join('\n\n') : '(the document body is empty)',
      ...(nextBlock
        ? {
            hasMore: true,
            status: `Showing ${lines.length} blocks. Call read_document with from="${nextBlock.alias}" to continue.`
          }
        : { hasMore: false })
    };
  }

  peekRef(alias: string) {
    if (alias == documentStartTarget || alias == documentEndTarget) return undefined;
    if (alias == documentTitleTarget || alias == documentFrontMatterTarget) return undefined;

    return this.blocks.find(block => block.alias == alias)?.ref;
  }

  aliasForRef(ref: string) {
    return this.blocks.find(block => block.ref == ref)?.alias;
  }

  toPreviewOperation(operation: Partial<BlockEditOperation>): DocumentEditOperation | null {
    if (!operation.type || !operation.target) return null;

    let targetEnd = 'targetEnd' in operation ? operation.targetEnd : undefined;

    return {
      kind: operation.type,
      target: operation.target,
      targetEnd,
      ref: this.peekRef(operation.target),
      refEnd: targetEnd ? this.peekRef(targetEnd) : undefined,
      content: 'content' in operation ? (operation.content ?? '') : '',
      finished: false
    };
  }

  private async findStaleTargets(aliases: string[]) {
    let targets = aliases
      .map(alias => this.blocks.find(block => block.alias == alias))
      .filter((block): block is ShadowBlock => !!block && !block.pending && !!block.ref);
    if (targets.length == 0) return [];

    let update = await this.source.getStateUpdate();
    if (!update) return [];

    let ydoc = new Y.Doc();
    try {
      Y.applyUpdate(ydoc, decodeYjsUpdate(update));
      let freshBlocks = yjsDocToBlocks(ydoc);

      return targets
        .filter(block => {
          let resolved = resolveBlockRef({ ydoc, ref: block.ref });
          if (!resolved) return true;
          return freshBlocks[resolved.index]?.markdown != block.markdown;
        })
        .map(block => block.alias);
    } finally {
      ydoc.destroy();
    }
  }

  async applyOperations(d: {
    toolCallId: string;
    operations: BlockEditOperation[];
    checkStale: boolean;
    indexOffset?: number;
  }): Promise<ResolvedBlockOperation[]> {
    await this.ensureLoaded();

    let stale = d.checkStale
      ? new Set(
          await this.findStaleTargets(
            d.operations.flatMap(operation => [
              operation.target,
              ...('targetEnd' in operation && operation.targetEnd ? [operation.targetEnd] : [])
            ])
          )
        )
      : new Set<string>();

    return d.operations.map((operation, index) =>
      this.applyOperation({
        operation,
        pendingRef: `op:${d.toolCallId}:${(d.indexOffset ?? 0) + index}`,
        stale
      })
    );
  }

  private applyOperation(d: {
    operation: BlockEditOperation;
    pendingRef: string;
    stale: Set<string>;
  }): ResolvedBlockOperation {
    let operation = d.operation;
    let targetEnd = 'targetEnd' in operation ? operation.targetEnd : undefined;
    let content = 'content' in operation ? operation.content : '';
    let resolved: DocumentEditOperation = {
      kind: operation.type,
      target: operation.target,
      targetEnd,
      ref: this.peekRef(operation.target),
      refEnd: targetEnd ? this.peekRef(targetEnd) : undefined,
      content,
      finished: true
    };

    let fail = (error: string): ResolvedBlockOperation => ({
      operation: { ...resolved, error },
      error
    });

    if (
      operation.target == documentTitleTarget ||
      operation.target == documentFrontMatterTarget
    ) {
      if (operation.type != 'replace')
        return fail(`${operation.target} only supports replace`);

      if (operation.target == documentTitleTarget) this.title = content.trim();
      else this.frontMatter = content.trim() || undefined;

      return { operation: resolved };
    }

    if (operation.target == documentStartTarget || operation.target == documentEndTarget) {
      if (operation.type == 'replace' || operation.type == 'delete') {
        return fail(`${operation.target} only supports insert_before and insert_after`);
      }

      let block = { alias: '', ref: d.pendingRef, pending: true, markdown: content.trim() };
      block.alias = this.nextAlias();
      if (operation.target == documentStartTarget) this.blocks.unshift(block);
      else this.blocks.push(block);

      return { operation: resolved };
    }

    let first = this.blocks.findIndex(block => block.alias == operation.target);
    if (first < 0) return fail(`Unknown block ${operation.target}. Call read_document again.`);

    let last = targetEnd ? this.blocks.findIndex(block => block.alias == targetEnd) : first;
    if (last < 0) return fail(`Unknown block ${targetEnd}. Call read_document again.`);
    if (last < first)
      return fail(`targetEnd ${targetEnd} comes before target ${operation.target}`);

    let staleAlias = this.blocks
      .slice(first, last + 1)
      .find(block => d.stale.has(block.alias))?.alias;
    if (staleAlias) {
      return fail(
        `Block ${staleAlias} was changed by someone else since you read it. Call read_document again before editing it.`
      );
    }

    if (
      (operation.type == 'replace' || operation.type.startsWith('insert')) &&
      !content.trim()
    ) {
      return fail('content must not be empty. Use the delete operation to remove blocks.');
    }

    if (operation.type == 'delete') {
      this.blocks.splice(first, last - first + 1);
      return { operation: resolved };
    }

    if (operation.type == 'replace') {
      let replaced = this.blocks[first]!;
      this.blocks.splice(first, last - first + 1, {
        alias: replaced.alias,
        ref: d.pendingRef,
        pending: true,
        markdown: content.trim()
      });
      return { operation: resolved };
    }

    let inserted = {
      alias: this.nextAlias(),
      ref: d.pendingRef,
      pending: true,
      markdown: content.trim()
    };
    this.blocks.splice(operation.type == 'insert_before' ? first : last + 1, 0, inserted);

    return { operation: resolved };
  }

  diffMarkdown(next: string): BlockEditOperation[] {
    let { frontMatter, body } = splitFrontMatter(next);
    let titled = splitTitle(body);
    let operations: BlockEditOperation[] = [];

    if (titled.title !== undefined && titled.title != (this.title ?? '')) {
      operations.push({ type: 'replace', target: documentTitleTarget, content: titled.title });
    }

    if ((frontMatter ?? '') != (this.frontMatter ?? '')) {
      operations.push({
        type: 'replace',
        target: documentFrontMatterTarget,
        content: frontMatter ?? ''
      });
    }

    operations.push(
      ...diffBlocks({
        blocks: this.blocks.map(block => ({ alias: block.alias, markdown: block.markdown })),
        next: titled.body.replace(/^\s+/, '').replace(/\s+$/, '')
      })
    );

    return operations;
  }
}

import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { Transaction } from '@tiptap/pm/state';
import {
  PRIMARY_EDITOR_THRESHOLD,
  annotatedTextblockTypes,
  commentThreadMarkName,
  generateBlockId,
  normalizeEditors
} from './annotationSchema';

let maxSequenceAlignmentCells = 2_000_000;
let maxCharacterAlignmentCells = 1_000_000;

export type DocumentAnnotationBlock = {
  id: string;
  h: string;
  e: number[];
};

export type DocumentAnnotationComment = {
  t: string;
  s: [number, number];
  e: [number, number];
  q: string;
};

export type DocumentAnnotations = {
  v: 1;
  contentHash: string;
  actors: string[];
  blocks: DocumentAnnotationBlock[];
  comments: DocumentAnnotationComment[];
};

export type DocumentBody = {
  readonly content: string;
  readonly annotations: DocumentAnnotations;
  readonly __documentBody: true;
};

export type DocumentCommentAnchor = {
  startBlockId: string;
  startOffset: number;
  endBlockId: string;
  endOffset: number;
  quote: string;
};

export type AnnotationModelBlock = {
  id: string;
  text: string;
  editors: string[];
};

export type AnnotationModelComment = {
  threadId: string;
  from: number;
  to: number;
};

export type AnnotationModel = {
  blocks: AnnotationModelBlock[];
  comments: AnnotationModelComment[];
};

export type Textblock = {
  node: ProseMirrorNode;
  pos: number;
};

export let hashText = (input: string) => {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;

  for (let i = 0; i < input.length; i++) {
    let code = input.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
};

export let createDocumentBody = (
  content: string,
  annotations: Omit<DocumentAnnotations, 'v' | 'contentHash'>
): DocumentBody => ({
  content,
  annotations: {
    v: 1,
    contentHash: hashText(content),
    actors: annotations.actors,
    blocks: annotations.blocks,
    comments: annotations.comments
  },
  __documentBody: true
});

let isIntegerPair = (value: unknown): value is [number, number] =>
  Array.isArray(value) &&
  value.length == 2 &&
  Number.isInteger(value[0]) &&
  Number.isInteger(value[1]);

export let isDocumentAnnotations = (value: unknown): value is DocumentAnnotations => {
  if (!value || typeof value != 'object') return false;

  let annotations = value as Partial<DocumentAnnotations>;
  if (annotations.v !== 1 || typeof annotations.contentHash != 'string') return false;
  if (!Array.isArray(annotations.actors) || !Array.isArray(annotations.blocks)) return false;
  if (!Array.isArray(annotations.comments)) return false;
  if (!annotations.actors.every(actor => typeof actor == 'string')) return false;

  let blocksValid = annotations.blocks.every(
    block =>
      !!block &&
      typeof block.id == 'string' &&
      typeof block.h == 'string' &&
      Array.isArray(block.e) &&
      block.e.every(index => Number.isInteger(index))
  );
  let commentsValid = annotations.comments.every(
    comment =>
      !!comment &&
      typeof comment.t == 'string' &&
      typeof comment.q == 'string' &&
      isIntegerPair(comment.s) &&
      isIntegerPair(comment.e)
  );

  return blocksValid && commentsValid;
};

export let readStoredAnnotations = (d: { content: string; annotations: unknown }) => {
  if (!isDocumentAnnotations(d.annotations)) {
    return {
      annotations: null,
      status: d.annotations == null ? 'missing' : 'invalid'
    } as const;
  }

  if (d.annotations.contentHash !== hashText(d.content)) {
    return { annotations: d.annotations, status: 'mismatch' } as const;
  }

  return { annotations: d.annotations, status: 'verified' } as const;
};

export let getAnnotationsBlockEditors = (annotations: DocumentAnnotations) =>
  annotations.blocks.map(block =>
    normalizeEditors(block.e.map(index => annotations.actors[index]))
  );

export let collectTextblocks = (doc: ProseMirrorNode) => {
  let textblocks: Textblock[] = [];

  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;

    textblocks.push({ node, pos });
    return false;
  });

  return textblocks;
};

export let getTextblockTexts = (doc: ProseMirrorNode) =>
  collectTextblocks(doc).map(textblock => textblock.node.textContent);

export let isAnnotatedTextblock = (node: ProseMirrorNode) =>
  annotatedTextblockTypes.includes(node.type.name);

export let textOffsetToPos = (textblock: Textblock, offset: number) => {
  let pos = textblock.pos + 1;
  let remaining = Math.max(offset, 0);
  let result: number | null = null;

  textblock.node.forEach(child => {
    if (result !== null) return;

    if (child.isText) {
      let length = child.text?.length ?? 0;
      if (remaining <= length) {
        result = pos + remaining;
        return;
      }

      remaining -= length;
    }

    pos += child.nodeSize;
  });

  return result ?? pos;
};

export let posToTextOffset = (textblock: Textblock, pos: number) => {
  let cursor = textblock.pos + 1;
  let offset = 0;
  let result: number | null = null;

  textblock.node.forEach(child => {
    if (result !== null) return;

    if (child.isText) {
      let length = child.text?.length ?? 0;
      if (pos <= cursor + length) {
        result = offset + Math.max(pos - cursor, 0);
        return;
      }

      offset += length;
    } else if (pos <= cursor) {
      result = offset;
      return;
    }

    cursor += child.nodeSize;
  });

  return result ?? offset;
};

let getFlatStarts = (texts: string[]) => {
  let starts: number[] = [];
  let cursor = 0;

  for (let text of texts) {
    starts.push(cursor);
    cursor += text.length + 1;
  }

  return starts;
};

let flatToBlockOffset = (
  starts: number[],
  texts: string[],
  flat: number
): [number, number] => {
  let low = 0;
  let high = starts.length - 1;

  while (low < high) {
    let mid = (low + high + 1) >> 1;
    if (starts[mid]! <= flat) low = mid;
    else high = mid - 1;
  }

  let offset = Math.min(Math.max(flat - (starts[low] ?? 0), 0), texts[low]?.length ?? 0);
  return [low, offset];
};

let findNearestOccurrence = (haystack: string, needle: string, hint: number | null) => {
  if (!needle) return -1;

  let best = -1;
  let index = haystack.indexOf(needle);

  while (index !== -1) {
    if (hint === null) return index;
    if (best === -1 || Math.abs(index - hint) < Math.abs(best - hint)) best = index;
    if (index > hint) break;

    index = haystack.indexOf(needle, index + 1);
  }

  return best;
};

let resolveComment = (d: {
  comment: DocumentAnnotationComment;
  mapBlock: (index: number) => number | undefined;
  texts: string[];
  starts: number[];
  flatText: string;
}): AnnotationModelComment | null => {
  let { comment } = d;
  if (!comment.q) return null;

  let startBlock = d.mapBlock(comment.s[0]);
  let endBlock = d.mapBlock(comment.e[0]);
  let hint = startBlock === undefined ? null : d.starts[startBlock]! + comment.s[1];

  if (startBlock !== undefined && endBlock !== undefined) {
    let from = d.starts[startBlock]! + comment.s[1];
    let to = d.starts[endBlock]! + comment.e[1];
    if (to > from && d.flatText.slice(from, to) === comment.q) {
      return { threadId: comment.t, from, to };
    }
  }

  let index = findNearestOccurrence(d.flatText, comment.q, hint);
  if (index === -1) return null;

  return { threadId: comment.t, from: index, to: index + comment.q.length };
};

let dedupeBlockIds = (blocks: AnnotationModelBlock[]) => {
  let seen = new Set<string>();

  return blocks.map(block => {
    if (!block.id || seen.has(block.id)) {
      let id = generateBlockId();
      seen.add(id);
      return { ...block, id };
    }

    seen.add(block.id);
    return block;
  });
};

export let alignSequences = <T>(a: T[], b: T[]) => {
  let pairs: [number, number][] = [];

  let prefix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) {
    pairs.push([prefix, prefix]);
    prefix++;
  }

  let suffix = 0;
  while (
    suffix < a.length - prefix &&
    suffix < b.length - prefix &&
    a[a.length - 1 - suffix] === b[b.length - 1 - suffix]
  ) {
    suffix++;
  }

  let n = a.length - prefix - suffix;
  let m = b.length - prefix - suffix;

  if (n > 0 && m > 0 && n * m <= maxSequenceAlignmentCells) {
    let width = m + 1;
    let table = new Uint32Array((n + 1) * width);

    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        table[i * width + j] =
          a[prefix + i] === b[prefix + j]
            ? table[(i + 1) * width + j + 1]! + 1
            : Math.max(table[(i + 1) * width + j]!, table[i * width + j + 1]!);
      }
    }

    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (a[prefix + i] === b[prefix + j]) {
        pairs.push([prefix + i, prefix + j]);
        i++;
        j++;
      } else if (table[(i + 1) * width + j]! >= table[i * width + j + 1]!) {
        i++;
      } else {
        j++;
      }
    }
  }

  for (let k = suffix; k > 0; k--) {
    pairs.push([a.length - k, b.length - k]);
  }

  return pairs;
};

let longestCommonSubsequenceLength = (a: string, b: string) => {
  if (!a.length || !b.length) return 0;
  if (a.length * b.length > maxCharacterAlignmentCells) return 0;

  let previous = new Uint32Array(b.length + 1);
  let current = new Uint32Array(b.length + 1);

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      current[j] =
        a.charCodeAt(i - 1) === b.charCodeAt(j - 1)
          ? previous[j - 1]! + 1
          : Math.max(previous[j]!, current[j - 1]!);
    }

    [previous, current] = [current, previous];
  }

  return previous[b.length]!;
};

export let getChangeRatio = (before: string, after: string) => {
  if (before === after) return 0;

  let longest = Math.max(before.length, after.length);
  if (longest === 0) return 0;

  let prefix = 0;
  while (
    prefix < before.length &&
    prefix < after.length &&
    before.charCodeAt(prefix) === after.charCodeAt(prefix)
  ) {
    prefix++;
  }

  let suffix = 0;
  while (
    suffix < before.length - prefix &&
    suffix < after.length - prefix &&
    before.charCodeAt(before.length - 1 - suffix) ===
      after.charCodeAt(after.length - 1 - suffix)
  ) {
    suffix++;
  }

  let common =
    prefix +
    suffix +
    longestCommonSubsequenceLength(
      before.slice(prefix, before.length - suffix),
      after.slice(prefix, after.length - suffix)
    );

  return 1 - common / longest;
};

export let applyEditorChange = (d: {
  editors: string[];
  actorIds: string[];
  promote: boolean;
}) =>
  d.promote
    ? normalizeEditors([...d.actorIds, ...d.editors])
    : normalizeEditors([...d.editors, ...d.actorIds]);

export let modelFromDoc = (doc: ProseMirrorNode): AnnotationModel => {
  let textblocks = collectTextblocks(doc);
  let texts = textblocks.map(textblock => textblock.node.textContent);
  let starts = getFlatStarts(texts);
  let ranges = new Map<string, { from: number; to: number }>();

  let blocks = textblocks.map(({ node }, index) => {
    let offset = 0;

    node.forEach(child => {
      if (!child.isText) return;

      let length = child.text?.length ?? 0;
      for (let mark of child.marks) {
        if (mark.type.name !== commentThreadMarkName) continue;

        let threadId = mark.attrs.threadId as string | null;
        if (!threadId || length === 0) continue;

        let from = starts[index]! + offset;
        let to = from + length;
        let range = ranges.get(threadId);
        ranges.set(threadId, {
          from: range ? Math.min(range.from, from) : from,
          to: range ? Math.max(range.to, to) : to
        });
      }

      offset += length;
    });

    return {
      id: (node.attrs.blockId as string | null) ?? '',
      text: node.textContent,
      editors: normalizeEditors(node.attrs.editors)
    };
  });

  return {
    blocks: dedupeBlockIds(blocks),
    comments: [...ranges.entries()].map(([threadId, range]) => ({ threadId, ...range }))
  };
};

export let encodeAnnotationModel = (
  model: AnnotationModel
): Omit<DocumentAnnotations, 'v' | 'contentHash'> => {
  let actors: string[] = [];
  let actorIndexes = new Map<string, number>();
  let texts = model.blocks.map(block => block.text);
  let starts = getFlatStarts(texts);
  let flatText = texts.join('\n');

  let internActor = (actorId: string) => {
    let index = actorIndexes.get(actorId);
    if (index !== undefined) return index;

    index = actors.length;
    actors.push(actorId);
    actorIndexes.set(actorId, index);
    return index;
  };

  let blocks = model.blocks.map(block => ({
    id: block.id,
    h: hashText(block.text),
    e: normalizeEditors(block.editors).map(internActor)
  }));

  let comments = model.comments
    .filter(comment => comment.to > comment.from)
    .map(comment => ({
      t: comment.threadId,
      s: flatToBlockOffset(starts, texts, comment.from),
      e: flatToBlockOffset(starts, texts, comment.to),
      q: flatText.slice(comment.from, comment.to)
    }));

  return { actors, blocks, comments };
};

export let alignAnnotationsToTexts = (
  annotations: DocumentAnnotations | null,
  texts: string[]
): AnnotationModel => {
  if (!annotations) {
    return {
      blocks: dedupeBlockIds(texts.map(text => ({ id: '', text, editors: [] }))),
      comments: []
    };
  }

  let pairs = alignSequences(
    annotations.blocks.map(block => block.h),
    texts.map(text => hashText(text))
  );
  let textIndexByAnnotationIndex = new Map(pairs);
  let annotationIndexByTextIndex = new Map(pairs.map(([a, t]) => [t, a] as const));
  let blockEditors = getAnnotationsBlockEditors(annotations);

  let blocks = texts.map((text, index) => {
    let annotationIndex = annotationIndexByTextIndex.get(index);
    if (annotationIndex === undefined) return { id: '', text, editors: [] };

    return {
      id: annotations.blocks[annotationIndex]!.id,
      text,
      editors: blockEditors[annotationIndex]!
    };
  });

  let starts = getFlatStarts(texts);
  let flatText = texts.join('\n');
  let comments = annotations.comments
    .map(comment =>
      resolveComment({
        comment,
        mapBlock: index => textIndexByAnnotationIndex.get(index),
        texts,
        starts,
        flatText
      })
    )
    .filter((comment): comment is AnnotationModelComment => !!comment);

  return { blocks: dedupeBlockIds(blocks), comments };
};

export let reconcileAnnotationModel = (d: {
  previous: AnnotationModel;
  texts: string[];
  actorIds: string[];
}): AnnotationModel => {
  let previousTexts = d.previous.blocks.map(block => block.text);
  let pairs = alignSequences(previousTexts, d.texts);
  let previousIndexByTextIndex = new Map<number, number>();
  let modifiedTextIndexes = new Set<number>();

  let previousCursor = 0;
  let textCursor = 0;

  for (let [previousIndex, textIndex] of [
    ...pairs,
    [previousTexts.length, d.texts.length] as [number, number]
  ]) {
    let removedCount = previousIndex - previousCursor;
    let addedCount = textIndex - textCursor;

    for (let k = 0; k < Math.min(removedCount, addedCount); k++) {
      previousIndexByTextIndex.set(textCursor + k, previousCursor + k);
      modifiedTextIndexes.add(textCursor + k);
    }

    if (textIndex < d.texts.length) previousIndexByTextIndex.set(textIndex, previousIndex);

    previousCursor = previousIndex + 1;
    textCursor = textIndex + 1;
  }

  let blocks = d.texts.map((text, index) => {
    let previousIndex = previousIndexByTextIndex.get(index);
    if (previousIndex === undefined) {
      return { id: '', text, editors: normalizeEditors(d.actorIds) };
    }

    let previous = d.previous.blocks[previousIndex]!;
    if (!modifiedTextIndexes.has(index) || !d.actorIds.length) {
      return { id: previous.id, text, editors: previous.editors };
    }

    let promote =
      !previous.text.trim() || getChangeRatio(previous.text, text) >= PRIMARY_EDITOR_THRESHOLD;

    return {
      id: previous.id,
      text,
      editors: applyEditorChange({ editors: previous.editors, actorIds: d.actorIds, promote })
    };
  });

  let textIndexByPreviousIndex = new Map(
    [...previousIndexByTextIndex.entries()].map(([t, p]) => [p, t] as const)
  );
  let previousStarts = getFlatStarts(previousTexts);
  let previousFlatText = previousTexts.join('\n');
  let starts = getFlatStarts(d.texts);
  let flatText = d.texts.join('\n');

  let comments = d.previous.comments
    .map(comment =>
      resolveComment({
        comment: {
          t: comment.threadId,
          s: flatToBlockOffset(previousStarts, previousTexts, comment.from),
          e: flatToBlockOffset(previousStarts, previousTexts, comment.to),
          q: previousFlatText.slice(comment.from, comment.to)
        },
        mapBlock: index => textIndexByPreviousIndex.get(index),
        texts: d.texts,
        starts,
        flatText
      })
    )
    .filter((comment): comment is AnnotationModelComment => !!comment);

  return { blocks: dedupeBlockIds(blocks), comments };
};

let addCommentMark = (tr: Transaction, comment: AnnotationModelComment) => {
  let markType = tr.doc.type.schema.marks[commentThreadMarkName];
  if (!markType) return false;

  let textblocks = collectTextblocks(tr.doc);
  let texts = textblocks.map(textblock => textblock.node.textContent);
  let starts = getFlatStarts(texts);
  let mark = markType.create({ threadId: comment.threadId });
  let applied = false;

  textblocks.forEach((textblock, index) => {
    let blockStart = starts[index]!;
    let blockEnd = blockStart + texts[index]!.length;
    let from = Math.max(comment.from, blockStart);
    let to = Math.min(comment.to, blockEnd);
    if (to <= from) return;

    tr.addMark(
      textOffsetToPos(textblock, from - blockStart),
      textOffsetToPos(textblock, to - blockStart),
      mark
    );
    applied = true;
  });

  return applied;
};

export let applyAnnotationModel = (tr: Transaction, model: AnnotationModel) => {
  let textblocks = collectTextblocks(tr.doc);
  if (textblocks.length !== model.blocks.length) return false;

  textblocks.forEach((textblock, index) => {
    if (!isAnnotatedTextblock(textblock.node)) return;

    let block = model.blocks[index]!;
    tr.setNodeMarkup(textblock.pos, undefined, {
      ...textblock.node.attrs,
      blockId: block.id,
      editors: block.editors
    });
  });

  for (let comment of model.comments) addCommentMark(tr, comment);

  return true;
};

export let resolveCommentAnchor = (doc: ProseMirrorNode, anchor: DocumentCommentAnchor) => {
  let textblocks = collectTextblocks(doc);
  let texts = textblocks.map(textblock => textblock.node.textContent);
  let starts = getFlatStarts(texts);
  let indexByBlockId = new Map(
    textblocks.map((textblock, index) => [textblock.node.attrs.blockId as string, index])
  );

  return resolveComment({
    comment: {
      t: '',
      s: [indexByBlockId.get(anchor.startBlockId) ?? -1, anchor.startOffset],
      e: [indexByBlockId.get(anchor.endBlockId) ?? -1, anchor.endOffset],
      q: anchor.quote
    },
    mapBlock: index => (index >= 0 ? index : undefined),
    texts,
    starts,
    flatText: texts.join('\n')
  });
};

export let addCommentThreadMark = (d: {
  tr: Transaction;
  threadId: string;
  anchor: DocumentCommentAnchor;
}) => {
  let resolved = resolveCommentAnchor(d.tr.doc, d.anchor);
  if (!resolved) return null;

  let comment = { ...resolved, threadId: d.threadId };
  if (!addCommentMark(d.tr, comment)) return null;

  let texts = getTextblockTexts(d.tr.doc);
  return { quote: texts.join('\n').slice(comment.from, comment.to) };
};

export let removeCommentThreadMark = (d: { tr: Transaction; threadId: string }) => {
  let markType = d.tr.doc.type.schema.marks[commentThreadMarkName];
  if (!markType) return false;

  let removed = false;
  d.tr.doc.descendants((node, pos) => {
    if (!node.isText) return true;

    for (let mark of node.marks) {
      if (mark.type !== markType || mark.attrs.threadId !== d.threadId) continue;

      d.tr.removeMark(pos, pos + node.nodeSize, mark);
      removed = true;
    }

    return false;
  });

  return removed;
};

export let getCommentAnchorForRange = (
  doc: ProseMirrorNode,
  range: { from: number; to: number }
): DocumentCommentAnchor | null => {
  let textblocks = collectTextblocks(doc).filter(
    textblock =>
      textblock.pos + textblock.node.nodeSize > range.from && textblock.pos < range.to
  );
  let start = textblocks[0];
  let end = textblocks[textblocks.length - 1];
  if (!start || !end) return null;

  let startBlockId = start.node.attrs.blockId as string | null;
  let endBlockId = end.node.attrs.blockId as string | null;
  if (!startBlockId || !endBlockId) return null;

  let quote = doc.textBetween(range.from, range.to, '\n', '');
  if (!quote.trim()) return null;

  return {
    startBlockId,
    startOffset: posToTextOffset(start, range.from),
    endBlockId,
    endOffset: posToTextOffset(end, range.to),
    quote
  };
};

export let withCommentAnchor = (
  body: DocumentBody,
  comment: { threadId: string; anchor: DocumentCommentAnchor }
) => {
  let blockIndexById = new Map(
    body.annotations.blocks.map((block, index) => [block.id, index])
  );
  let startIndex = blockIndexById.get(comment.anchor.startBlockId);
  let endIndex = blockIndexById.get(comment.anchor.endBlockId);
  if (startIndex === undefined || endIndex === undefined || !comment.anchor.quote) return null;

  return createDocumentBody(body.content, {
    actors: body.annotations.actors,
    blocks: body.annotations.blocks,
    comments: [
      ...body.annotations.comments.filter(existing => existing.t !== comment.threadId),
      {
        t: comment.threadId,
        s: [startIndex, comment.anchor.startOffset],
        e: [endIndex, comment.anchor.endOffset],
        q: comment.anchor.quote
      }
    ]
  });
};

export let withoutCommentAnchor = (body: DocumentBody, threadId: string) =>
  createDocumentBody(body.content, {
    actors: body.annotations.actors,
    blocks: body.annotations.blocks,
    comments: body.annotations.comments.filter(comment => comment.t !== threadId)
  });

export let getAnnotationsCommentThreadIds = (annotations: DocumentAnnotations | null) =>
  new Set((annotations?.comments ?? []).map(comment => comment.t));

let stableStringify = (value: unknown): string => {
  if (value === undefined) return 'null';
  if (value === null || typeof value != 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;

  let entries = Object.entries(value as Record<string, unknown>)
    .filter(([, entry]) => entry !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));

  return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(',')}}`;
};

export let areDocumentBodiesEqual = (
  a: { content: string; annotations: unknown },
  b: { content: string; annotations: unknown }
) =>
  a.content === b.content && stableStringify(a.annotations) === stableStringify(b.annotations);

export let areAnnotationCommentsEqual = (a: unknown, b: unknown) =>
  stableStringify(isDocumentAnnotations(a) ? a.comments : []) ===
  stableStringify(isDocumentAnnotations(b) ? b.comments : []);

import {
  applyEditorChange,
  generateBlockId,
  isAnnotatedTextblock,
  normalizeEditors,
  PRIMARY_EDITOR_THRESHOLD
} from '@metorial/docs-editor-schema';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { Transaction } from '@tiptap/pm/state';
import { Mapping } from '@tiptap/pm/transform';

export type BlockEditStats = {
  baseline: number;
  changed: number;
};

type BlockTouch = {
  inserted: number;
  deleted: number;
  mergedEditors: string[];
};

export type AttributionUpdate = {
  pos: number;
  blockId: string;
  editors: string[];
};

let collectTextblocksBetween = (doc: ProseMirrorNode, from: number, to: number) => {
  let textblocks: { node: ProseMirrorNode; pos: number }[] = [];
  let start = Math.max(0, Math.min(from, doc.content.size));
  let end = Math.max(start, Math.min(to, doc.content.size));

  doc.nodesBetween(start, end, (node, pos) => {
    if (!node.isTextblock) return true;

    textblocks.push({ node, pos });
    return false;
  });

  if (!textblocks.length) {
    let $pos = doc.resolve(start);
    for (let depth = $pos.depth; depth > 0; depth--) {
      let node = $pos.node(depth);
      if (node.isTextblock) {
        textblocks.push({ node, pos: $pos.before(depth) });
        break;
      }
    }
  }

  return textblocks;
};

let collectBlockIds = (doc: ProseMirrorNode) => {
  let ids = new Set<string>();

  doc.descendants(node => {
    if (!node.isTextblock) return true;

    let blockId = node.attrs.blockId as string | null | undefined;
    if (blockId) ids.add(blockId);
    return false;
  });

  return ids;
};

let getTouch = (touches: Map<number, BlockTouch>, pos: number) => {
  let touch = touches.get(pos);
  if (touch) return touch;

  touch = { inserted: 0, deleted: 0, mergedEditors: [] };
  touches.set(pos, touch);
  return touch;
};

let getMappingToFinal = (
  transactions: readonly Transaction[],
  txIndex: number,
  step: number
) => {
  let mapping = new Mapping();
  let tr = transactions[txIndex]!;

  mapping.appendMapping(tr.mapping.slice(step + 1));
  for (let later of transactions.slice(txIndex + 1)) mapping.appendMapping(later.mapping);

  return mapping;
};

export let collectBlockTouches = (transactions: readonly Transaction[]) => {
  let touches = new Map<number, BlockTouch>();
  let finalDoc = transactions[transactions.length - 1]?.doc;
  if (!finalDoc) return touches;

  transactions.forEach((tr, txIndex) => {
    tr.steps.forEach((_step, stepIndex) => {
      let before = tr.docs[stepIndex]!;
      let after = tr.docs[stepIndex + 1] ?? tr.doc;
      let toFinal = getMappingToFinal(transactions, txIndex, stepIndex);
      let afterIds: Set<string> | null = null;

      tr.mapping.maps[stepIndex]!.forEach((oldStart, oldEnd, newStart, newEnd) => {
        let deleted = before.textBetween(oldStart, oldEnd, '', '').length;
        let inserted = after.textBetween(newStart, newEnd, '', '').length;

        afterIds ??= collectBlockIds(after);
        let mergedEditors = collectTextblocksBetween(before, oldStart, oldEnd)
          .filter(({ node }) => {
            let blockId = node.attrs.blockId as string | null;
            return !!blockId && !afterIds!.has(blockId);
          })
          .flatMap(({ node }) => normalizeEditors(node.attrs.editors));

        let from = toFinal.map(newStart, -1);
        let to = toFinal.map(newEnd, 1);
        let targets = collectTextblocksBetween(finalDoc, from, to);
        let first = targets[0];
        if (!first) return;

        let firstTouch = getTouch(touches, first.pos);
        firstTouch.deleted += deleted;
        firstTouch.mergedEditors.push(...mergedEditors);

        if (targets.length === 1) {
          firstTouch.inserted += inserted;
          return;
        }

        for (let target of targets) {
          let blockFrom = Math.max(from, target.pos + 1);
          let blockTo = Math.min(to, target.pos + target.node.nodeSize - 1);
          if (blockTo <= blockFrom) continue;

          getTouch(touches, target.pos).inserted += finalDoc.textBetween(
            blockFrom,
            blockTo,
            '',
            ''
          ).length;
        }
      });
    });
  });

  return touches;
};

export let computeAttributionUpdates = (d: {
  doc: ProseMirrorNode;
  touches: Map<number, BlockTouch>;
  actorId: string | null;
  stats: Map<string, BlockEditStats>;
}) => {
  let updates: AttributionUpdate[] = [];
  let seenIds = new Set<string>();

  d.doc.descendants((node, pos) => {
    if (!node.isTextblock) return true;
    if (!isAnnotatedTextblock(node)) return false;

    let currentId = node.attrs.blockId as string | null;
    let blockId = currentId && !seenIds.has(currentId) ? currentId : generateBlockId();
    seenIds.add(blockId);

    let currentEditors = normalizeEditors(node.attrs.editors);
    let editors = currentEditors;
    let touch = d.touches.get(pos);

    if (touch && d.actorId) {
      if (touch.mergedEditors.length) {
        editors = normalizeEditors([...editors, ...touch.mergedEditors]);
      }

      let changed = touch.inserted + touch.deleted;
      if (changed > 0) {
        let length = node.textContent.length;
        let stats = d.stats.get(blockId) ?? {
          baseline: Math.max(0, length - touch.inserted + touch.deleted),
          changed: 0
        };
        stats.changed += changed;
        d.stats.set(blockId, stats);

        let promote =
          stats.baseline === 0 ||
          stats.changed / Math.max(stats.baseline, length, 1) >= PRIMARY_EDITOR_THRESHOLD;

        editors = applyEditorChange({ editors, actorIds: [d.actorId], promote });
      }
    }

    let editorsChanged =
      editors.length !== currentEditors.length ||
      editors.some((editor, index) => editor !== currentEditors[index]);

    if (blockId !== currentId || editorsChanged) {
      updates.push({ pos, blockId, editors });
    }

    return false;
  });

  return updates;
};

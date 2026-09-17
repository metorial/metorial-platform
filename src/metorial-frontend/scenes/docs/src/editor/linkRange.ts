import type { Transaction } from '@tiptap/pm/state';

export function mapLinkRange(range: { from: number; to: number }, transaction: Transaction) {
  let from = transaction.mapping.mapResult(range.from, 1);
  let to = transaction.mapping.mapResult(range.to, range.from === range.to ? 1 : -1);
  if (
    (from.deletedAcross && to.deletedAcross) ||
    from.pos > to.pos ||
    (range.from !== range.to && from.pos === to.pos)
  )
    return null;
  return { from: from.pos, to: to.pos };
}

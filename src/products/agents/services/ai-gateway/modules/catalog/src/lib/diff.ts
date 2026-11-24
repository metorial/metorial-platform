import { stableStringify } from './stable';

export type RowDiff<Row, Stored> = {
  create: Row[];
  update: { stored: Stored; row: Row }[];
  remove: Stored[];
  unchanged: number;
};

export let diffRows = <Row, Stored extends { removedAt: Date | null }>(d: {
  desired: Row[];
  stored: Stored[];
  key: (row: Row) => string;
  storedKey: (stored: Stored) => string;
  storedRow: (stored: Stored) => Row | null;
}): RowDiff<Row, Stored> => {
  let storedByKey = new Map(d.stored.map(stored => [d.storedKey(stored), stored]));
  let desiredKeys = new Set<string>();

  let diff: RowDiff<Row, Stored> = { create: [], update: [], remove: [], unchanged: 0 };

  for (let row of d.desired) {
    let key = d.key(row);
    if (desiredKeys.has(key)) continue;
    desiredKeys.add(key);

    let stored = storedByKey.get(key);
    if (!stored) {
      diff.create.push(row);
      continue;
    }

    let current = d.storedRow(stored);
    if (stored.removedAt || !current || stableStringify(current) != stableStringify(row)) {
      diff.update.push({ stored, row });
    } else {
      diff.unchanged++;
    }
  }

  for (let stored of d.stored) {
    if (!stored.removedAt && !desiredKeys.has(d.storedKey(stored))) diff.remove.push(stored);
  }

  return diff;
};

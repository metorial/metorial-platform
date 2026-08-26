import { describe, expect, it } from 'vitest';

import { getPendingDestinationFileDeletionsWhere } from './deletions';

describe('getPendingDestinationFileDeletionsWhere', () => {
  let destinationOid = 7n;
  let upTo = new Date('2026-03-01T00:00:00.000Z');

  it('takes every tombstone for a repository that has applied none', () => {
    let where = getPendingDestinationFileDeletionsWhere({
      destinationOid,
      appliedAt: null,
      upTo
    });

    expect(where.createdAt).toEqual({ lte: upTo });
  });

  it('skips tombstones the repository already applied', () => {
    let appliedAt = new Date('2026-02-01T00:00:00.000Z');

    let where = getPendingDestinationFileDeletionsWhere({
      destinationOid,
      appliedAt,
      upTo
    });

    // Exclusive, because the cursor is set to the timestamp of a tombstone that
    // was applied, not to the moment after it.
    expect(where.createdAt).toEqual({ gt: appliedAt, lte: upTo });
  });

  it('never reaches past the bound the cursor will advance to', () => {
    let where = getPendingDestinationFileDeletionsWhere({
      destinationOid,
      appliedAt: new Date('2026-02-01T00:00:00.000Z'),
      upTo
    });

    // A deletion recorded while the propagation runs must be left for the next
    // one instead of being silently marked applied.
    expect(where.createdAt.lte).toBe(upTo);
  });

  it('scopes the query to the destination', () => {
    let where = getPendingDestinationFileDeletionsWhere({
      destinationOid,
      appliedAt: null,
      upTo
    });

    expect(where.destinationOid).toBe(destinationOid);
  });
});

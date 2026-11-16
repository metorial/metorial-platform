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

    expect(where.createdAt).toEqual({ gt: appliedAt, lte: upTo });
  });

  it('never reaches past the bound the cursor will advance to', () => {
    let where = getPendingDestinationFileDeletionsWhere({
      destinationOid,
      appliedAt: new Date('2026-02-01T00:00:00.000Z'),
      upTo
    });

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

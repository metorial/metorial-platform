import { describe, expect, it } from 'bun:test';
import {
  computeWatermark,
  findMissingSequences,
  getFullSyncId,
  getSlatePackReleaseFileName,
  planPackDownload,
  selectIncrementalItems,
  splitIntoParts,
  type ReleaseRef,
  type SlatePackFeedItem
} from './delivery';

let now = new Date('2026-11-13T12:00:00.000Z');

let hour = 60 * 60 * 1000;

let feedItem = (oid: number, versionOid: number | null, size = 10, ageMs = 0) =>
  ({
    oid: BigInt(oid),
    createdAt: new Date(now.getTime() - ageMs),
    version: versionOid === null ? null : { oid: BigInt(versionOid), size }
  }) satisfies SlatePackFeedItem;

let incremental = (sequence: number): ReleaseRef => ({
  id: `inc-${sequence}`,
  kind: 'incremental',
  sequence,
  fullSyncId: null,
  part: null,
  partCount: null,
  coversSequence: null
});

let fullPart = (part: number, partCount: number, coversSequence: number): ReleaseRef => ({
  id: `full-${part}`,
  kind: 'full',
  sequence: null,
  fullSyncId: '202611130000',
  part,
  partCount,
  coversSequence
});

let ids = (releases: ReleaseRef[]) => releases.map(release => release.id);

describe('slate pack release names', () => {
  it('pads sequences and parts so files sort in import order', () => {
    expect(
      getSlatePackReleaseFileName({
        subRegistryId: 'metorial-saas-prod',
        kind: 'incremental',
        sequence: 42
      })
    ).toBe('metorial-saas-prod-inc-000042.slatepack');
    expect(
      getSlatePackReleaseFileName({
        subRegistryId: 'metorial-saas-prod',
        kind: 'full',
        fullSyncId: '202611130000',
        part: 3,
        partCount: 7
      })
    ).toBe('metorial-saas-prod-full-202611130000-p03of07.slatepack');
  });

  it('derives the full sync id from the minute', () => {
    expect(getFullSyncId(new Date('2026-11-13T09:05:59.999Z'))).toBe('202611130905');
  });
});

describe('splitIntoParts', () => {
  it('keeps order and gives oversized items their own part', () => {
    expect(splitIntoParts([4, 4, 4, 20, 1], size => size, 10)).toEqual([
      [4, 4],
      [4],
      [20],
      [1]
    ]);
  });

  it('returns no parts for no items', () => {
    expect(splitIntoParts([], () => 1, 10)).toEqual([]);
  });
});

describe('selectIncrementalItems', () => {
  let select = (items: SlatePackFeedItem[], opts: { isPageFull?: boolean } = {}) =>
    selectIncrementalItems({
      items,
      targetBytes: 100,
      maxPendingAgeMs: 24 * hour,
      now,
      isPageFull: opts.isPageFull ?? false
    });

  it('waits while the pending versions are small and recent', () => {
    expect(select([])).toEqual({ action: 'wait' });
    expect(select([feedItem(1, 1, 10, hour)])).toEqual({ action: 'wait' });
  });

  it('skips past notifications without a packable version', () => {
    expect(select([feedItem(1, null), feedItem(2, null)])).toEqual({
      action: 'advance',
      cursorOid: 2n
    });
  });

  it('seals a pack once the oldest version is old enough', () => {
    expect(select([feedItem(1, 1, 10, 25 * hour), feedItem(2, 2, 10, hour)])).toEqual({
      action: 'build',
      cursorOid: 2n,
      versionOids: [1n, 2n]
    });
  });

  it('stops at the target size and deduplicates versions', () => {
    expect(
      select([feedItem(1, 1, 60), feedItem(2, 1, 60), feedItem(3, 2, 30), feedItem(4, 3, 30)])
    ).toEqual({ action: 'build', cursorOid: 3n, versionOids: [1n, 2n] });
  });

  it('seals a full page even when it is small and recent', () => {
    expect(select([feedItem(1, 1)], { isPageFull: true })).toEqual({
      action: 'build',
      cursorOid: 1n,
      versionOids: [1n]
    });
  });
});

describe('computeWatermark', () => {
  it('advances only through contiguous incremental packs', () => {
    expect(
      computeWatermark({
        watermark: 0,
        incrementalSequences: [1, 2, 4],
        completeFullSyncs: []
      })
    ).toBe(2);
  });

  it('jumps to the newest complete full sync and continues from there', () => {
    expect(
      computeWatermark({
        watermark: 2,
        incrementalSequences: [11, 12, 14],
        completeFullSyncs: [{ coversSequence: 5 }, { coversSequence: 10 }]
      })
    ).toBe(12);
  });

  it('never decreases', () => {
    expect(
      computeWatermark({
        watermark: 20,
        incrementalSequences: [1, 2],
        completeFullSyncs: [{ coversSequence: 10 }]
      })
    ).toBe(20);
  });
});

describe('findMissingSequences', () => {
  it('lists gaps between the watermark and the highest imported pack', () => {
    expect(
      findMissingSequences({ watermark: 2, incrementalSequences: [3, 6, 8], limit: 10 })
    ).toEqual([4, 5, 7]);
  });

  it('respects the limit and reports nothing without gaps', () => {
    expect(
      findMissingSequences({ watermark: 0, incrementalSequences: [10], limit: 3 })
    ).toEqual([1, 2, 3]);
    expect(findMissingSequences({ watermark: 5, incrementalSequences: [], limit: 3 })).toEqual(
      []
    );
  });
});

describe('planPackDownload', () => {
  let plan = (d: Partial<Parameters<typeof planPackDownload<ReleaseRef>>[0]>) =>
    planPackDownload<ReleaseRef>({
      fromSequence: null,
      mode: 'auto',
      latestSequence: 12,
      incrementals: [5, 6, 7, 8, 9, 10, 11, 12].map(incremental),
      latestFullSync: [fullPart(2, 2, 10), fullPart(1, 2, 10)],
      maxReleases: 100,
      ...d
    });

  it('returns the packs after the last import', () => {
    let result = plan({ fromSequence: 9 });

    expect(result.reason).toBe('incremental');
    expect(ids(result.releases)).toEqual(['inc-10', 'inc-11', 'inc-12']);
  });

  it('reports an installation that is up to date', () => {
    let result = plan({ fromSequence: 12 });

    expect(result.reason).toBe('up_to_date');
    expect(result.releases).toEqual([]);
  });

  it('starts with the full sync parts in order, then newer packs', () => {
    let result = plan({ fromSequence: null });

    expect(result.mode).toBe('full');
    expect(result.reason).toBe('first_sync');
    expect(ids(result.releases)).toEqual(['full-1', 'full-2', 'inc-11', 'inc-12']);
  });

  it('falls back to a full sync when needed packs were pruned', () => {
    let result = plan({ fromSequence: 2 });

    expect(result.reason).toBe('too_far_behind');
    expect(ids(result.releases)).toEqual(['full-1', 'full-2', 'inc-11', 'inc-12']);
  });

  it('accepts a resume right before the oldest kept pack', () => {
    expect(plan({ fromSequence: 4 }).reason).toBe('incremental');
  });

  it('honours a requested full sync', () => {
    expect(plan({ fromSequence: 11, mode: 'full' }).reason).toBe('requested_full');
  });

  it('uses incremental packs from the start before the first full sync exists', () => {
    let result = plan({
      latestSequence: 2,
      incrementals: [incremental(1), incremental(2)],
      latestFullSync: null
    });

    expect(result.mode).toBe('incremental');
    expect(ids(result.releases)).toEqual(['inc-1', 'inc-2']);
  });

  it('truncates long plans', () => {
    let result = plan({ fromSequence: 4, maxReleases: 3 });

    expect(result.truncated).toBe(true);
    expect(ids(result.releases)).toEqual(['inc-5', 'inc-6', 'inc-7']);
  });
});

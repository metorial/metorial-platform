import { describe, expect, it } from 'vitest';
import {
  filteredSliceFilter,
  isRecordRetentionExpired,
  parseRebuildCursor,
  planLayers,
  rebuildTargetOf,
  serializeRebuildCursor,
  sessionlessPageFilter,
  sessionPageFilter,
  sliceFilterClauses,
  takenKeysFilter,
  type RebuildTarget
} from '../src/lib/plan';
import {
  behindLayers,
  currentVersions,
  isEmptyRebuildFilter,
  mergeRebuildFilters,
  normalizeLayers,
  normalizeRebuildFilter,
  type RebuildFilter,
  rebuildFilterSize,
  versionRebuildReason
} from '@mtsrc/agent-tracking-layers';

let day = 24 * 60 * 60 * 1000;

let range = { from: new Date('2026-01-01T00:00:00Z'), to: new Date('2026-02-01T00:00:00Z') };

let target = (overrides: Partial<RebuildTarget> = {}): RebuildTarget => ({
  scope: { organizationId: 'ator_a' },
  range,
  layers: ['summary', 'attribution', 'facts'],
  onlyBehind: false,
  filter: null,
  ...overrides
});

let filtered = (filter: RebuildFilter, overrides: Partial<RebuildTarget> = {}) => ({
  ...target(overrides),
  filter
});

let run = (overrides: Record<string, unknown> = {}) =>
  ({
    layers: ['facts', 'attribution'],
    reason: 'manual',
    rangeFrom: range.from,
    rangeTo: range.to,
    organization: { id: 'ator_a' },
    project: null,
    instance: null,
    ...overrides
  }) as unknown as Parameters<typeof rebuildTargetOf>[0];

describe('rebuild targets', () => {
  it('builds the target from the run row', () => {
    expect(rebuildTargetOf(run())).toEqual({
      scope: { organizationId: 'ator_a' },
      range,
      layers: ['attribution', 'facts'],
      onlyBehind: false,
      filter: null
    });
    expect(
      rebuildTargetOf(run({ filter: { modelIds: ['b', 'a', 'a'], vendorIds: [] } })).filter
    ).toEqual({ modelIds: ['a', 'b'] });

    expect(
      rebuildTargetOf(
        run({
          reason: versionRebuildReason,
          instance: { id: 'atin_a', project: { id: 'atpr_a' } }
        })
      )
    ).toMatchObject({
      scope: { organizationId: 'ator_a', projectId: 'atpr_a', instanceId: 'atin_a' },
      onlyBehind: true
    });

    expect(rebuildTargetOf(run({ project: { id: 'atpr_b' } })).scope).toEqual({
      organizationId: 'ator_a',
      projectId: 'atpr_b'
    });
  });

  it('orders and dedupes layers', () => {
    expect(normalizeLayers(['facts', 'summary', 'facts', 'bogus'])).toEqual([
      'summary',
      'facts'
    ]);
  });
});

describe('session pages', () => {
  it('filters by scope and range', () => {
    expect(
      sessionPageFilter(target({ scope: { organizationId: 'ator_a', instanceId: 'atin_a' } }))
    ).toEqual({
      organizationId: 'ator_a',
      instanceId: 'atin_a',
      startedAt: { $gte: range.from, $lt: range.to }
    });
  });

  it('continues newest first after the cursor', () => {
    let after = { startedAt: '2026-01-15T00:00:00.000Z', key: 'session_b' };

    expect(sessionPageFilter(target(), after).$and).toEqual([
      {
        $or: [
          { startedAt: { $lt: new Date(after.startedAt) } },
          { startedAt: new Date(after.startedAt), _id: { $gt: 'session_b' } }
        ]
      }
    ]);
  });

  it('only matches sessions behind a requested layer in version runs', () => {
    let filter = sessionPageFilter(
      target({ layers: ['summary', 'attribution'], onlyBehind: true })
    );

    expect(filter.$and).toEqual([
      {
        $or: [
          { 'versions.summary': { $lt: currentVersions.summary }, frozen: { $ne: true } },
          { 'versions.attribution': { $lt: currentVersions.attribution } }
        ]
      }
    ]);
  });
});

describe('sessionless pages', () => {
  it('walks sessionless keys after the cursor', () => {
    expect(
      sessionlessPageFilter(
        target({ scope: { organizationId: 'ator_a', projectId: 'atpr_a' } }),
        'k1'
      )
    ).toEqual({
      organizationId: 'ator_a',
      projectId: 'atpr_a',
      sessionlessKey: { $exists: true, $gt: 'k1' },
      bucket: { $gte: range.from, $lt: range.to }
    });
  });

  it('matches stale slice versions in version runs, every bucket for summary', () => {
    expect(
      sessionlessPageFilter(target({ layers: ['attribution', 'facts'], onlyBehind: true })).$or
    ).toEqual([
      { attributionVersion: { $lt: currentVersions.attribution } },
      { factsVersion: { $lt: currentVersions.facts } }
    ]);
    expect(
      sessionlessPageFilter(target({ layers: ['summary', 'attribution'], onlyBehind: true }))
        .$or
    ).toBeUndefined();
  });
});

describe('rebuild filters', () => {
  it('normalizes, merges and measures filters', () => {
    expect(
      normalizeRebuildFilter({ modelIds: ['b', 'a', 'b'], modelRaws: [], vendorIds: ['v'] })
    ).toEqual({ modelIds: ['a', 'b'], vendorIds: ['v'] });

    expect(
      mergeRebuildFilters(
        { modelIds: ['a'], modelRaws: ['raw-1'] },
        { modelIds: ['b', 'a'], modelRaws: ['raw-2'], clientFamilies: ['codex'] }
      )
    ).toEqual({
      modelIds: ['a', 'b'],
      modelRaws: ['raw-1', 'raw-2'],
      clientFamilies: ['codex']
    });
    expect(mergeRebuildFilters({ modelIds: ['a'] }, null)).toBeNull();
    expect(mergeRebuildFilters(null, { modelIds: ['a'] })).toBeNull();

    expect(isEmptyRebuildFilter({})).toBe(true);
    expect(isEmptyRebuildFilter({ modelIds: [] })).toBe(true);
    expect(isEmptyRebuildFilter({ vendorIds: ['v'] })).toBe(false);
    expect(rebuildFilterSize({ modelIds: ['a', 'b'], modelRaws: ['r'] })).toBe(3);
    expect(rebuildFilterSize(null)).toBe(0);
  });

  it('builds one indexed clause per filter field', () => {
    expect(
      sliceFilterClauses({
        modelIds: ['m'],
        modelRaws: ['raw'],
        vendorIds: ['v'],
        clientFamilies: ['claude-code']
      })
    ).toEqual([
      { modelId: { $in: ['m'] } },
      { modelRaw: { $in: ['raw'] } },
      { vendorId: { $in: ['v'] } },
      { 'client.family': { $in: ['claude-code'] } }
    ]);
  });

  it('selects matching slices in scope and range', () => {
    expect(
      filteredSliceFilter(
        filtered(
          { modelIds: ['m'] },
          { scope: { organizationId: 'ator_a', projectId: 'atpr_a' } }
        )
      )
    ).toEqual({
      organizationId: 'ator_a',
      projectId: 'atpr_a',
      bucket: { $gte: range.from, $lt: range.to },
      modelId: { $in: ['m'] }
    });

    let before = new Date('2026-01-20T00:00:00Z');
    expect(
      filteredSliceFilter(filtered({ modelIds: ['m'], vendorIds: ['v'] }), { before })
    ).toEqual({
      organizationId: 'ator_a',
      bucket: { $gte: range.from, $lt: before },
      $or: [{ modelId: { $in: ['m'] } }, { vendorId: { $in: ['v'] } }]
    });

    expect(filteredSliceFilter(filtered({}))._id).toEqual({ $in: [] });
  });

  it('finds keys already taken by newer pages', () => {
    let before = new Date('2026-01-20T00:00:00Z');

    expect(
      takenKeysFilter(filtered({ modelIds: ['m'] }), {
        owner: 'sessionKey',
        keys: ['s1', 's2'],
        before
      })
    ).toEqual({
      organizationId: 'ator_a',
      bucket: { $gte: before, $lt: range.to },
      modelId: { $in: ['m'] },
      sessionKey: { $in: ['s1', 's2'] }
    });
  });
});

describe('layer planning', () => {
  it('keeps the requested layers for live sessions', () => {
    expect(
      planLayers({ requested: ['summary', 'attribution', 'facts'], frozen: false })
    ).toEqual(['summary', 'attribution', 'facts']);
  });

  it('only rebuilds attribution for frozen sessions', () => {
    expect(
      planLayers({ requested: ['summary', 'attribution', 'facts'], frozen: true })
    ).toEqual(['attribution']);
    expect(planLayers({ requested: ['summary', 'facts'], frozen: true })).toEqual([]);
  });

  it('limits version runs to the layers a session is behind on', () => {
    expect(
      planLayers({
        requested: ['summary', 'attribution', 'facts'],
        frozen: false,
        behind: ['facts']
      })
    ).toEqual(['facts']);
    expect(
      planLayers({ requested: ['summary', 'attribution'], frozen: true, behind: ['summary'] })
    ).toEqual([]);
  });

  it('detects layers built with older versions', () => {
    expect(behindLayers({ ...currentVersions })).toEqual([]);
    expect(
      behindLayers({ ...currentVersions, attribution: currentVersions.attribution - 1 })
    ).toEqual(['attribution']);
    expect(behindLayers({ summary: 0, attribution: 0, facts: 0 })).toEqual([
      'summary',
      'attribution',
      'facts'
    ]);
    expect(behindLayers(undefined)).toEqual(['summary', 'attribution', 'facts']);
  });

  it('freezes sessions once their raw records expired', () => {
    let now = new Date('2026-06-01T00:00:00Z');

    expect(
      isRecordRetentionExpired({
        at: new Date(now.getTime() - 91 * day),
        recordRetentionDays: 90,
        now
      })
    ).toBe(true);
    expect(
      isRecordRetentionExpired({
        at: new Date(now.getTime() - 89 * day),
        recordRetentionDays: 90,
        now
      })
    ).toBe(false);
  });
});

describe('cursors', () => {
  it('starts at the first session page and round-trips', () => {
    expect(parseRebuildCursor(null)).toEqual({ phase: 'sessions', enqueued: 0 });

    let cursor = { phase: 'sessionless' as const, enqueued: 12, after: { key: 'k' } };
    expect(parseRebuildCursor(serializeRebuildCursor(cursor))).toEqual(cursor);
  });
});

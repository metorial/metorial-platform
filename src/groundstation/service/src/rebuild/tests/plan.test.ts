import { describe, expect, it } from 'vitest';
import {
  behindLayers,
  currentVersions,
  isRecordRetentionExpired,
  normalizeLayers,
  parseRebuildCursor,
  planLayers,
  rebuildTargetOf,
  serializeRebuildCursor,
  sessionlessPageFilter,
  sessionPageFilter,
  versionRebuildReason,
  type RebuildTarget
} from '../plan';

let day = 24 * 60 * 60 * 1000;

let range = { from: new Date('2026-01-01T00:00:00Z'), to: new Date('2026-02-01T00:00:00Z') };

let target = (overrides: Partial<RebuildTarget> = {}): RebuildTarget => ({
  scope: { organizationId: 'gor_a' },
  range,
  layers: ['summary', 'attribution', 'facts'],
  onlyBehind: false,
  ...overrides
});

let run = (overrides: Record<string, unknown> = {}) =>
  ({
    layers: ['facts', 'attribution'],
    reason: 'manual',
    rangeFrom: range.from,
    rangeTo: range.to,
    organization: { id: 'gor_a' },
    project: null,
    instance: null,
    ...overrides
  }) as unknown as Parameters<typeof rebuildTargetOf>[0];

describe('rebuild targets', () => {
  it('builds the target from the run row', () => {
    expect(rebuildTargetOf(run())).toEqual({
      scope: { organizationId: 'gor_a' },
      range,
      layers: ['attribution', 'facts'],
      onlyBehind: false
    });

    expect(
      rebuildTargetOf(
        run({
          reason: versionRebuildReason,
          instance: { id: 'gin_a', project: { id: 'gpr_a' } }
        })
      )
    ).toMatchObject({
      scope: { organizationId: 'gor_a', projectId: 'gpr_a', instanceId: 'gin_a' },
      onlyBehind: true
    });

    expect(rebuildTargetOf(run({ project: { id: 'gpr_b' } })).scope).toEqual({
      organizationId: 'gor_a',
      projectId: 'gpr_b'
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
      sessionPageFilter(target({ scope: { organizationId: 'gor_a', instanceId: 'gin_a' } }))
    ).toEqual({
      organizationId: 'gor_a',
      instanceId: 'gin_a',
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
        target({ scope: { organizationId: 'gor_a', projectId: 'gpr_a' } }),
        'k1'
      )
    ).toEqual({
      organizationId: 'gor_a',
      projectId: 'gpr_a',
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

import { describe, expect, it } from 'vitest';
import { applyContinuity } from '../src/pipeline/continuity';
import type { Catalog, Model, Name, Offering, Pointer } from '../src/types';

let t0 = '2026-01-01T00:00:00.000Z';
let t1 = '2026-01-01T01:00:00.000Z';

let model = (id: string) => ({ id, status: 'active', offeringCount: 1 }) as Model;

let offering = (
  id: string,
  input: number,
  method: Offering['resolution']['method'] = 'exact-key'
) =>
  ({
    id,
    status: 'active',
    pricing: {
      text: { input, output: input * 5, cacheRead: null, cacheWrite: [], reasoning: null }
    },
    resolution: { method, upstreamCanonicalId: null, overrideId: null },
    firstSeenAt: t1
  }) as unknown as Offering;

let pointer = (id: string, modelId: string) =>
  ({
    id,
    labId: 'anthropic',
    familyId: null,
    target: { kind: 'model', modelId },
    history: [],
    evidence: 'x'
  }) as Pointer;

let name = (id: string, modelId: string, seen: string) =>
  ({
    id,
    target: { kind: 'model', modelId },
    history: [],
    origin: 'observed',
    status: 'live',
    firstSeenAt: seen
  }) as unknown as Name;

let catalog = (parts: Partial<Catalog>): Catalog => ({
  schemaVersion: 1,
  generatedAt: t1,
  sources: [],
  organizations: [],
  families: [],
  models: [],
  releases: [],
  pointers: [],
  vendors: [],
  endpoints: [],
  offerings: [],
  names: [],
  agents: [],
  ...parts
});

describe('applyContinuity', () => {
  it('starts histories on a first build', () => {
    let { catalog: result, diff } = applyContinuity(
      catalog({ names: [name('a:x', 'm/1', t0)] }),
      null,
      t0
    );

    expect(diff.hasPrevious).toBe(false);
    expect(result.names[0]!.history).toEqual([
      { target: { kind: 'model', modelId: 'm/1' }, from: t0, to: null, evidence: 'observed' }
    ]);
  });

  it('closes and opens target periods when a pointer moves', () => {
    let previous = applyContinuity(
      catalog({ pointers: [pointer('p/latest', 'm/1')] }),
      null,
      t0
    ).catalog;
    let { catalog: result, diff } = applyContinuity(
      catalog({ pointers: [pointer('p/latest', 'm/2')] }),
      previous,
      t1
    );

    expect(diff.retargetedPointers).toHaveLength(1);
    expect(
      result.pointers[0]!.history.map(period => [period.target, period.from, period.to])
    ).toEqual([
      [{ kind: 'model', modelId: 'm/1' }, t0, t1],
      [{ kind: 'model', modelId: 'm/2' }, t1, null]
    ]);
  });

  it('keeps vanished entities as retired and reports changes', () => {
    let previous = catalog({
      models: [model('m/1'), model('m/old')],
      offerings: [offering('v:a', 1), offering('v:gone', 1)],
      names: [name('v:a', 'm/1', t0), name('v:gone', 'm/old', t0)]
    });
    previous.offerings.forEach(item => (item.firstSeenAt = t0));

    let current = catalog({
      models: [model('m/1'), model('m/new')],
      offerings: [offering('v:a', 2), offering('v:b', 1, 'unresolved')],
      names: [name('v:a', 'm/1', t1)]
    });

    let { catalog: result, diff } = applyContinuity(current, previous, t1);

    expect(diff.newModels).toEqual(['m/new']);
    expect(diff.retiredModels).toEqual(['m/old']);
    expect(diff.newOfferings).toEqual(['v:b']);
    expect(diff.retiredOfferings).toEqual(['v:gone']);
    expect(diff.newlyUnresolved).toEqual(['v:b']);
    expect(
      diff.priceChanges.map(change => [
        change.offeringId,
        change.before?.input,
        change.after?.input
      ])
    ).toEqual([['v:a', 1, 2]]);

    expect(result.models.find(item => item.id === 'm/old')).toMatchObject({
      status: 'retired',
      offeringCount: 0
    });
    expect(result.offerings.find(item => item.id === 'v:gone')?.status).toBe('retired');
    expect(result.offerings.find(item => item.id === 'v:a')?.firstSeenAt).toBe(t0);
    expect(result.names.find(item => item.id === 'v:gone')?.status).toBe('gone');
    expect(result.names.find(item => item.id === 'v:a')?.firstSeenAt).toBe(t0);
  });

  it('counts live and repriced offerings for the deploy gate', () => {
    let unpriced = { ...offering('v:unpriced', 1), pricing: null } as Offering;
    let retired = { ...offering('v:retired', 1), status: 'retired' } as Offering;
    let previous = catalog({
      offerings: [
        offering('v:same', 1),
        offering('v:repriced', 1),
        offering('v:dropped', 1),
        unpriced,
        retired
      ]
    });

    let current = catalog({
      offerings: [
        offering('v:same', 1),
        offering('v:repriced', 2),
        offering('v:unpriced', 3),
        offering('v:retired', 2)
      ]
    });

    let { diff } = applyContinuity(current, previous, t1);

    expect(diff.priceChanges.map(change => change.offeringId)).toEqual([
      'v:repriced',
      'v:unpriced',
      'v:retired'
    ]);
    expect(diff).toMatchObject({
      previousLiveOfferings: 4,
      previousPricedOfferings: 3,
      repricedOfferings: 1,
      liveOfferings: 4
    });
  });

  it('counts live offerings without a previous catalog', () => {
    let { diff } = applyContinuity(catalog({ offerings: [offering('v:a', 1)] }), null, t0);

    expect(diff).toMatchObject({
      liveOfferings: 1,
      previousLiveOfferings: 0,
      previousPricedOfferings: 0,
      repricedOfferings: 0
    });
  });
});

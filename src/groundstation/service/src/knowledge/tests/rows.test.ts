import type { Catalog } from '@metorial/model-catalog/src/types';
import { describe, expect, it } from 'vitest';
import {
  buildEntityRows,
  canonicalJson,
  emptyStoredState,
  hashValue,
  pricingHashOf,
  vendorModelKey,
  type StoredState
} from '../rows';
import { tableSpecs } from '../tables';
import type { KnowledgeEntityName } from '../types';
import {
  agent,
  catalog,
  endpoint,
  model,
  modelTarget,
  name,
  offering,
  period,
  pointerTarget,
  pricing,
  release,
  seenAt,
  storeCatalog
} from './fixtures';

let earlier = '2024-06-01T00:00:00.000Z';
let later = '2025-06-01T00:00:00.000Z';

let diffFor = (result: ReturnType<typeof buildEntityRows>, entity: KnowledgeEntityName) =>
  result.diffs.find(diff => diff.spec.entity == entity)!;

let build = (incoming: Catalog, stored: StoredState = emptyStoredState()) =>
  buildEntityRows({ catalog: incoming, stored });

let ids = (rows: { id: string }[]) => rows.map(row => row.id).sort();

describe('canonicalJson', () => {
  it('sorts object keys at every level', () => {
    let a = canonicalJson({ b: 1, a: { d: 2, c: [3, { z: 1, y: 2 }] } });
    let b = canonicalJson({ a: { c: [3, { y: 2, z: 1 }], d: 2 }, b: 1 });

    expect(a).toBe(b);
    expect(a).toBe('{"a":{"c":[3,{"y":2,"z":1}],"d":2},"b":1}');
  });

  it('drops undefined object values but keeps nulls', () => {
    expect(canonicalJson({ a: 1, b: undefined, c: null })).toBe('{"a":1,"c":null}');
    expect(canonicalJson(undefined)).toBe('null');
  });

  it('keeps array order', () => {
    expect(canonicalJson([1, 2])).not.toBe(canonicalJson([2, 1]));
  });
});

describe('hashValue', () => {
  it('is independent of key order and undefined values', () => {
    expect(hashValue({ a: 1, b: { c: 2, d: 3 } })).toBe(
      hashValue({ b: { d: 3, c: 2, e: undefined }, a: 1 })
    );
  });

  it('distinguishes array order and values', () => {
    expect(hashValue([1, 2])).not.toBe(hashValue([2, 1]));
    expect(hashValue({ a: 1 })).not.toBe(hashValue({ a: 2 }));
  });
});

describe('helpers', () => {
  it('hashes pricing only when present', () => {
    let price = pricing(3);

    expect(pricingHashOf(price)).toBe(hashValue(price));
    expect(pricingHashOf(null)).toBeNull();
    expect(pricingHashOf(undefined)).toBeNull();
  });

  it('builds a vendor model key only when the model is known', () => {
    expect(vendorModelKey('vendor', 'model')).toBe('vendor\0model');
    expect(vendorModelKey('vendor', null)).toBeNull();
  });

  it('starts with an empty map per entity', () => {
    let state = emptyStoredState();

    expect(Object.keys(state).sort()).toEqual(tableSpecs.map(spec => spec.entity).sort());
    expect(Object.values(state).every(rows => rows.size == 0)).toBe(true);
  });
});

describe('buildEntityRows', () => {
  it('ignores lastSeenAt in data and content hash', () => {
    let first = build(catalog({ offerings: [offering('o', { lastSeenAt: seenAt })] }));
    let second = build(catalog({ offerings: [offering('o', { lastSeenAt: later })] }));

    let row = diffFor(first, 'offering').rows.get('o')!;

    expect(row.data).not.toHaveProperty('lastSeenAt');
    expect(row.contentHash).toBe(diffFor(second, 'offering').rows.get('o')!.contentHash);
  });

  it('treats a republished catalog that only moves lastSeenAt as unchanged', () => {
    let stored = storeCatalog(catalog({ offerings: [offering('o')], names: [name('n')] }));

    let result = build(
      catalog({
        offerings: [offering('o', { lastSeenAt: later })],
        names: [name('n', { lastSeenAt: later })]
      }),
      stored
    );

    for (let diff of result.diffs) {
      expect(diff.added).toEqual([]);
      expect(diff.changed).toEqual([]);
      expect(diff.removed).toEqual([]);
    }
  });

  it('classifies added, changed, unchanged, restored and removed rows', () => {
    let stored = storeCatalog(
      catalog({
        offerings: [
          offering('same'),
          offering('edited'),
          offering('restored'),
          offering('dropped'),
          offering('gone')
        ]
      })
    );
    stored.offering.get('restored')!.removed = true;
    stored.offering.get('gone')!.removed = true;

    let result = build(
      catalog({
        offerings: [
          offering('same'),
          offering('edited', { name: 'Edited' }),
          offering('restored'),
          offering('new')
        ]
      }),
      stored
    );
    let diff = diffFor(result, 'offering');

    expect(ids(diff.added)).toEqual(['new']);
    expect(ids(diff.changed)).toEqual(['edited', 'restored']);
    expect(diff.removed).toEqual(['dropped']);
    expect([...diff.rows.keys()].sort()).toEqual(['edited', 'new', 'restored', 'same']);
  });

  it('keeps the first occurrence of a duplicated id', () => {
    let result = build(
      catalog({
        offerings: [offering('o', { name: 'First' }), offering('o', { name: 'Second' })]
      })
    );
    let diff = diffFor(result, 'offering');

    expect(diff.rows.size).toBe(1);
    expect(diff.rows.get('o')!.columns.name).toBe('First');
    expect(ids(diff.added)).toEqual(['o']);
  });

  it('never moves an offering firstSeenAt later', () => {
    let stored = storeCatalog(
      catalog({
        offerings: [
          offering('kept', { firstSeenAt: earlier }),
          offering('moved', { firstSeenAt: later })
        ]
      })
    );

    let result = build(
      catalog({
        offerings: [
          offering('kept', { firstSeenAt: later }),
          offering('moved', { firstSeenAt: earlier })
        ]
      }),
      stored
    );
    let diff = diffFor(result, 'offering');

    expect(diff.rows.get('kept')!.data).toMatchObject({
      firstSeenAt: earlier,
      reportedFirstSeenAt: later
    });
    expect(diff.rows.get('moved')!.data.firstSeenAt).toBe(earlier);
    expect(diff.rows.get('moved')!.data).not.toHaveProperty('reportedFirstSeenAt');
    expect(result.regressions.firstSeenClamped.offering).toEqual(['kept']);
    expect(ids(diff.changed)).toEqual(['kept', 'moved']);
  });

  it('never moves a name firstSeenAt later', () => {
    let stored = storeCatalog(
      catalog({
        names: [name('kept', { firstSeenAt: earlier }), name('moved', { firstSeenAt: later })]
      })
    );

    let result = build(
      catalog({
        names: [name('kept', { firstSeenAt: later }), name('moved', { firstSeenAt: earlier })]
      }),
      stored
    );
    let diff = diffFor(result, 'name');

    expect(diff.rows.get('kept')!.data.firstSeenAt).toBe(earlier);
    expect(diff.rows.get('moved')!.data.firstSeenAt).toBe(earlier);
    expect(result.regressions.firstSeenClamped.name).toEqual(['kept']);
    expect(result.regressions.firstSeenClamped.offering).toEqual([]);
  });

  it('reports names whose history disappears or starts later', () => {
    let history = [
      period(modelTarget('model'), earlier, later),
      period(modelTarget('model'), later)
    ];
    let stored = storeCatalog(
      catalog({
        names: [
          name('emptied', { history }),
          name('shortened', { history }),
          name('extended', { history }),
          name('kept', { history }),
          name('never')
        ]
      })
    );

    let result = build(
      catalog({
        names: [
          name('emptied'),
          name('shortened', { history: [period(modelTarget('model'), later)] }),
          name('extended', {
            history: [period(modelTarget('model'), '2023-01-01T00:00:00.000Z'), ...history]
          }),
          name('kept', { history }),
          name('never')
        ]
      }),
      stored
    );

    expect(result.regressions.historyLost.sort()).toEqual(['emptied', 'shortened']);
  });

  it('derives the offering pricing hash from incoming pricing or the stored one', () => {
    let stored = storeCatalog(
      catalog({
        offerings: [
          offering('kept'),
          offering('repriced'),
          offering('unpriced', { pricing: null })
        ]
      })
    );

    let result = build(
      catalog({
        offerings: [
          offering('kept', { pricing: null }),
          offering('repriced', { pricing: pricing(2) }),
          offering('unpriced', { pricing: null }),
          offering('fresh', { pricing: null })
        ]
      }),
      stored
    );
    let rows = diffFor(result, 'offering').rows;

    expect(rows.get('kept')!.columns.pricingHash).toBe(pricingHashOf(pricing(1)));
    expect(rows.get('repriced')!.columns.pricingHash).toBe(pricingHashOf(pricing(2)));
    expect(rows.get('unpriced')!.columns.pricingHash).toBeNull();
    expect(rows.get('fresh')!.columns.pricingHash).toBeNull();
  });

  it('promotes the queryable columns', () => {
    let result = build(
      catalog({
        models: [
          model('model', {
            capabilities: {
              tools: true,
              toolChoice: null,
              structuredOutput: false,
              reasoning: { toggle: true, effort: null },
              temperature: false,
              promptCaching: { implicit: true, explicit: false, ttls: [] },
              attachments: true
            }
          })
        ],
        releases: [release('model@2025')],
        offerings: [
          offering('variant', {
            variant: {
              serving: 'priority',
              reasoning: null,
              quantization: null,
              free: true,
              region: 'eu'
            }
          }),
          offering('plain')
        ],
        names: [
          name('by-release', {
            target: { kind: 'release', releaseId: 'model@2025', modelId: 'model' }
          }),
          name('by-pointer', { target: pointerTarget('latest') })
        ],
        agents: [
          agent('Claude Code', {
            aliases: ['claude_code', 'other:Claude.Code', 'CC'],
            vendors: [
              { vendorId: 'vendor', role: 'supported' },
              { vendorId: 'other', role: 'default' }
            ]
          })
        ],
        endpoints: [
          endpoint('api', { baseUrl: 'https://API.Example.com:8443/v1' }),
          endpoint('broken', { baseUrl: 'not a url' })
        ]
      })
    );

    let columns = (entity: KnowledgeEntityName, id: string) =>
      diffFor(result, entity).rows.get(id)!.columns;

    expect(columns('model', 'model').capabilities).toEqual([
      'tools',
      'reasoning',
      'caching',
      'attachments'
    ]);
    expect(columns('offering', 'variant')).toMatchObject({
      variantKey: 'serving=priority,region=eu,free',
      free: true
    });
    expect(columns('offering', 'plain')).toMatchObject({ variantKey: '', free: false });
    expect(columns('name', 'by-release').targetModelId).toBe('model');
    expect(columns('name', 'by-pointer').targetModelId).toBeNull();
    expect(columns('agent', 'Claude Code')).toMatchObject({
      aliasKeys: ['cc', 'claude-code'],
      defaultVendorId: 'other',
      vendorIds: ['vendor', 'other']
    });
    expect(columns('endpoint', 'api').baseUrlHost).toBe('api.example.com:8443');
    expect(columns('endpoint', 'broken').baseUrlHost).toBeNull();
  });
});

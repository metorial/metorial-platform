import type { Catalog } from '@metorial/model-catalog/src/types';
import { describe, expect, it } from 'vitest';
import { collectAnomalies, evaluateGuardrails, findDanglingReferences } from '../guardrails';
import { buildEntityRows, emptyStoredState, type StoredState } from '../rows';
import {
  agent,
  catalog,
  endpoint,
  model,
  modelTarget,
  name,
  offering,
  organization,
  period,
  pointer,
  pointerTarget,
  pricing,
  range,
  release,
  storeCatalog,
  vendor
} from './fixtures';

let earlier = '2024-06-01T00:00:00.000Z';
let later = '2025-06-01T00:00:00.000Z';

let analyze = (incoming: Catalog, stored: StoredState = emptyStoredState()) => {
  let { diffs, regressions } = buildEntityRows({ catalog: incoming, stored });
  let dangling = findDanglingReferences(incoming);

  return { catalog: incoming, stored, diffs, regressions, dangling };
};

let evaluate = (incoming: Catalog, stored?: StoredState) =>
  evaluateGuardrails(analyze(incoming, stored));

let anomalies = (incoming: Catalog, stored?: StoredState) =>
  collectAnomalies(analyze(incoming, stored));

let offerings = (count: number, extra: Parameters<typeof offering>[1] = {}) =>
  range(count).map(index => offering(`o${index}`, extra));

let consistentCatalog = () =>
  catalog({
    organizations: [organization('lab'), organization('cloud')],
    families: [
      { id: 'fam', labId: 'lab', latestModelId: 'model' } as Catalog['families'][number]
    ],
    models: [model('model', { familyId: 'fam' })],
    releases: [release('model@1')],
    pointers: [
      pointer('latest', { history: [period(modelTarget('model'), earlier)] }),
      pointer('alias', { target: pointerTarget('latest') })
    ],
    vendors: [vendor('vendor'), vendor('cloud', { organizationId: 'cloud', kind: 'cloud' })],
    endpoints: [endpoint('api')],
    offerings: [
      offering('o', { releaseId: 'model@1', pointerId: 'latest' }),
      offering('cloud:o', { vendorId: 'cloud' })
    ],
    names: [
      name('n', {
        target: { kind: 'release', releaseId: 'model@1', modelId: 'model' },
        history: [period(pointerTarget('alias'), earlier)]
      }),
      name('router', { target: { kind: 'router' } })
    ],
    agents: [
      agent('base'),
      agent('fork', { derivedFrom: 'base', vendors: [{ vendorId: 'cloud', role: 'default' }] })
    ]
  });

let rejection = (verdict: ReturnType<typeof evaluateGuardrails>) =>
  verdict.accepted ? undefined : verdict.reason;

describe('findDanglingReferences', () => {
  it('finds nothing in a consistent catalog', () => {
    expect(findDanglingReferences(consistentCatalog())).toEqual([]);
  });

  it('reports references to missing entities', () => {
    let broken = catalog({
      models: [model('model'), model('orphan', { labId: 'nolab' })],
      pointers: [
        pointer('latest', {
          history: [
            period(modelTarget('model'), earlier, later),
            period(modelTarget('gone'), later)
          ]
        })
      ],
      offerings: [offering('o', { modelId: 'missing-model' })],
      names: [name('n', { target: modelTarget('ghost') })],
      agents: [agent('a', { vendors: [{ vendorId: 'novendor', role: 'default' }] })]
    });

    expect(findDanglingReferences(broken)).toEqual(
      expect.arrayContaining([
        { from: 'orphan', field: 'labId', to: 'nolab' },
        { from: 'o', field: 'modelId', to: 'missing-model' },
        { from: 'n', field: 'target', to: 'ghost' },
        { from: 'latest', field: 'target', to: 'gone' },
        { from: 'a', field: 'vendors', to: 'novendor' }
      ])
    );
    expect(findDanglingReferences(broken)).toHaveLength(5);
  });
});

describe('evaluateGuardrails', () => {
  it('accepts the first ingest', () => {
    expect(evaluate(consistentCatalog())).toEqual({ accepted: true });
    expect(evaluate(catalog({ models: [], offerings: [] }))).toEqual({ accepted: true });
  });

  it('accepts an unchanged republish', () => {
    let current = consistentCatalog();

    expect(evaluate(current, storeCatalog(current))).toEqual({ accepted: true });
  });

  it('rejects an unsupported schema version', () => {
    let incoming = { ...catalog(), schemaVersion: 2 } as unknown as Catalog;

    expect(rejection(evaluate(incoming))).toMatch(/schemaVersion 2/);
  });

  it('rejects when live models drop by more than 20%', () => {
    let models = range(10).map(index => model(`m${index}`));
    let stored = storeCatalog(catalog({ models }));

    expect(evaluate(catalog({ models: models.slice(0, 8) }), stored)).toEqual({
      accepted: true
    });
    expect(rejection(evaluate(catalog({ models: models.slice(0, 7) }), stored))).toMatch(
      /Models drop from 10 to 7/
    );
  });

  it('ignores models that were already removed when counting the drop', () => {
    let models = range(10).map(index => model(`m${index}`));
    let stored = storeCatalog(catalog({ models }));
    for (let index of range(3)) stored.model.get(`m${index}`)!.removed = true;

    expect(evaluate(catalog({ models: models.slice(3) }), stored)).toEqual({ accepted: true });
  });

  it('rejects when priced offerings drop by more than 20%', () => {
    let stored = storeCatalog(catalog({ offerings: offerings(10) }));

    let unpriced = (count: number) =>
      offerings(10).map((item, index) => (index < count ? { ...item, pricing: null } : item));

    expect(evaluate(catalog({ offerings: offerings(8) }), stored)).toEqual({ accepted: true });
    expect(evaluate(catalog({ offerings: unpriced(2) }), stored)).toEqual({ accepted: true });
    expect(rejection(evaluate(catalog({ offerings: offerings(7) }), stored))).toMatch(
      /Priced offerings drop from 10 to 7/
    );
    expect(rejection(evaluate(catalog({ offerings: unpriced(3) }), stored))).toMatch(
      /Priced offerings drop from 10 to 7/
    );
  });

  it('rejects when more than 25% of priced offerings change price', () => {
    let stored = storeCatalog(catalog({ offerings: offerings(8) }));

    let repriced = (count: number) =>
      offerings(8).map((item, index) =>
        index < count ? { ...item, pricing: pricing(9) } : item
      );

    expect(evaluate(catalog({ offerings: repriced(2) }), stored)).toEqual({ accepted: true });
    expect(rejection(evaluate(catalog({ offerings: repriced(3) }), stored))).toMatch(
      /3 of 8 priced offerings change price \(37\.5%\)/
    );
  });

  it('rejects when more than 20% of offerings report a later firstSeenAt', () => {
    let stored = storeCatalog(catalog({ offerings: offerings(10, { firstSeenAt: earlier }) }));

    let moved = (count: number) =>
      offerings(10).map((item, index) =>
        index < count ? { ...item, firstSeenAt: later } : { ...item, firstSeenAt: earlier }
      );

    expect(evaluate(catalog({ offerings: moved(2) }), stored)).toEqual({ accepted: true });
    expect(rejection(evaluate(catalog({ offerings: moved(3) }), stored))).toMatch(
      /3 offerings report a later firstSeenAt/
    );
  });

  it('rejects when more than 20% of names with history lose it', () => {
    let history = [period(modelTarget('model'), earlier)];
    let names = range(10).map(index => name(`n${index}`, { history }));
    let stored = storeCatalog(catalog({ names: [...names, name('plain')] }));

    let reset = (count: number) => [
      ...names.map((item, index) => (index < count ? { ...item, history: [] } : item)),
      name('plain')
    ];

    expect(evaluate(catalog({ names: reset(2) }), stored)).toEqual({ accepted: true });
    expect(rejection(evaluate(catalog({ names: reset(3) }), stored))).toMatch(
      /3 names lose their earlier history/
    );
  });

  it('allows up to 25 dangling references in a small catalog', () => {
    let dangling = (count: number) =>
      catalog({
        offerings: range(count).map(index => offering(`o${index}`, { modelId: 'gone' }))
      });

    expect(evaluate(dangling(25))).toEqual({ accepted: true });
    expect(rejection(evaluate(dangling(26)))).toMatch(
      /26 references point to missing entities \(allowed 25\)/
    );
  });

  it('allows 0.5% dangling references in a large catalog', () => {
    let dangling = (count: number) =>
      catalog({
        organizations: [
          organization('lab'),
          ...range(10_000 - count - 3).map(index => organization(`org${index}`))
        ],
        offerings: range(count).map(index => offering(`o${index}`, { modelId: 'gone' }))
      });

    expect(evaluate(dangling(50))).toEqual({ accepted: true });
    expect(rejection(evaluate(dangling(51)))).toMatch(
      /51 references point to missing entities \(allowed 50\)/
    );
  });

  it.fails('accepts an unchanged republish after offerings lost their pricing', () => {
    let stored = storeCatalog(catalog({ offerings: offerings(10) }));
    let unpriced = catalog({
      offerings: offerings(10).map((item, index) =>
        index < 3 ? { ...item, pricing: null } : item
      )
    });
    let afterManualAccept = storeCatalog(unpriced, stored);

    expect(evaluate(unpriced, afterManualAccept)).toEqual({ accepted: true });
  });
});

describe('collectAnomalies', () => {
  it('reports nothing for an unchanged consistent catalog', () => {
    let current = consistentCatalog();

    expect(anomalies(current, storeCatalog(current))).toEqual([]);
  });

  it('reports removed entities per entity with a capped sample', () => {
    let models = range(12).map(index => model(`m${index}`));
    let stored = storeCatalog(
      catalog({ models: [model('model'), ...models], offerings: offerings(1) })
    );

    let result = anomalies(catalog({ offerings: [] }), stored);

    expect(result).toEqual([
      {
        kind: 'removed',
        entity: 'model',
        count: 12,
        sample: models.slice(0, 10).map(item => item.id)
      },
      { kind: 'removed', entity: 'offering', count: 1, sample: ['o0'] }
    ]);
  });

  it('reports offerings that reappear under a new id for the same vendor and model', () => {
    let stored = storeCatalog(
      catalog({
        models: [model('model'), model('other')],
        offerings: [
          offering('old'),
          offering('unrelated-old', { modelId: 'other', vendorId: 'vendor' })
        ]
      })
    );

    let result = anomalies(
      catalog({
        models: [model('model'), model('other')],
        offerings: [
          offering('new'),
          offering('fresh', { modelId: 'model', vendorId: 'other-vendor' })
        ]
      }),
      stored
    );

    expect(result).toContainEqual({
      kind: 'id_churn',
      entity: 'offering',
      count: 1,
      sample: ['new']
    });
  });

  it('does not report churn for unrelated additions', () => {
    let stored = storeCatalog(catalog({ offerings: [offering('old')] }));

    let result = anomalies(
      catalog({ offerings: [offering('new', { modelId: null })] }),
      stored
    );

    expect(result.map(item => item.kind)).not.toContain('id_churn');
  });

  it('reports firstSeenAt regressions, history resets and dangling references', () => {
    let stored = storeCatalog(
      catalog({
        offerings: [offering('o', { firstSeenAt: earlier })],
        names: [
          name('n', { firstSeenAt: earlier, history: [period(modelTarget('model'), earlier)] })
        ]
      })
    );

    let result = anomalies(
      catalog({
        offerings: [
          offering('o', { firstSeenAt: later }),
          offering('d', { vendorId: 'ghost' })
        ],
        names: [name('n', { firstSeenAt: later })]
      }),
      stored
    );

    expect(result).toEqual([
      { kind: 'first_seen_regressed', entity: 'offering', count: 1, sample: ['o'] },
      { kind: 'first_seen_regressed', entity: 'name', count: 1, sample: ['n'] },
      { kind: 'history_reset', entity: 'name', count: 1, sample: ['n'] },
      { kind: 'dangling_reference', count: 1, sample: ['d.vendorId → ghost'] }
    ]);
  });
});

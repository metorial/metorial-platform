import { describe, expect, it } from 'vitest';
import {
  changeTrigger,
  firstDivergence,
  impactsFromTriggers,
  nameTrigger,
  offeringLinkTrigger,
  overrideImpact,
  pointerTrigger,
  priceTrigger,
  systemicImpactThreshold,
  systemicRebuildDays,
  type KnowledgeTrigger
} from '../triggers';
import {
  agent,
  model,
  modelTarget,
  name,
  offering,
  period,
  pointer,
  pointerTarget,
  pricing,
  range,
  vendor
} from './fixtures';

let now = new Date('2026-06-01T00:00:00.000Z');
let day = 24 * 60 * 60 * 1000;

let unresolved = { kind: 'unresolved' } as const;

let trigger = (overrides: Partial<KnowledgeTrigger> = {}): KnowledgeTrigger => ({
  kind: 'offering',
  filter: { modelIds: ['model'] },
  from: new Date('2026-05-01T00:00:00.000Z'),
  ...overrides
});

describe('price triggers', () => {
  it('reprices the model from the new period when the price changed', () => {
    expect(
      priceTrigger({
        modelId: 'model',
        vendorModelId: 'model-v1',
        validFrom: new Date('2026-05-10T00:00:00.000Z'),
        firstSeenAt: new Date('2025-01-01T00:00:00.000Z'),
        hadEarlierPeriod: true
      })
    ).toEqual({
      kind: 'offering',
      filter: { modelIds: ['model'] },
      from: new Date('2026-05-10T00:00:00.000Z')
    });
  });

  it('prices a newly priced offering from its first sighting, raw included', () => {
    expect(
      priceTrigger({
        modelId: 'model',
        vendorModelId: 'model-v1',
        validFrom: new Date('2026-05-10T00:00:00.000Z'),
        firstSeenAt: new Date('2026-04-01T00:00:00.000Z'),
        hadEarlierPeriod: false
      })
    ).toEqual({
      kind: 'offering',
      filter: { modelIds: ['model'], modelRaws: ['model-v1'] },
      from: new Date('2026-04-01T00:00:00.000Z')
    });
  });

  it('does nothing for offerings without a model', () => {
    expect(
      priceTrigger({
        modelId: null,
        vendorModelId: 'mystery',
        validFrom: now,
        firstSeenAt: null,
        hadEarlierPeriod: false
      })
    ).toBeNull();
  });
});

describe('name triggers', () => {
  it('rebuilds unresolved slices when a new name resolves', () => {
    expect(
      nameTrigger({
        before: null,
        after: name('claude-x', { history: [period(modelTarget('model'), '2026-04-01')] }),
        now
      })
    ).toEqual({ kind: 'name', filter: { modelRaws: ['claude-x'] }, from: new Date(0) });
  });

  it('rebuilds from the point a previously unresolved name starts resolving', () => {
    let before = name('claude-x', {
      target: unresolved,
      history: [period(unresolved, '2026-01-01')]
    });
    let after = name('claude-x', {
      history: [
        period(unresolved, '2026-01-01', '2026-05-01'),
        period(modelTarget('model'), '2026-05-01')
      ]
    });

    expect(nameTrigger({ before, after, now })).toEqual({
      kind: 'name',
      filter: { modelRaws: ['claude-x'] },
      from: new Date('2026-05-01T00:00:00.000Z')
    });
  });

  it('rebuilds every slice of a raw retargeted in the past', () => {
    let before = name('claude-x', {
      target: modelTarget('old'),
      history: [period(modelTarget('old'), '2026-01-01')]
    });
    let after = name('claude-x', {
      history: [
        period(modelTarget('old'), '2026-01-01', '2026-04-15'),
        period(modelTarget('model'), '2026-04-15')
      ]
    });

    expect(nameTrigger({ before, after, now })).toEqual({
      kind: 'name',
      filter: { modelRaws: ['claude-x'] },
      from: new Date('2026-04-15T00:00:00.000Z')
    });
  });

  it('does nothing for future retargets, removals, unchanged timelines or unresolving', () => {
    let current = name('claude-x', { history: [period(modelTarget('old'), '2026-01-01')] });

    expect(
      nameTrigger({
        before: current,
        after: name('claude-x', {
          history: [
            period(modelTarget('old'), '2026-01-01', '2026-07-01'),
            period(modelTarget('model'), '2026-07-01')
          ]
        }),
        now
      })
    ).toBeNull();
    expect(nameTrigger({ before: current, after: null, now })).toBeNull();
    expect(nameTrigger({ before: current, after: current, now })).toBeNull();
    expect(
      nameTrigger({
        before: current,
        after: name('claude-x', {
          target: unresolved,
          history: [period(unresolved, '2026-01-01')]
        }),
        now
      })
    ).toBeNull();
  });
});

describe('pointer triggers', () => {
  it('rebuilds the old and new model when a pointer moved in the past', () => {
    let before = pointer('latest', {
      target: modelTarget('old'),
      history: [period(modelTarget('old'), '2026-01-01')]
    });
    let after = pointer('latest', {
      history: [
        period(modelTarget('old'), '2026-01-01', '2026-05-01'),
        period(modelTarget('model'), '2026-05-01')
      ]
    });

    expect(pointerTrigger({ before, after, now })).toEqual({
      kind: 'pointer',
      filter: { modelIds: ['old', 'model'] },
      from: new Date('2026-05-01T00:00:00.000Z')
    });
  });

  it('does nothing for new, removed or unchanged pointers', () => {
    let current = pointer('latest', { history: [period(modelTarget('model'), '2026-01-01')] });

    expect(pointerTrigger({ before: null, after: current, now })).toBeNull();
    expect(pointerTrigger({ before: current, after: null, now })).toBeNull();
    expect(pointerTrigger({ before: current, after: current, now })).toBeNull();
  });
});

describe('timeline divergence', () => {
  it('finds the first time two timelines resolve differently', () => {
    let a = { target: modelTarget('a'), history: [period(modelTarget('a'), '2026-01-01')] };
    let b = {
      target: modelTarget('b'),
      history: [
        period(modelTarget('a'), '2026-01-01', '2026-03-01'),
        period(modelTarget('b'), '2026-03-01')
      ]
    };

    expect(firstDivergence(a, b)).toBe(Date.parse('2026-03-01'));
    expect(firstDivergence(a, a)).toBeNull();
    expect(firstDivergence(null, a)).toBe(-Infinity);
    expect(
      firstDivergence(a, {
        target: pointerTarget('p'),
        history: [period(pointerTarget('p'), '2026-01-01')]
      })
    ).toBe(-Infinity);
  });
});

describe('offering triggers', () => {
  it('moves a priced offering between models from its first sighting', () => {
    expect(
      offeringLinkTrigger({
        before: offering('model-v1', { modelId: 'old' }),
        after: offering('model-v1', { firstSeenAt: '2026-02-01T00:00:00.000Z' })
      })
    ).toEqual({
      kind: 'offering',
      filter: { modelIds: ['old', 'model'], modelRaws: ['model-v1'] },
      from: new Date('2026-02-01T00:00:00.000Z')
    });
  });

  it('does nothing for retired, removed, unpriced or unmoved offerings', () => {
    let current = offering('model-v1');

    expect(
      changeTrigger(
        { entity: 'offering', before: current, after: { ...current, status: 'retired' } },
        now
      )
    ).toBeNull();
    expect(
      changeTrigger({ entity: 'offering', before: current, after: null }, now)
    ).toBeNull();
    expect(
      changeTrigger(
        {
          entity: 'offering',
          before: { ...current, pricing: pricing(1) },
          after: { ...current, pricing: null }
        },
        now
      )
    ).toBeNull();
    expect(
      offeringLinkTrigger({
        before: offering('model-v1', { modelId: 'old', pricing: null }),
        after: offering('model-v1', { pricing: null })
      })
    ).toBeNull();
  });
});

describe('entities that never rebuild', () => {
  it('ignores family, lab, vendor kind and agent maker moves', () => {
    expect(
      changeTrigger(
        { entity: 'model', before: model('model'), after: model('model', { familyId: 'f' }) },
        now
      )
    ).toBeNull();
    expect(
      changeTrigger(
        { entity: 'model', before: model('model'), after: model('model', { labId: 'other' }) },
        now
      )
    ).toBeNull();
    expect(
      changeTrigger(
        {
          entity: 'vendor',
          before: vendor('vendor'),
          after: vendor('vendor', { kind: 'aggregator' } as never)
        },
        now
      )
    ).toBeNull();
    expect(
      changeTrigger(
        {
          entity: 'agent',
          before: agent('codex'),
          after: agent('codex', { makerId: 'openai' })
        },
        now
      )
    ).toBeNull();
  });
});

describe('impacts from triggers', () => {
  it('groups triggers by start and drops future or empty ones', () => {
    let early = new Date('2026-04-01T00:00:00.000Z');

    expect(
      impactsFromTriggers({
        triggers: [
          trigger({ filter: { modelIds: ['b'] } }),
          trigger({ filter: { modelIds: ['a'], modelRaws: ['raw'] } }),
          trigger({ kind: 'name', filter: { modelRaws: ['other'] }, from: early }),
          trigger({ from: new Date(now.getTime() + day) }),
          trigger({ filter: {} })
        ],
        now
      })
    ).toEqual([
      { filter: { modelRaws: ['other'] }, from: early.toISOString(), to: null },
      {
        filter: { modelIds: ['a', 'b'], modelRaws: ['raw'] },
        from: '2026-05-01T00:00:00.000Z',
        to: null
      }
    ]);
    expect(impactsFromTriggers({ triggers: [], now })).toEqual([]);
  });

  it('becomes one rebuild of the last days past the threshold', () => {
    let systemic = [
      {
        filter: null,
        from: new Date(now.getTime() - systemicRebuildDays * day).toISOString(),
        to: null
      }
    ];
    let many = (count: number, kind: KnowledgeTrigger['kind'] = 'offering') =>
      range(count).map(index =>
        trigger({ kind, filter: { modelIds: [`model-${index % 10}`] } })
      );

    expect(impactsFromTriggers({ triggers: many(systemicImpactThreshold + 1), now })).toEqual(
      systemic
    );
    expect(
      impactsFromTriggers({ triggers: many(systemicImpactThreshold + 1, 'name'), now })
    ).toEqual(systemic);
    expect(
      impactsFromTriggers({
        triggers: [
          trigger({
            filter: { modelIds: range(systemicImpactThreshold + 1).map(index => `m-${index}`) }
          })
        ],
        now
      })
    ).toEqual(systemic);
    expect(impactsFromTriggers({ triggers: many(systemicImpactThreshold), now })).toHaveLength(
      1
    );
    expect(
      impactsFromTriggers({ triggers: many(systemicImpactThreshold), now })[0]!.filter
    ).not.toBeNull();
  });
});

describe('override impacts', () => {
  let from = new Date('2026-03-01T00:00:00.000Z');
  let to = new Date('2026-04-01T00:00:00.000Z');

  it('rebuilds the union of both versions over the union of validities', () => {
    expect(
      overrideImpact([
        { filter: { modelIds: ['a'] }, validFrom: from, validTo: to },
        {
          filter: { vendorIds: ['v'] },
          validFrom: new Date('2026-03-15T00:00:00.000Z'),
          validTo: new Date('2026-05-01T00:00:00.000Z')
        }
      ])
    ).toEqual({
      filter: { modelIds: ['a'], vendorIds: ['v'] },
      from: from.toISOString(),
      to: '2026-05-01T00:00:00.000Z'
    });
  });

  it('runs open validities up to now and matches everything for `all`', () => {
    expect(
      overrideImpact([
        { filter: { modelIds: ['a'] }, validFrom: from, validTo: to },
        { filter: null, validFrom: to, validTo: null }
      ])
    ).toEqual({ filter: null, from: from.toISOString(), to: null });
  });

  it('does nothing when no version matches anything', () => {
    expect(overrideImpact([])).toBeNull();
    expect(overrideImpact([{ filter: {}, validFrom: from, validTo: to }])).toBeNull();
  });
});

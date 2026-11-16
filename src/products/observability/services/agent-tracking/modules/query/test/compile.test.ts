import { parseQuery, type Query } from '@mtsrc/agent-tracking-query-spec';
import { describe, expect, it } from 'vitest';
import { type CatalogContext, datasets, fieldNames, resolveField } from '../src/catalog';
import { bindQuery } from '../src/lib/bind';
import { groupPipeline, type GroupScan } from '../src/lib/codegen';
import { compileFilter, type Lookups } from '../src/lib/compile';
import { planQuery } from '../src/lib/plan';
import { exportSortOf, rowsPipeline } from '../src/lib/rows';
import {
  assertScoped,
  type EffectiveScope,
  scan,
  ScopeViolationError
} from '../src/lib/scope';
import type { BoundQuery, PrivacySettings } from '../src/lib/types';

let now = new Date('2026-11-14T12:00:00Z');

let catalog: CatalogContext = {
  kinds: new Map([
    ['team', { key: 'team', name: 'Team', multi: true, attributes: ['costCenter'] }],
    ['cost_center', { key: 'cost_center', name: 'Cost center', multi: false, attributes: [] }]
  ])
};

let open: PrivacySettings = { hideIndividuals: false, minGroupUsers: 5 };

let scope: EffectiveScope = { organizationId: 'org_a', instanceIds: ['in_1'] };

let bind = (query: Record<string, unknown>, privacy = open) => {
  let parsed = parseQuery({ atq: '0', range: { last: '7d' }, ...query });
  if (!parsed.ok) throw Object.assign(new Error('invalid'), { errors: parsed.errors });

  return bindQuery(parsed.query as Query, { catalog, now, privacy });
};

let lookupsOf = (query: BoundQuery): Lookups => ({
  dataset: query.dataset,
  timeZone: query.timeZone,
  ids: new Map(),
  attributeIds: new Map(),
  sessionKeys: new Map(),
  mapped: null
});

let aggregatePipeline = (query: BoundQuery) => {
  let plan = planQuery(query);
  let groupScan: GroupScan = {
    dataset: query.dataset,
    scope,
    range: query.range,
    timeZone: query.timeZone,
    predicate: compileFilter(query.where, lookupsOf(query)),
    dims: query.dimensions,
    measures: plan.aggregates,
    wheres: new Map(),
    allocation: query.allocation,
    splitFilters: [],
    cap: query.limit
  };

  return groupPipeline(groupScan);
};

let bindErrors = (query: Record<string, unknown>, privacy = open) => {
  try {
    bind(query, privacy);
    return [];
  } catch (error) {
    return (error as { errors: { code: string; pointer: string }[] }).errors;
  }
};

describe('scoping', () => {
  it('starts every grouped pipeline with the tenant match, for every dimension of every dataset', () => {
    let checked = 0;

    for (let dataset of Object.values(datasets)) {
      let measure = Object.keys(dataset.metrics)[0]!;

      for (let name of fieldNames(dataset, catalog)) {
        let field = resolveField(dataset, name, catalog)!;
        if (!field.dimension) continue;

        let allocations = dataset.kinds?.kind == 'embedded' ? ['full', 'split'] : ['full'];
        for (let allocation of allocations) {
          let query = bind({
            dataset: dataset.name,
            dimensions: [name],
            measures: [measure],
            allocation
          });
          let pipeline = aggregatePipeline(query);

          expect(
            () => assertScoped(pipeline, dataset, scope),
            `${dataset.name} ${name}`
          ).not.toThrow();
          checked++;
        }
      }
    }

    expect(checked).toBeGreaterThan(50);
  });

  it('starts every rows pipeline with the tenant match, including export paging', () => {
    for (let dataset of Object.values(datasets).filter(dataset => dataset.rows)) {
      let query = bind({ dataset: dataset.name, mode: 'rows' });
      let predicate = compileFilter(query.where, lookupsOf(query));
      let sort = exportSortOf(query);

      expect(() =>
        assertScoped(rowsPipeline({ query, scope, predicate }), dataset, scope)
      ).not.toThrow();

      let exportPage = rowsPipeline({
        query,
        scope,
        predicate,
        sort,
        limit: 5000,
        cursor: { value: now, id: 'x' }
      });
      expect(() => assertScoped(exportPage, dataset, scope)).not.toThrow();
      expect(exportPage[1]).toEqual({ $sort: { [dataset.timeField]: 1, _id: 1 } });
      expect(exportPage[2]).toEqual({ $limit: 5001 });
    }
  });

  it('rejects pipelines that drop or widen the scope', () => {
    let dataset = datasets.usage;
    let range = { from: new Date('2026-11-01'), to: now };
    let match = scan({ dataset, scope, range })[0]!.$match as Record<string, unknown>;

    expect(() => assertScoped([{ $group: { _id: null } }], dataset, scope)).toThrow(
      ScopeViolationError
    );
    expect(() =>
      assertScoped([{ $match: { ...match, organizationId: 'org_b' } }], dataset, scope)
    ).toThrow(ScopeViolationError);
    expect(() =>
      assertScoped(
        [{ $match: { ...match, instanceId: { $in: ['in_1', 'in_2'] } } }],
        dataset,
        scope
      )
    ).toThrow(ScopeViolationError);
    expect(() =>
      scan({
        dataset: datasets.sources,
        scope: { organizationId: 'org_a', projectIds: ['p'] },
        range
      })
    ).toThrow(ScopeViolationError);
  });
});

describe('split allocation', () => {
  // Fields defined in one $addFields can't be read in the same stage, so a weight sum that refers
  // to the unwound field silently becomes 0 and splits nothing.
  it('builds weight sums from the entries, not from the field defined beside them', () => {
    for (let dimension of ['team', 'repo']) {
      let pipeline = aggregatePipeline(
        bind({
          dataset: 'usage',
          dimensions: [dimension],
          measures: ['cost.usd'],
          allocation: 'split'
        })
      );
      let addFields = pipeline.find(stage => '$addFields' in stage)!.$addFields as Record<
        string,
        unknown
      >;
      let [unwound, sum] = Object.keys(addFields);

      expect(sum, dimension).toBeDefined();
      expect(JSON.stringify(addFields[sum!])).not.toContain(`"$${unwound}`);
    }
  });
});

describe('bind', () => {
  it('reports errors with JSON pointers', () => {
    let errors = bindErrors({
      dataset: 'usage',
      dimensions: ['nope'],
      measures: ['cost.usd', 'nope.metric']
    });

    expect(errors.length).toBeGreaterThanOrEqual(2);
    for (let error of errors) expect(error.pointer).toMatch(/^\//);
    expect(errors.map(error => error.pointer)).toContain('/dimensions/0');
  });

  it('rejects rows mode and personal fields when an organization hides individuals', () => {
    let hidden = { hideIndividuals: true, minGroupUsers: 5 };
    let codes = (query: Record<string, unknown>) =>
      bindErrors(query, hidden).map(error => error.code);

    expect(codes({ dataset: 'sessions', mode: 'rows' })).toContain('personal_rows');
    expect(
      codes({ dataset: 'usage', dimensions: ['user'], measures: ['cost.usd'] })
    ).toContain('personal_field');
    expect(codes({ dataset: 'usage', dimensions: ['team'], measures: ['cost.usd'] })).toEqual(
      []
    );
  });

  it('rejects rows mode on aggregate-only datasets', () => {
    expect(bindErrors({ dataset: 'usage', mode: 'rows' }).length).toBeGreaterThan(0);
  });
});

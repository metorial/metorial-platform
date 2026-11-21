import { parseQuery, type Query } from '@mtsrc/agent-tracking-query-spec';
import type { CatalogContext } from '../src/catalog';
import { bindQuery } from '../src/lib/bind';
import { groupPipeline, type GroupScan } from '../src/lib/codegen';
import { compileFilter, type Lookups } from '../src/lib/compile';
import { planQuery } from '../src/lib/plan';
import type { EffectiveScope } from '../src/lib/scope';
import type { BoundQuery, PrivacySettings } from '../src/lib/types';

export let now = new Date('2026-11-14T12:00:00Z');

export let catalog: CatalogContext = {
  kinds: new Map([
    ['team', { key: 'team', name: 'Team', multi: true, attributes: ['costCenter'] }],
    ['cost_center', { key: 'cost_center', name: 'Cost center', multi: false, attributes: [] }]
  ])
};

export let open: PrivacySettings = { hideIndividuals: false, minGroupUsers: 5 };

export let scope: EffectiveScope = { organizationId: 'org_a', instanceIds: ['in_1'] };

export let bind = (query: Record<string, unknown>, privacy = open) => {
  let parsed = parseQuery({ atq: '0', range: { last: '7d' }, ...query });
  if (!parsed.ok) throw Object.assign(new Error('invalid'), { errors: parsed.errors });

  return bindQuery(parsed.query as Query, { catalog, now, privacy });
};

export let lookupsOf = (query: BoundQuery): Lookups => ({
  dataset: query.dataset,
  timeZone: query.timeZone,
  ids: new Map(),
  attributeIds: new Map(),
  sessionKeys: new Map(),
  mapped: null
});

export let aggregatePipeline = (query: BoundQuery) => {
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

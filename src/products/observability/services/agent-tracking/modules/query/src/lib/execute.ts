import type { DatasetDef } from '../catalog';
import {
  dailyCheckPipeline,
  distinctPipeline,
  groupCap,
  groupPipeline,
  type GroupScan,
  type MappingTable,
  type SplitFilter
} from './codegen';
import { compileFilter, conjunctsOf, type Lookups } from './compile';
import type { FinalizeInput, RawGroup, RawReportedGroup, ScanResult } from './finalize';
import { mapValue } from './mapped';
import type { QueryPlan } from './plan';
import type { Predicate } from './predicate';
import type { EffectiveScope } from './scope';
import type { BoundDimension, BoundQuery, QueryWarning, TimeRange } from './types';
import { type Collections, runPipeline } from './store';

export let maxMappingBases = 5000;

let positiveKindOps = new Set(['eq', 'in', 'any']);

export let splitFiltersOf = (query: BoundQuery, lookups: Lookups): SplitFilter[] => {
  if (query.allocation != 'split' || query.dataset.kinds?.kind != 'embedded') return [];

  let grouped = new Set(
    query.dimensions.flatMap(dimension =>
      dimension.field.source.kind == 'kind' ? [dimension.field.source.key] : []
    )
  );

  return conjunctsOf(query.where).flatMap(leaf => {
    let source = leaf.field.source;
    if (source.kind != 'kind' || grouped.has(source.key) || !positiveKindOps.has(leaf.op))
      return [];

    let values = (Array.isArray(leaf.value) ? leaf.value : [leaf.value]).map(String);
    let ids = values.flatMap(value =>
      value.startsWith('slug:') || value.startsWith('ref:')
        ? (lookups.ids.get(`${source.key}\u0000${value}`) ?? [])
        : [value]
    );

    return [{ ids }];
  });
};

let mappingTableFor = async (d: {
  collections: Collections;
  dataset: DatasetDef;
  scope: EffectiveScope;
  range: TimeRange;
  predicate: Predicate;
  dimension: BoundDimension;
  lookups: Lookups;
}): Promise<MappingTable | undefined> => {
  let source = d.dimension.field.source;
  if (source.kind != 'mapped' || !d.lookups.mapped) return undefined;

  let distinct = async (path: string, array?: boolean) =>
    (
      await runPipeline<{ _id: unknown }>({
        collections: d.collections,
        dataset: d.dataset,
        scope: d.scope,
        pipeline: distinctPipeline({
          dataset: d.dataset,
          scope: d.scope,
          range: d.range,
          predicate: d.predicate,
          path,
          ...(array ? { array } : {}),
          limit: maxMappingBases
        })
      })
    )
      .map(row => row._id)
      .filter(value => value !== null && value !== undefined)
      .slice(0, maxMappingBases);

  let bases = await distinct(source.base, d.dimension.field.array);
  let table: MappingTable = {
    bases,
    values: bases.map(base =>
      mapValue(source, { value: String(base), raw: null }, d.lookups.mapped!)
    )
  };

  if (source.raw && !d.dimension.field.array) {
    let raws = await distinct(source.raw);
    table.raws = raws;
    table.rawValues = raws.map(raw =>
      mapValue(source, { value: null, raw: String(raw) }, d.lookups.mapped!)
    );
  }

  return table;
};

export type ExecuteInput = {
  query: BoundQuery;
  plan: QueryPlan;
  collections: Collections;
  scope: EffectiveScope;
  lookups: Lookups;
  groupValues?: string[];
};

export let executeAggregate = async (
  input: ExecuteInput
): Promise<{ finalize: FinalizeInput; warnings: QueryWarning[] }> => {
  let { query, plan, lookups } = input;
  let dataset = query.dataset;
  let warnings: QueryWarning[] = [];

  let predicate = compileFilter(query.where, lookups);
  let wheres = new Map<string, Predicate>();
  for (let measure of [...plan.aggregates, ...plan.reported]) {
    if (measure.where) wheres.set(measure.name, compileFilter(measure.where, lookups));
  }

  let splitFilters = splitFiltersOf(query, lookups);
  let cap = groupCap(query.dimensions);

  let mappingTables: Map<number, MappingTable> | undefined;
  if (plan.mappingTables) {
    mappingTables = new Map();
    for (let [index, dimension] of query.dimensions.entries()) {
      let table = await mappingTableFor({
        collections: input.collections,
        dataset,
        scope: input.scope,
        range: query.range,
        predicate,
        dimension,
        lookups
      });
      if (table) mappingTables.set(index, table);
    }
  }

  let empty = predicate.t == 'const' && !predicate.value;

  let scanFor = async (range: TimeRange, dims: BoundDimension[]): Promise<ScanResult> => {
    if (empty) return { groups: [], reported: new Map() };

    let base: GroupScan = {
      dataset,
      scope: input.scope,
      range,
      timeZone: query.timeZone,
      predicate,
      dims,
      measures: plan.aggregates,
      wheres,
      allocation: query.allocation,
      splitFilters,
      ...(mappingTables && dims.length ? { mappingTables } : {}),
      ...(plan.excludeDaily ? { excludeDaily: true } : {}),
      cap
    };

    let [groups, ...reported] = await Promise.all([
      plan.aggregates.length
        ? runPipeline<RawGroup>({
            collections: input.collections,
            dataset,
            scope: input.scope,
            pipeline: groupPipeline(base)
          })
        : Promise.resolve([] as RawGroup[]),
      ...plan.reported.map(measure =>
        runPipeline<RawReportedGroup>({
          collections: input.collections,
          dataset,
          scope: input.scope,
          pipeline: groupPipeline({
            ...base,
            measures: [],
            reported: {
              path: measure.path,
              ...(wheres.get(measure.name) ? { where: wheres.get(measure.name)! } : {})
            }
          })
        })
      )
    ]);

    return {
      groups: groups.slice(0, cap),
      reported: new Map(
        plan.reported.map((measure, index) => [measure.name, reported[index]!])
      ),
      truncated: groups.length > cap
    };
  };

  let [main, compare, totals, daily] = await Promise.all([
    scanFor(query.range, query.dimensions),
    query.compare ? scanFor(query.compare, query.dimensions) : undefined,
    plan.totalsScan ? scanFor(query.range, []) : undefined,
    plan.dailyCheck && !empty
      ? runPipeline<{ count: number }>({
          collections: input.collections,
          dataset,
          scope: input.scope,
          pipeline: dailyCheckPipeline({
            dataset,
            scope: input.scope,
            range: query.range,
            predicate
          })
        })
      : undefined
  ]);

  if (daily?.length) {
    warnings.push({
      code: 'daily_only_data',
      message: 'Some data in range only has daily totals, which hourly groupings leave out.'
    });
  }

  return {
    finalize: {
      query,
      plan,
      main,
      ...(compare ? { compare } : {}),
      ...(totals ? { totals } : {}),
      mapped: lookups.mapped,
      ...(input.groupValues ? { groupValues: input.groupValues } : {})
    },
    warnings
  };
};

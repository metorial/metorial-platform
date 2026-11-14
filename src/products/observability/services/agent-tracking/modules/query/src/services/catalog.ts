import { Service } from '@lowerdeck/service';
import type { Organization } from '@mtsrc/agent-tracking-db';
import {
  type DatasetName,
  datasetNames,
  queryLimits,
  queryLanguageVersion,
  querySchema
} from '@mtsrc/agent-tracking-query-spec';
import { type DatasetDef, datasets, fieldNames, resolveField } from '../catalog';
import { loadCatalogContext, privacyOf } from '../lib/resolve';
import { filterOpsFor } from '../lib/bind';
import { maxDistinctValues, maxGroups } from '../lib/codegen';

let describeDataset = (
  dataset: DatasetDef,
  context: Awaited<ReturnType<typeof loadCatalogContext>>,
  hideIndividuals: boolean
) => {
  let names = fieldNames(dataset, context);
  let fields = names.flatMap(name => {
    let field = resolveField(dataset, name, context);
    if (!field) return [];

    return [
      {
        name,
        type: field.type,
        description: field.description,
        dimension: field.dimension,
        measure: field.measure,
        filter: field.filter,
        select: field.select && dataset.rows,
        ops: field.filter ? filterOpsFor(field) : [],
        multi: !!field.multi,
        sensitivity: field.sensitivity,
        available: !(hideIndividuals && field.sensitivity == 'personal'),
        cardinality: field.cardinality,
        ...(field.enumValues ? { enumValues: [...field.enumValues] } : {}),
        ...(field.entityKind ? { entityKind: field.entityKind } : {}),
        ...(field.distinct ? { distinct: true } : {}),
        ...(field.percentile ? { percentile: true } : {})
      }
    ];
  });

  let metrics = Object.entries(dataset.metrics).map(([name, metric]) => ({
    name,
    kind: metric.kind,
    description: metric.description,
    ...(metric.kind == 'aggregate'
      ? { fn: metric.fn, type: metric.type, field: metric.field ?? null }
      : {}),
    ...(metric.kind == 'derived' ? { format: metric.format, expr: metric.expr } : {}),
    ...(metric.kind == 'composite' ? { parts: metric.parts } : {})
  }));

  return {
    name: dataset.name,
    description: dataset.description,
    timeField: dataset.timeField,
    maxRangeDays: dataset.maxRangeDays,
    maxHourlyRangeDays: dataset.maxHourlyRangeDays,
    retentionDays: dataset.retentionDays ?? null,
    countable: dataset.countable,
    rows: dataset.rows && !hideIndividuals,
    fields,
    metrics,
    schema: querySchema({ fields: names, measures: Object.keys(dataset.metrics) })
  };
};

class QueryCatalogServiceImpl {
  async getCatalog(d: { organization: Organization; dataset?: DatasetName }) {
    let context = await loadCatalogContext(d.organization);
    let privacy = privacyOf(d.organization);
    let names = d.dataset ? [d.dataset] : [...datasetNames];

    return {
      object: 'agent_tracking#query_catalog' as const,
      version: queryLanguageVersion,
      privacy,
      datasets: names.map(name =>
        describeDataset(datasets[name], context, privacy.hideIndividuals)
      ),
      kinds: [...context.kinds.values()].map(kind => ({
        key: kind.key,
        name: kind.name,
        multi: kind.multi,
        queryableAttributes: kind.attributes
      })),
      limits: { ...queryLimits, groups: maxGroups, distinctValues: maxDistinctValues },
      schema: querySchema()
    };
  }
}

export let queryCatalogService = Service.create(
  'queryCatalogService',
  () => new QueryCatalogServiceImpl()
).build();

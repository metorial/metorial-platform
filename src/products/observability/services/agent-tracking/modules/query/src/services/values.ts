import { Service } from '@lowerdeck/service';
import { db, type Organization } from '@mtsrc/agent-tracking-db';
import type { QueryScope } from '@mtsrc/agent-tracking-module-usage';
import type { DatasetName, Measure, Query, Range } from '@mtsrc/agent-tracking-query-spec';
import { datasets, resolveField } from '../catalog';
import { loadCatalogContext } from '../lib/resolve';
import { queryService } from './query';

export let defaultValuesLimit = 50;

export let maxValuesLimit = 500;

let defaultRange: Range = { last: '30d' };

let usageMeasure = (dataset: DatasetName): Measure =>
  datasets[dataset].countable
    ? { fn: 'count', as: 'count' }
    : { fn: 'sum', field: 'requests', as: 'count' };

let matches = (search: string, ...candidates: (string | null | undefined)[]) =>
  candidates.some(candidate => candidate?.toLowerCase().includes(search));

class QueryValuesServiceImpl {
  async listValues(d: {
    organization: Organization;
    scope?: QueryScope;
    dataset: DatasetName;
    field: string;
    search?: string;
    range?: Range;
    limit?: number;
  }) {
    let limit = Math.min(d.limit ?? defaultValuesLimit, maxValuesLimit);
    let search = d.search?.trim().toLowerCase() || undefined;

    let query: Query = {
      atq: '0',
      dataset: d.dataset,
      range: d.range ?? defaultRange,
      dimensions: [d.field],
      measures: [usageMeasure(d.dataset)],
      orderBy: [{ by: 'count', direction: 'desc' }],
      limit: search ? 10_000 : limit,
      labels: true
    };
    let result = await queryService.run({
      organization: d.organization,
      scope: d.scope,
      query
    });

    let labels =
      (result.labels as Record<string, Record<string, Record<string, string | null>>>)[
        d.field
      ] ?? {};
    let values = result.rows
      .map(row => {
        let value = row[d.field] as string | number | boolean | null;
        let label = typeof value == 'string' ? (labels[value] ?? null) : null;
        return { value, label, count: Number(row.count ?? 0) };
      })
      .filter(item => item.value !== null && item.value !== '$other')
      .filter(
        item =>
          !search || matches(search, String(item.value), item.label?.name, item.label?.slug)
      );

    let catalog = await loadCatalogContext(d.organization);
    let field = resolveField(datasets[d.dataset], d.field, catalog);
    if (search && field?.entityKind && values.length < limit) {
      let entities = await db.entity.findMany({
        where: {
          organizationOid: d.organization.oid,
          kind: field.entityKind,
          mergedIntoOid: null,
          archivedAt: null,
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { slug: { contains: search, mode: 'insensitive' } }
          ]
        },
        select: { id: true, name: true, slug: true, status: true, kind: true },
        take: limit
      });
      let known = new Set(values.map(item => item.value));
      for (let entity of entities) {
        if (known.has(entity.id)) continue;
        values.push({
          value: entity.id,
          label: {
            name: entity.name,
            slug: entity.slug,
            status: entity.status,
            kind: entity.kind
          },
          count: 0
        });
      }
    }

    return {
      object: 'agent_tracking#query_values' as const,
      dataset: d.dataset,
      field: d.field,
      values: values.slice(0, limit),
      truncated: values.length > limit || result.meta.truncated
    };
  }
}

export let queryValuesService = Service.create(
  'queryValuesService',
  () => new QueryValuesServiceImpl()
).build();

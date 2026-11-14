import { createHash, createHmac } from 'node:crypto';
import { badRequestError, ServiceError, tooManyRequestsError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { db, type Organization } from '@mtsrc/agent-tracking-db';
import type { QueryScope } from '@mtsrc/agent-tracking-module-usage';
import { parseQuery, type Query, type QueryError } from '@mtsrc/agent-tracking-query-spec';
import { getCoordinationRedis, redisKey } from '@mtsrc/agent-tracking-redis';
import { env } from '../env';
import { executeAggregate, splitFiltersOf } from '../lib/execute';
import { collectLabels } from '../lib/labels';
import {
  buildMappedContext,
  loadCatalogContext,
  loadGroupValues,
  privacyOf,
  queryLeaves,
  resolveLookups,
  resolveScope
} from '../lib/resolve';
import { runPipeline, storeCollections } from '../lib/store';
import { bindQuery } from '../lib/bind';
import { groupPipeline } from '../lib/codegen';
import { compileFilter } from '../lib/compile';
import { finalize } from '../lib/finalize';
import { planQuery } from '../lib/plan';
import {
  decodeCursor,
  encodeCursor,
  entityIdsForAttributes,
  InvalidCursorError,
  rowsPipeline,
  type RowsCursor,
  type RowsSort,
  rowsSortOf,
  rowValue,
  sortValueOf
} from '../lib/rows';
import type { EffectiveScope } from '../lib/scope';
import { type BoundQuery, QueryBindError, type QueryWarning } from '../lib/types';

export let maxConcurrentQueries = 4;

export let maxQueriesPerMinute = 60;

let slotTtlSeconds = 60;

export type QueryInput = {
  organization: Organization;
  scope?: QueryScope;
  query: unknown;
};

let invalid = (errors: QueryError[]) =>
  new ServiceError(
    badRequestError({
      code: 'invalid_query',
      message: errors.map(error => `${error.pointer || '/'}: ${error.message}`).join('\n'),
      errors
    } as any)
  );

let parseOrThrow = (value: unknown): Query => {
  let parsed = parseQuery(value);
  if (!parsed.ok) throw invalid(parsed.errors);

  return parsed.query;
};

type RowsInput = {
  organization: Organization;
  bound: BoundQuery;
  scope: EffectiveScope;
  catalog: Awaited<ReturnType<typeof loadCatalogContext>>;
  now: Date;
};

let uniqueWarnings = (warnings: QueryWarning[]) => {
  let seen = new Set<string>();
  return warnings.filter(warning => {
    if (seen.has(warning.code)) return false;
    seen.add(warning.code);
    return true;
  });
};

let cursorKey = (organization: Organization) =>
  createHmac('sha256', env.query.hashSecret)
    .update(`atq-cursor\u0000${organization.id}`)
    .digest();

let queryHashOf = (query: Query) => {
  let { cursor: _, ...rest } = query;
  return createHash('sha256').update(JSON.stringify(rest)).digest('base64url');
};

// Per-organization concurrency and rate limits (11 §9.7). Redis being down never blocks queries.
let withQuerySlot = async <T>(organization: Organization, run: () => Promise<T>) => {
  let redis = getCoordinationRedis();
  let minute = Math.floor(Date.now() / 60_000);
  let rateKey = redisKey('atq', 'rate', organization.id, String(minute));
  let runningKey = redisKey('atq', 'running', organization.id);
  let acquired = false;

  try {
    let results = (await redis
      .multi()
      .incr(rateKey)
      .incr(runningKey)
      .expire(rateKey, 120)
      .expire(runningKey, slotTtlSeconds)
      .exec()) as [unknown, number][];
    let rate = Number(results[0]?.[1] ?? 0);
    let running = Number(results[1]?.[1] ?? 0);
    acquired = true;

    if (rate > maxQueriesPerMinute) {
      throw new ServiceError(
        tooManyRequestsError({ message: `At most ${maxQueriesPerMinute} queries per minute.` })
      );
    }
    if (running > maxConcurrentQueries) {
      throw new ServiceError(
        tooManyRequestsError({
          message: `At most ${maxConcurrentQueries} queries can run at once.`
        })
      );
    }
  } catch (error) {
    if (error instanceof ServiceError) {
      if (acquired) await redis.decr(runningKey).catch(() => {});
      throw error;
    }
    acquired = false;
  }

  try {
    return await run();
  } finally {
    if (acquired) await redis.decr(runningKey).catch(() => {});
  }
};

class QueryServiceImpl {
  async prepare(d: QueryInput & { now?: Date }) {
    let query = parseOrThrow(d.query);
    let now = d.now ?? new Date();
    let catalog = await loadCatalogContext(d.organization);
    let privacy = privacyOf(d.organization);

    let bound: BoundQuery;
    try {
      bound = bindQuery(query, { catalog, now, privacy });
    } catch (error) {
      if (error instanceof QueryBindError) throw invalid(error.errors);
      throw error;
    }

    let scope = await resolveScope({
      organization: d.organization,
      scope: d.scope,
      dataset: bound.dataset
    });

    return { query, bound, catalog, scope, now };
  }

  async validate(d: QueryInput) {
    try {
      let { bound } = await this.prepare(d);
      return {
        ok: true,
        errors: [] as QueryError[],
        canonical: bound.canonical,
        warnings: bound.warnings
      };
    } catch (error) {
      if (error instanceof ServiceError && (error.data as any).code == 'invalid_query') {
        return {
          ok: false,
          errors: (error.data as any).errors as QueryError[],
          canonical: null,
          warnings: []
        };
      }
      throw error;
    }
  }

  async explain(d: QueryInput & { includePipelines?: boolean }) {
    let prepared = await this.prepare(d);
    let { bound, scope } = prepared;
    let plan = bound.mode == 'aggregate' ? planQuery(bound) : null;
    let collections = await storeCollections();
    let resolved = await this.resolve({
      ...prepared,
      organization: d.organization,
      collections
    });

    let predicate = compileFilter(bound.where, resolved.lookups);
    let pipeline =
      bound.mode == 'rows'
        ? rowsPipeline({ query: bound, scope, predicate })
        : groupPipeline({
            dataset: bound.dataset,
            scope,
            range: bound.range,
            timeZone: bound.timeZone,
            predicate,
            dims: bound.dimensions,
            measures: plan!.aggregates,
            wheres: new Map(),
            allocation: bound.allocation,
            splitFilters: splitFiltersOf(bound, resolved.lookups),
            cap: bound.limit
          });

    return {
      canonical: bound.canonical,
      dataset: bound.dataset.name,
      collection: bound.dataset.collection,
      mode: bound.mode,
      plan: plan && {
        aggregates: plan.aggregates.map(measure => measure.name),
        reported: plan.reported.map(measure => measure.name),
        totalsScan: plan.totalsScan,
        mappingTables: plan.mappingTables,
        excludeDaily: plan.excludeDaily,
        compare: !!bound.compare
      },
      indexes: bound.dataset.indexes,
      warnings: uniqueWarnings([...bound.warnings, ...resolved.warnings]),
      ...(d.includePipelines ? { pipeline } : {})
    };
  }

  async run(d: QueryInput & { now?: Date }) {
    let started = Date.now();
    let prepared = await this.prepare(d);

    return withQuerySlot(d.organization, async () => {
      let result =
        prepared.bound.mode == 'rows'
          ? await this.runRows({ ...prepared, organization: d.organization })
          : await this.runAggregate({ ...prepared, organization: d.organization });

      return {
        object: 'agent_tracking#query_result' as const,
        ...result,
        meta: { ...result.meta, cached: false, elapsedMs: Date.now() - started }
      };
    });
  }

  private async resolve(d: {
    organization: Organization;
    bound: BoundQuery;
    scope: EffectiveScope;
    catalog: Awaited<ReturnType<typeof loadCatalogContext>>;
    collections: Awaited<ReturnType<typeof storeCollections>>;
    now: Date;
  }) {
    let { bound } = d;
    let mappedFields = [
      ...bound.dimensions.map(dimension => dimension.field),
      ...bound.select
    ];

    try {
      return await resolveLookups({
        organization: d.organization,
        collections: d.collections,
        scope: d.scope,
        dataset: bound.dataset,
        catalog: d.catalog,
        range: bound.range,
        timeZone: bound.timeZone,
        strict: bound.strict,
        leaves: queryLeaves(bound),
        mappedFields,
        now: d.now
      });
    } catch (error) {
      if (error instanceof QueryBindError) throw invalid(error.errors);
      throw error;
    }
  }

  private async runAggregate(d: {
    organization: Organization;
    bound: BoundQuery;
    scope: EffectiveScope;
    catalog: Awaited<ReturnType<typeof loadCatalogContext>>;
    now: Date;
  }) {
    let { bound } = d;
    let collections = await storeCollections();
    let resolved = await this.resolve({ ...d, collections });
    let plan = planQuery(bound);

    let groupDimension = bound.dimensions.find(
      dimension => dimension.field.source.kind != 'time'
    );
    let groupValues =
      bound.fill.groups && groupDimension?.field.entityKind
        ? await loadGroupValues({
            organization: d.organization,
            scope: d.scope,
            kind: groupDimension.field.entityKind
          })
        : undefined;

    let executed = await executeAggregate({
      query: bound,
      plan,
      collections,
      scope: d.scope,
      lookups: resolved.lookups,
      ...(groupValues ? { groupValues } : {})
    });
    let result = finalize(executed.finalize);

    let labels = bound.labels
      ? await collectLabels({
          organization: d.organization,
          rows: result.rows,
          targets: bound.dimensions.map(dimension => ({
            column: dimension.name,
            field: dimension.field
          }))
        })
      : {};

    return {
      query: bound.canonical,
      columns: result.columns,
      rows: result.rows,
      totals: result.totals,
      labels,
      meta: {
        dataset: bound.dataset.name,
        allocation: bound.allocation,
        truncated: result.truncated,
        rowCount: result.rows.length,
        freshThrough: d.now.toISOString(),
        nextCursor: null as string | null,
        warnings: uniqueWarnings([
          ...result.warnings,
          ...resolved.warnings,
          ...executed.warnings
        ])
      }
    };
  }

  async runRows(d: RowsInput & { query?: Query }) {
    let { bound } = d;
    let key = cursorKey(d.organization);
    let queryHash = queryHashOf(d.query ?? bound.canonical);

    let cursor;
    if (bound.cursor) {
      try {
        cursor = decodeCursor(bound.cursor, { key, queryHash });
      } catch (error) {
        if (error instanceof InvalidCursorError) {
          throw invalid([
            { code: 'invalid_cursor', message: error.message, pointer: '/cursor' }
          ]);
        }
        throw error;
      }
    }

    let read = await this.readRows({ ...d, ...(cursor ? { after: cursor } : {}) });

    return {
      query: bound.canonical,
      columns: read.columns,
      rows: read.rows,
      totals: null,
      labels: read.labels,
      meta: {
        dataset: bound.dataset.name,
        allocation: null,
        truncated: read.hasMore,
        rowCount: read.rows.length,
        freshThrough: d.now.toISOString(),
        nextCursor:
          read.hasMore && read.last ? encodeCursor(read.last, { key, queryHash }) : null,
        warnings: read.warnings
      }
    };
  }

  // One keyset page of a rows-mode query, shared by rows mode and exports. `sort` and `limit`
  // override the query's own; `last` is the raw position to continue after.
  async readRows(d: RowsInput & { after?: RowsCursor; sort?: RowsSort; limit?: number }) {
    let { bound } = d;
    let collections = await storeCollections();
    let resolved = await this.resolve({ ...d, collections });
    let limit = d.limit ?? bound.limit;
    let sort = d.sort ?? rowsSortOf(bound);

    let predicate = compileFilter(bound.where, resolved.lookups);
    let documents =
      predicate.t == 'const' && !predicate.value
        ? []
        : await runPipeline<Record<string, unknown>>({
            collections,
            dataset: bound.dataset,
            scope: d.scope,
            pipeline: rowsPipeline({
              query: bound,
              scope: d.scope,
              predicate,
              sort,
              limit,
              ...(d.after ? { cursor: d.after } : {})
            })
          });

    let page = documents.slice(0, limit);
    let hasMore = documents.length > limit;
    let lastDocument = page.at(-1);

    let mapped =
      resolved.lookups.mapped ??
      (await buildMappedContext({
        collections,
        dataset: bound.dataset,
        scope: d.scope,
        range: bound.range,
        fields: bound.select,
        filterFields: [],
        now: d.now
      }));
    let context = { dataset: bound.dataset, timeZone: bound.timeZone, mapped };
    let attributeIds = entityIdsForAttributes(page, bound.select, context);
    let attributes = new Map(
      attributeIds.length
        ? (
            await db.entity.findMany({
              where: { organizationOid: d.organization.oid, id: { in: attributeIds } },
              select: { id: true, attributes: true }
            })
          ).map(entity => [entity.id, entity.attributes as Record<string, unknown>])
        : []
    );

    let rows = page.map(document => {
      let row: Record<string, unknown> = {};
      for (let field of bound.select)
        row[field.name] = rowValue(document, field, { ...context, attributes });
      return row;
    });

    let labels = bound.labels
      ? await collectLabels({
          organization: d.organization,
          rows,
          targets: bound.select.map(field => ({ column: field.name, field }))
        })
      : {};

    return {
      columns: bound.select.map(field => ({
        name: field.name,
        role: 'field' as const,
        type: field.type,
        ...(field.entityKind ? { entityKind: field.entityKind } : {})
      })),
      rows,
      labels,
      hasMore,
      last: lastDocument
        ? { value: sortValueOf(lastDocument, sort), id: String(lastDocument._id) }
        : null,
      warnings: uniqueWarnings([...bound.warnings, ...resolved.warnings])
    };
  }
}

export let queryService = Service.create('queryService', () => new QueryServiceImpl()).build();

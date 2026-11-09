import { db, Prisma } from '@metorial/db';
import { decodeUsageBucketKey, getUsageMetricId, parseUsageBucketHash } from './bucket';
import {
  acknowledgeClaimedUsageBucket,
  parseClaimedUsageBucketKey,
  readClaimedUsageBucket
} from './buffer';
import {
  assembleUsageSummary,
  assembleUsageTimeline,
  type AggregatedRow
} from './queryShared';
import {
  usageDimensionKeys,
  usageGroupByDimensions,
  type UsageFilter,
  type UsageGroupBy
} from './types';

let writeChunkSize = 500;

type QueryFilter = UsageFilter & {
  groupBy?: UsageGroupBy;
  maxSeries: number;
  includeDistinct: boolean;
};

type SqlRow = Omit<AggregatedRow, '_id'> & {
  kind: AggregatedRow['_id']['kind'];
  group: string | null;
  bucket: number | null;
};

let column = (key: string) => Prisma.raw(`"${key}"`);

let match = (filter: UsageFilter) => {
  let clauses = [
    Prisma.sql`"instanceId" IN (${Prisma.join(filter.instanceIds)})`,
    Prisma.sql`"kind" IN (${Prisma.join(filter.kinds)})`,
    Prisma.sql`"ts" >= ${filter.from} AND "ts" < ${filter.to}`
  ];

  for (let key of usageDimensionKeys) {
    let values = filter.dims?.[key];
    if (values?.length) clauses.push(Prisma.sql`${column(key)} IN (${Prisma.join(values)})`);
  }

  return Prisma.join(clauses, ' AND ');
};

let aggregate = async (
  filter: QueryFilter,
  mode: 'timeline' | 'kind' | 'group',
  intervalMs?: number
): Promise<AggregatedRow[]> => {
  if (!filter.instanceIds.length || !filter.kinds.length) return [];

  let dimension =
    filter.groupBy && filter.groupBy !== 'kind'
      ? column(usageGroupByDimensions[filter.groupBy])
      : Prisma.sql`NULL::text`;
  let kind =
    mode === 'group' && filter.groupBy !== 'kind' ? Prisma.sql`NULL::text` : column('kind');
  let group =
    mode === 'kind'
      ? Prisma.sql`NULL::text`
      : mode === 'group' && filter.groupBy === 'kind'
        ? column('kind')
        : dimension;
  let bucket = intervalMs
    ? Prisma.sql`(floor(extract(epoch from "ts") * 1000 / ${intervalMs}) * ${intervalMs})::double precision`
    : Prisma.sql`NULL::double precision`;
  let distinct = filter.includeDistinct
    ? Prisma.sql`array_agg(DISTINCT "consumerId") AS consumers, array_agg(DISTINCT "agentId") AS agents`
    : Prisma.sql`NULL::text[] AS consumers, NULL::text[] AS agents`;
  let limit =
    mode === 'group'
      ? Prisma.sql`ORDER BY SUM("count") DESC LIMIT ${filter.maxSeries}`
      : Prisma.empty;

  let rows = await db.$queryRaw<SqlRow[]>(Prisma.sql`
    SELECT ${kind} AS kind, ${group} AS "group", ${bucket} AS bucket,
      SUM("count")::double precision AS count,
      SUM("errorCount")::double precision AS "errorCount",
      SUM("durationMsSum")::double precision AS "durationMsSum",
      SUM("durationCount")::double precision AS "durationCount",
      MAX("durationMsMax")::double precision AS "durationMsMax", ${distinct}
    FROM "UsageMetric" WHERE ${match(filter)}
    GROUP BY 1, 2, 3 ${limit}
  `);

  return rows.map(({ kind, group, bucket, consumers, agents, ...counters }) => ({
    _id: { kind, group, ...(bucket === null ? {} : { bucket }) },
    ...counters,
    consumers: consumers ?? [],
    agents: agents ?? []
  }));
};

export let queryUsageTimeline = async (filter: QueryFilter & { intervalMs: number }) =>
  assembleUsageTimeline(await aggregate(filter, 'timeline', filter.intervalMs), filter);

export let queryUsageSummary = async (filter: QueryFilter) => {
  let [kinds, groups] = await Promise.all([
    aggregate(filter, 'kind'),
    filter.groupBy ? aggregate(filter, 'group') : Promise.resolve([])
  ]);

  return assembleUsageSummary(kinds, groups, filter);
};

export let flushUsageBucket = async (claimedKey: string) => {
  let { minute, nonce } = parseClaimedUsageBucketKey(claimedKey);
  let hash = await readClaimedUsageBucket(claimedKey);
  let buckets = [...parseUsageBucketHash(hash).entries()];

  for (let offset = 0; offset < buckets.length; offset += writeChunkSize) {
    let data = buckets.slice(offset, offset + writeChunkSize).map(([field, counters]) => {
      let key = decodeUsageBucketKey(field);

      return {
        key: getUsageMetricId(['live', minute, nonce, field]),
        ts: new Date(minute),
        instanceId: key.instanceId,
        organizationId: key.organizationId,
        kind: key.kind,
        ...Object.fromEntries(
          usageDimensionKeys.map(dimension => [dimension, key.dims[dimension] ?? null])
        ),
        ...Object.fromEntries(
          Object.entries(counters).map(([key, value]) => [key, BigInt(value)])
        )
      } as Prisma.UsageMetricCreateManyInput;
    });

    await db.usageMetric.createMany({ data, skipDuplicates: true });
  }

  await acknowledgeClaimedUsageBucket(claimedKey);
};

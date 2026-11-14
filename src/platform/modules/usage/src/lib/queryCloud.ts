import { UsageMetricModel } from '../models';
import { getUsageBackfillState } from './backfillState';
import {
  USAGE_MESSAGE_BACKFILL_ID,
  USAGE_MESSAGE_REVISION,
  usageMessageKinds
} from './messageRevision';
import { usageGroupByDimensions, type UsageFilter, type UsageGroupBy } from './types';
import {
  assembleUsageTimeline,
  assembleUsageSummary,
  type AggregatedRow
} from './queryShared';

let buildMatch = async (filter: UsageFilter) => {
  let hasMessages = filter.kinds.some(kind => usageMessageKinds.includes(kind));
  let messageState = hasMessages
    ? await getUsageBackfillState(USAGE_MESSAGE_BACKFILL_ID)
    : null;

  let match: Record<string, any> = {
    instanceId: { $in: filter.instanceIds },
    kind: { $in: filter.kinds },
    ts: { $gte: filter.from, $lt: filter.to }
  };

  if (hasMessages) {
    // Publish rebuilt history only once every page is durable; until then retain the old view.
    match.$or = messageState?.sources?.session_message?.done
      ? [{ kind: { $nin: usageMessageKinds } }, { messageRevision: USAGE_MESSAGE_REVISION }]
      : [
          { kind: { $nin: usageMessageKinds } },
          { messageRevision: { $ne: USAGE_MESSAGE_REVISION } },
          { source: 'live' }
        ];
  }

  for (let [key, values] of Object.entries(filter.dims ?? {})) {
    if (values?.length) match[`dims.${key}`] = { $in: values };
  }

  return match;
};

let getGroupExpression = (groupBy: UsageGroupBy | undefined) => {
  if (!groupBy || groupBy == 'kind') return null;
  return `$dims.${usageGroupByDimensions[groupBy]}`;
};

let counterAccumulators = {
  count: { $sum: '$count' },
  errorCount: { $sum: '$errorCount' },
  durationMsSum: { $sum: '$durationMsSum' },
  durationCount: { $sum: '$durationCount' },
  durationMsMax: { $max: '$durationMsMax' }
};

let distinctAccumulators = {
  consumers: { $addToSet: '$dims.consumerId' },
  agents: { $addToSet: '$dims.agentId' }
};

export let queryUsageTimeline = async (
  filter: UsageFilter & {
    intervalMs: number;
    groupBy?: UsageGroupBy;
    maxSeries: number;
    includeDistinct: boolean;
  }
) => {
  let rows = (await UsageMetricModel.aggregate([
    { $match: await buildMatch(filter) },
    {
      $group: {
        _id: {
          kind: '$kind',
          group: getGroupExpression(filter.groupBy),
          bucket: {
            $subtract: [{ $toLong: '$ts' }, { $mod: [{ $toLong: '$ts' }, filter.intervalMs] }]
          }
        },
        ...counterAccumulators,
        ...(filter.includeDistinct ? distinctAccumulators : {})
      }
    }
  ])) as AggregatedRow[];

  return assembleUsageTimeline(rows, filter);
};

export let queryUsageSummary = async (
  filter: UsageFilter & {
    groupBy?: UsageGroupBy;
    maxSeries: number;
    includeDistinct: boolean;
  }
) => {
  let distinctAccumulator = filter.includeDistinct ? distinctAccumulators : {};
  let match = await buildMatch(filter);

  let [kindRows, groupRows] = await Promise.all([
    UsageMetricModel.aggregate([
      { $match: match },
      {
        $group: {
          _id: { kind: '$kind', group: null },
          ...counterAccumulators,
          ...distinctAccumulator
        }
      }
    ]) as Promise<AggregatedRow[]>,

    filter.groupBy
      ? (UsageMetricModel.aggregate([
          { $match: match },
          {
            $group: {
              _id: {
                kind: filter.groupBy == 'kind' ? '$kind' : null,
                group: getGroupExpression(filter.groupBy) ?? '$kind'
              },
              ...counterAccumulators,
              ...distinctAccumulator
            }
          },
          { $sort: { count: -1 } },
          { $limit: filter.maxSeries }
        ]) as Promise<AggregatedRow[]>)
      : Promise.resolve([] as AggregatedRow[])
  ]);

  return assembleUsageSummary(kindRows, groupRows, filter);
};

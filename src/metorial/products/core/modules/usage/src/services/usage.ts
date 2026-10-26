import { badRequestError, createError, ServiceError } from '@lowerdeck/error';
import { getSentry } from '@lowerdeck/sentry';
import { Service } from '@lowerdeck/service';
import { USAGE_RETENTION_MS } from '../models';
import { bufferUsageEvent } from '../lib/buffer';
import { isUsageEnabled, usageDbConnect } from '../lib/connection';
import { resolveUsageInterval, type UsageInterval } from '../lib/interval';
import { queryUsageSummary, queryUsageTimeline } from '../lib/query';
import {
  usageMetricKinds,
  type UsageDimensionKey,
  type UsageEvent,
  type UsageGroupBy,
  type UsageMetricKind
} from '../lib/types';

let MAX_SPAN_MS = 31 * 24 * 60 * 60 * 1000;
let MAX_POINTS = 2000;
let DEFAULT_MAX_SERIES = 10;

let Sentry = getSentry();

let usageUnavailableError = createError({
  status: 503,
  code: 'usage_unavailable',
  message: 'Usage metrics are not available right now.'
});

export type UsageQueryFilters = Partial<Record<UsageDimensionKey, string[] | undefined>>;

type UsageQueryInput = {
  instanceIds: string[];
  kinds: UsageMetricKind[];
  from: Date;
  to: Date;
  filters?: UsageQueryFilters;
  groupBy?: UsageGroupBy;
  maxSeries?: number;
};

let includesDistinctCounts = (kinds: UsageMetricKind[]) =>
  kinds.some(kind => kind == 'tool_call' || kind == 'message' || kind == 'connection');

class UsageServiceImpl {
  private normalizeRange(d: { from: Date; to: Date }) {
    if (
      !Number.isFinite(d.from.getTime()) ||
      !Number.isFinite(d.to.getTime()) ||
      d.to <= d.from
    ) {
      throw new ServiceError(badRequestError({ message: '`to` must be after `from`.' }));
    }

    if (d.to.getTime() - d.from.getTime() > MAX_SPAN_MS) {
      throw new ServiceError(
        badRequestError({ message: 'The requested range cannot be longer than 31 days.' })
      );
    }

    let earliest = Date.now() - USAGE_RETENTION_MS;
    let from = new Date(Math.max(d.from.getTime(), earliest));
    let to = new Date(Math.min(d.to.getTime(), Date.now()));

    return { from, to: to > from ? to : new Date(from.getTime() + 1) };
  }

  private normalizeKinds(kinds: UsageMetricKind[]) {
    let unique = [...new Set(kinds)].filter(kind => usageMetricKinds.includes(kind));
    if (!unique.length) {
      throw new ServiceError(badRequestError({ message: 'At least one `kind` is required.' }));
    }

    return unique;
  }

  private async run<T>(cb: () => Promise<T>) {
    if (!isUsageEnabled()) throw new ServiceError(usageUnavailableError);

    try {
      await usageDbConnect();
      return await cb();
    } catch (e) {
      Sentry.captureException(e);
      throw new ServiceError(usageUnavailableError);
    }
  }

  async record(event: UsageEvent) {
    if (!isUsageEnabled()) return;

    await bufferUsageEvent(event);
  }

  async getTimeline(d: UsageQueryInput & { interval?: UsageInterval; targetPoints?: number }) {
    let range = this.normalizeRange(d);
    let kinds = this.normalizeKinds(d.kinds);
    let { interval, intervalMs } = resolveUsageInterval({
      from: range.from,
      to: range.to,
      interval: d.interval,
      targetPoints: d.targetPoints
    });

    if ((range.to.getTime() - range.from.getTime()) / intervalMs > MAX_POINTS) {
      throw new ServiceError(
        badRequestError({ message: 'The interval is too small for the requested range.' })
      );
    }

    let timeline = await this.run(() =>
      queryUsageTimeline({
        ...range,
        kinds,
        instanceIds: d.instanceIds,
        dims: d.filters,
        intervalMs,
        groupBy: d.groupBy,
        maxSeries: d.maxSeries ?? DEFAULT_MAX_SERIES,
        includeDistinct: includesDistinctCounts(kinds)
      })
    );

    return { ...range, kinds, interval, intervalMs, groupBy: d.groupBy ?? null, ...timeline };
  }

  async getSummary(d: UsageQueryInput) {
    let range = this.normalizeRange(d);
    let kinds = this.normalizeKinds(d.kinds);

    let summary = await this.run(() =>
      queryUsageSummary({
        ...range,
        kinds,
        instanceIds: d.instanceIds,
        dims: d.filters,
        groupBy: d.groupBy,
        maxSeries: d.maxSeries ?? DEFAULT_MAX_SERIES,
        includeDistinct: includesDistinctCounts(kinds)
      })
    );

    return {
      ...range,
      kinds,
      groupBy: d.groupBy ?? null,
      total: summary.total,
      byKind: summary.kinds,
      top: summary.top
    };
  }

  async getUsageTimeline(opts: {
    owners: { id: string; type: 'instance' | 'organization' }[];
    entities: { type: string; id?: string }[];
    from: Date;
    to: Date;
    interval: { unit: 'day' | 'hour'; count: number };
  }) {
    let instanceIds = opts.owners
      .filter(owner => owner.type == 'instance')
      .map(owner => owner.id);

    let kinds = [
      ...new Set(opts.entities.map(entity => entity.type as UsageMetricKind))
    ].filter(kind => usageMetricKinds.includes(kind));

    if (!isUsageEnabled() || !instanceIds.length || !kinds.length) return [];

    let intervalMs =
      (opts.interval.unit == 'day' ? 24 * 60 * 60 * 1000 : 60 * 60 * 1000) *
      Math.max(1, opts.interval.count);
    let range = this.normalizeRange(opts);

    let perInstance = await Promise.all(
      instanceIds.map(async instanceId => {
        let timeline = await this.run(() =>
          queryUsageTimeline({
            ...range,
            kinds,
            instanceIds: [instanceId],
            intervalMs,
            groupBy: 'kind',
            maxSeries: kinds.length,
            includeDistinct: false
          })
        );

        return timeline.series.map(series => ({
          entityId: 'all',
          entityType: series.kind ?? 'all',
          ownerId: instanceId,
          entries: series.points.map(point => ({ ts: point.ts, count: point.count }))
        }));
      })
    );

    return perInstance.flat();
  }
}

export type UsageTimeline = Awaited<ReturnType<UsageServiceImpl['getTimeline']>>;
export type UsageSummary = Awaited<ReturnType<UsageServiceImpl['getSummary']>>;

export let usageService = Service.create('usage', () => new UsageServiceImpl()).build();

import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  accumulateUsageEvent,
  decodeUsageBucketKey,
  getUsageMetricId,
  type UsageAccumulatedBucket
} from '../src/lib/bucket';
import { buildMessageUsageEvent } from '../src/lib/events';
import { USAGE_MESSAGE_BACKFILL_ID, USAGE_MESSAGE_REVISION } from '../src/lib/messageRevision';
import { queryUsageSummary, queryUsageTimeline } from '../src/lib/query';
import { UsageBackfillStateModel, UsageMetricModel, type UsageMetric } from '../src/models';

let mongoUrl = process.env.USAGE_TEST_MONGO_URL;

vi.mock('../src/lib/connection', () => ({ usageDbConnect: async () => {} }));

describe.skipIf(!mongoUrl)('message history migration against MongoDB', () => {
  beforeAll(async () => {
    await mongoose.connect(mongoUrl!, { dbName: `usage_chart_test_${randomUUID()}` });
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  it('publishes rebuilt multi-day history once, retaining the old view until completion', async () => {
    let dayMs = 24 * 60 * 60 * 1000;
    let now = new Date();
    let days = [5, 4, 2].map(daysAgo => new Date(now.getTime() - daysAgo * dayMs));
    let ctx = { instance: { instanceId: 'ins_customer', organizationId: 'org_customer' } };
    let counts = [5, 2, 3];
    let legacy = days.map((ts, i): UsageMetric => ({
      _id: `legacy-${i}`,
      ts,
      source: i == 1 ? 'backfill' : 'live',
      ...ctx.instance,
      kind: i == 2 ? 'tool_call' : 'message',
      dims: {},
      count: counts[i]!,
      errorCount: 0,
      durationMsSum: 0,
      durationCount: 0,
      durationMsMax: 0
    }));
    await UsageMetricModel.insertMany([
      ...legacy,
      { ...legacy[0]!, _id: 'legacy-session', kind: 'session', count: 5 }
    ]);
    await UsageBackfillStateModel.create({
      _id: USAGE_MESSAGE_BACKFILL_ID,
      cutoff: now,
      sources: {},
      createdAt: now
    });

    let filter = {
      instanceIds: ['ins_customer'],
      kinds: ['tool_call' as const],
      from: new Date(now.getTime() - 7 * dayMs),
      to: now,
      maxSeries: 10,
      includeDistinct: true
    };
    let before = await queryUsageSummary(filter);
    expect(before.total.count).toBe(3);

    let buckets = new Map<string, UsageAccumulatedBucket>();
    for (let [i, ts] of days.entries()) {
      for (let j = 0; j < counts[i]!; j++) {
        accumulateUsageEvent(
          buckets,
          buildMessageUsageEvent(
            {
              type: 'mcp_message',
              status: 'succeeded',
              createdAt: ts,
              completedAt: null,
              methodOrToolKey: 'manage_forms',
              toolCall: { tool: { key: 'manage_forms' } }
            },
            ctx
          )
        );
      }
    }

    for (let status of ['failed', 'succeeded']) {
      accumulateUsageEvent(
        buckets,
        buildMessageUsageEvent(
          {
            type: 'mcp_message',
            status,
            createdAt: days[1]!,
            completedAt: null,
            methodOrToolKey: status == 'failed' ? 'manage_forms' : 'tools/list',
            toolCall: status == 'failed' ? { tool: { key: 'manage_forms' } } : null
          },
          ctx
        )
      );
    }

    let documents = [...buckets.values()].map(bucket => ({
      _id: getUsageMetricId(['rebuild', bucket.minute, bucket.field]),
      source: 'backfill' as const,
      messageRevision: USAGE_MESSAGE_REVISION,
      ts: new Date(bucket.minute),
      ...decodeUsageBucketKey(bucket.field),
      ...bucket.counters
    }));
    let operations = documents.map(document => ({
      updateOne: { filter: { _id: document._id }, update: { $set: document }, upsert: true }
    }));
    await UsageMetricModel.bulkWrite(operations);
    await UsageMetricModel.bulkWrite(operations);

    let during = await queryUsageSummary(filter);
    expect(during.total.count).toBe(3);

    await UsageBackfillStateModel.updateOne(
      { _id: USAGE_MESSAGE_BACKFILL_ID },
      { $set: { 'sources.session_message': { done: true, cursor: '12', updatedAt: now } } }
    );

    let timeline = await queryUsageTimeline({ ...filter, intervalMs: 6 * 60 * 60 * 1000 });
    let summary = await queryUsageSummary({ ...filter, groupBy: 'tool' });
    expect(timeline.total.reduce((sum, point) => sum + point.count, 0)).toBe(11);
    expect(timeline.total.reduce((sum, point) => sum + point.errorCount, 0)).toBe(1);
    expect(timeline.total.filter(point => point.count).map(point => point.count)).toEqual([
      5, 3, 3
    ]);
    expect(summary.total.count - summary.total.errorCount).toBe(10);
    expect(summary.top[0]?.group).toBe('manage_forms');

    let mixed = await queryUsageSummary({
      ...filter,
      kinds: ['tool_call', 'message', 'session']
    });
    expect(mixed.total.count).toBe(17);
    expect(mixed.kinds.find(item => item.kind == 'message')?.count).toBe(1);
    expect(mixed.kinds.find(item => item.kind == 'session')?.count).toBe(5);

    let foreign = await queryUsageSummary({ ...filter, instanceIds: ['ins_other'] });
    expect(foreign.total.count).toBe(0);
  });
});

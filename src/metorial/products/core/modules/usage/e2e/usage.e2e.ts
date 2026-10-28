import { eventually, uniqueId } from '@metorial/e2e';
import { describe, expect, it } from 'vitest';
import { usageService } from '../src';
import { UsageMetricModel } from '../src/models';
import { recordUsageEvents } from './_fixtures';

describe('module-usage', () => {
  it('returns a zero-filled timeline for an owner without usage', async () => {
    let to = new Date();
    let from = new Date(to.getTime() - 3 * 60 * 60 * 1000);
    let timeline = await usageService.getTimeline({
      instanceIds: [uniqueId('instance')],
      kinds: ['tool_call'],
      from,
      to,
      interval: '1h'
    });

    expect(timeline.total.length).toBeGreaterThan(0);
    expect(timeline.total.every(point => point.count === 0)).toBe(true);
    expect(timeline.series).toEqual([]);
  });

  it('aggregates recorded usage events into the timeline', async () => {
    let instanceId = uniqueId('instance');

    await recordUsageEvents(
      Array.from({ length: 5 }, (_, index) => ({
        instanceId,
        kind: 'tool_call',
        isError: index >= 2,
        durationMs: index < 2 ? 100 : 200
      }))
    );

    await eventually(async () => {
      let persisted = await UsageMetricModel.find({ instanceId }).lean();
      expect(persisted.reduce((sum, metric) => sum + metric.count, 0)).toBe(5);

      let query = {
        instanceIds: [instanceId],
        kinds: ['tool_call' as const],
        from: new Date(Date.now() - 60 * 60 * 1000),
        to: new Date()
      };
      let summary = await usageService.getSummary(query);
      expect(summary.total).toMatchObject({
        count: 5,
        errorCount: 3,
        durationMsSum: 800,
        durationCount: 5,
        durationMsMax: 200
      });

      let current = await usageService.getTimeline({ ...query, interval: '1h' });
      expect(current.total.reduce((sum, point) => sum + point.count, 0)).toBe(5);

      let timeline = await usageService.getUsageTimeline({
        owners: [{ id: instanceId, type: 'instance' }],
        entities: [{ type: 'tool_call' }],
        from: query.from,
        to: query.to,
        interval: { unit: 'hour', count: 1 }
      });

      let series = timeline.find(item => item.ownerId === instanceId);
      expect(series).toMatchObject({ entityId: 'all', entityType: 'tool_call' });
      expect(series!.entries.reduce((sum, entry) => sum + entry.count, 0)).toBe(5);
    });
  });
});

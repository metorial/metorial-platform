import { eventually, uniqueId } from '@metorial/e2e';
import { describe, expect, it } from 'vitest';
import { usageService } from '../src';

describe('module-usage', () => {
  it('returns a zero-filled timeline for an owner without usage', async () => {
    let to = new Date();
    let from = new Date(to.getTime() - 3 * 60 * 60 * 1000);
    let entityId = uniqueId('entity');

    let timeline = await usageService.getUsageTimeline({
      owners: [{ id: uniqueId('owner'), type: 'instance' }],
      entities: [{ type: 'e2e_entity', id: entityId }],
      from,
      to,
      interval: { unit: 'hour', count: 1 }
    });

    expect(timeline).toHaveLength(1);
    expect(timeline[0]!.entityId).toBe(entityId);
    expect(timeline[0]!.entries.length).toBeGreaterThan(0);
    expect(timeline[0]!.entries.every(entry => entry.count === 0)).toBe(true);
  });

  it('aggregates ingested usage records into the timeline', async () => {
    let owner = { id: uniqueId('owner'), type: 'instance' as const };
    let entity = { id: uniqueId('entity'), type: 'e2e_entity' };

    await usageService.ingestUsageRecord({ owner, entity, type: 'e2e.call', count: 2 });
    await usageService.ingestUsageRecord({ owner, entity, type: 'e2e.call', count: 3 });

    await eventually(async () => {
      let timeline = await usageService.getUsageTimeline({
        owners: [owner],
        entities: [entity],
        from: new Date(Date.now() - 60 * 60 * 1000),
        to: new Date(),
        interval: { unit: 'hour', count: 1 }
      });

      let series = timeline.find(item => item.ownerId === owner.id);
      expect(series?.entityId).toBe(entity.id);
      expect(series!.entries.reduce((sum, entry) => sum + entry.count, 0)).toBe(5);
    });
  });
});

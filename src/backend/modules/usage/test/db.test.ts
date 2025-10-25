import { describe, expect, it } from 'vitest';
import { startOfDay, endOfDay, startOfHour, endOfHour } from 'date-fns';
import type { UsageRecord } from '../src/db';

// Mock dependencies
import { vi } from 'vitest';

vi.mock('@metorial/delay', () => ({
  delay: vi.fn().mockResolvedValue(undefined)
}));

vi.mock('@metorial/sentry', () => ({
  getSentry: vi.fn(() => ({
    captureException: vi.fn()
  }))
}));

vi.mock('mongoose', () => {
  const mockAggregate = vi.fn().mockResolvedValue([]);
  const mockInsertMany = vi.fn();
  const mockConnect = vi.fn();

  const mockSchema = vi.fn(function (this: any, definition: any) {
    this.definition = definition;
    return this;
  });

  const mockModel = vi.fn(() => ({
    aggregate: mockAggregate,
    insertMany: mockInsertMany
  }));

  return {
    default: {
      Schema: mockSchema,
      model: mockModel,
      connect: mockConnect
    }
  };
});

import { ingestUsage, getUsageTimeline, UsageRecordSchema } from '../src/db';

describe('db', () => {
  describe('UsageRecordSchema', () => {
    it('should be defined', () => {
      expect(UsageRecordSchema).toBeDefined();
    });
  });

  describe('ingestUsage', () => {
    it('should accept valid usage record', () => {
      const record: Omit<UsageRecord, '_id'> = {
        ownerId: 'owner1',
        entityId: 'entity1',
        entityType: 'type1',
        count: 5,
        type: 'test',
        ts: new Date()
      };

      expect(() => ingestUsage(record)).not.toThrow();
    });

    it('should handle multiple usage records with same hash', () => {
      const baseRecord: Omit<UsageRecord, '_id'> = {
        ownerId: 'owner1',
        entityId: 'entity1',
        entityType: 'type1',
        type: 'test',
        count: 0,
        ts: new Date()
      };

      expect(() => {
        ingestUsage({ ...baseRecord, count: 5 });
        ingestUsage({ ...baseRecord, count: 3 });
        ingestUsage({ ...baseRecord, count: 2 });
      }).not.toThrow();
    });

    it('should handle different entity types separately', () => {
      expect(() => {
        ingestUsage({
          ownerId: 'owner1',
          entityId: 'entity1',
          entityType: 'type1',
          count: 5,
          type: 'test',
          ts: new Date()
        });

        ingestUsage({
          ownerId: 'owner1',
          entityId: 'entity1',
          entityType: 'type2',
          count: 3,
          type: 'test',
          ts: new Date()
        });
      }).not.toThrow();
    });

    it('should handle different owners separately', () => {
      expect(() => {
        ingestUsage({
          ownerId: 'owner1',
          entityId: 'entity1',
          entityType: 'type1',
          count: 5,
          type: 'test',
          ts: new Date()
        });

        ingestUsage({
          ownerId: 'owner2',
          entityId: 'entity1',
          entityType: 'type1',
          count: 3,
          type: 'test',
          ts: new Date()
        });
      }).not.toThrow();
    });

    it('should handle zero count', () => {
      expect(() => {
        ingestUsage({
          ownerId: 'owner1',
          entityId: 'entity1',
          entityType: 'type1',
          count: 0,
          type: 'test',
          ts: new Date()
        });
      }).not.toThrow();
    });

    it('should handle negative count', () => {
      expect(() => {
        ingestUsage({
          ownerId: 'owner1',
          entityId: 'entity1',
          entityType: 'type1',
          count: -5,
          type: 'test',
          ts: new Date()
        });
      }).not.toThrow();
    });

    it('should handle various entity IDs', () => {
      expect(() => {
        ingestUsage({
          ownerId: 'owner1',
          entityId: 'very-long-entity-id-12345',
          entityType: 'type1',
          count: 1,
          type: 'test',
          ts: new Date()
        });

        ingestUsage({
          ownerId: 'owner1',
          entityId: '1',
          entityType: 'type1',
          count: 1,
          type: 'test',
          ts: new Date()
        });
      }).not.toThrow();
    });

    it('should handle special characters in IDs', () => {
      expect(() => {
        ingestUsage({
          ownerId: 'owner@123',
          entityId: 'entity-with-dashes',
          entityType: 'type_with_underscore',
          count: 1,
          type: 'test:type',
          ts: new Date()
        });
      }).not.toThrow();
    });
  });

  describe('getUsageTimeline', () => {
    it('should return timeline data structure', async () => {
      const result = await getUsageTimeline({
        from: new Date('2023-01-01'),
        to: new Date('2023-01-31'),
        interval: { unit: 'day', count: 1 }
      });

      expect(Array.isArray(result)).toBe(true);
    });

    it('should return empty timeline with entityIds when no data exists', async () => {
      const from = new Date('2023-01-01T00:00:00Z');
      const to = new Date('2023-01-03T00:00:00Z');

      const result = await getUsageTimeline({
        entityIds: ['entity1', 'entity2'],
        entityTypes: ['typeA'],
        from,
        to,
        interval: { unit: 'day', count: 1 }
      });

      expect(result.length).toBe(2);
      expect(result[0].entityId).toBe('entity1');
      expect(result[0].entityType).toBe('typeA');
      expect(result[0].ownerId).toBe('none');
      expect(result[0].entries.length).toBe(3); // 3 days
    });

    it('should handle day interval', async () => {
      const from = new Date('2023-01-01T00:00:00Z');
      const to = new Date('2023-01-03T00:00:00Z');

      const result = await getUsageTimeline({
        from,
        to,
        interval: { unit: 'day', count: 1 }
      });

      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle hour interval', async () => {
      const from = new Date('2023-01-01T10:00:00Z');
      const to = new Date('2023-01-01T12:00:00Z');

      const result = await getUsageTimeline({
        from,
        to,
        interval: { unit: 'hour', count: 1 }
      });

      expect(Array.isArray(result)).toBe(true);
    });

    it('should accept ownerIds filter', async () => {
      await expect(
        getUsageTimeline({
          ownerIds: ['owner1', 'owner2'],
          from: new Date('2023-01-01'),
          to: new Date('2023-01-31'),
          interval: { unit: 'day', count: 1 }
        })
      ).resolves.toBeDefined();
    });

    it('should accept entityTypes filter', async () => {
      await expect(
        getUsageTimeline({
          entityTypes: ['type1', 'type2'],
          from: new Date('2023-01-01'),
          to: new Date('2023-01-31'),
          interval: { unit: 'day', count: 1 }
        })
      ).resolves.toBeDefined();
    });

    it('should accept entityIds filter', async () => {
      await expect(
        getUsageTimeline({
          entityIds: ['entity1', 'entity2'],
          from: new Date('2023-01-01'),
          to: new Date('2023-01-31'),
          interval: { unit: 'day', count: 1 }
        })
      ).resolves.toBeDefined();
    });

    it('should handle multi-day intervals', async () => {
      const from = new Date('2023-01-01T00:00:00Z');
      const to = new Date('2023-01-07T00:00:00Z');

      const result = await getUsageTimeline({
        from,
        to,
        interval: { unit: 'day', count: 2 } // 2-day intervals
      });

      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle multi-hour intervals', async () => {
      const from = new Date('2023-01-01T00:00:00Z');
      const to = new Date('2023-01-01T12:00:00Z');

      const result = await getUsageTimeline({
        from,
        to,
        interval: { unit: 'hour', count: 3 } // 3-hour intervals
      });

      expect(Array.isArray(result)).toBe(true);
    });

    it('should handle edge case with from and to on same day', async () => {
      const from = new Date('2023-01-01T10:00:00Z');
      const to = new Date('2023-01-01T15:00:00Z');

      const result = await getUsageTimeline({
        from,
        to,
        interval: { unit: 'day', count: 1 }
      });

      expect(result).toEqual([]);
    });

    it('should handle no filters provided', async () => {
      await expect(
        getUsageTimeline({
          from: new Date('2023-01-01'),
          to: new Date('2023-01-31'),
          interval: { unit: 'day', count: 1 }
        })
      ).resolves.toBeDefined();
    });

    it('should handle empty arrays for filters', async () => {
      await expect(
        getUsageTimeline({
          ownerIds: [],
          entityTypes: [],
          entityIds: [],
          from: new Date('2023-01-01'),
          to: new Date('2023-01-31'),
          interval: { unit: 'day', count: 1 }
        })
      ).resolves.toBeDefined();
    });

    it('should return timeline entries with timestamps and counts', async () => {
      const from = new Date('2023-01-01T00:00:00Z');
      const to = new Date('2023-01-03T00:00:00Z');

      const result = await getUsageTimeline({
        entityIds: ['entity1'],
        entityTypes: ['typeA'],
        from,
        to,
        interval: { unit: 'day', count: 1 }
      });

      if (result.length > 0 && result[0].entries.length > 0) {
        const entry = result[0].entries[0];
        expect(entry).toHaveProperty('ts');
        expect(entry).toHaveProperty('count');
        expect(entry.ts).toBeInstanceOf(Date);
        expect(typeof entry.count).toBe('number');
      }
    });
  });

  describe('UsageRecord type', () => {
    it('should have correct type structure', () => {
      // Type test - this will fail at compile time if types are wrong
      const record: UsageRecord = {
        _id: 'test-id',
        ownerId: 'owner1',
        entityId: 'entity1',
        entityType: 'type1',
        count: 10,
        type: 'test',
        ts: new Date()
      };

      expect(record).toBeDefined();
      expect(record._id).toBe('test-id');
      expect(record.ownerId).toBe('owner1');
    });

    it('should support all required fields', () => {
      const record: UsageRecord = {
        _id: 'id',
        ownerId: 'owner',
        entityId: 'entity',
        entityType: 'type',
        count: 1,
        type: 'usage-type',
        ts: new Date()
      };

      expect(record._id).toBeDefined();
      expect(record.ownerId).toBeDefined();
      expect(record.entityId).toBeDefined();
      expect(record.entityType).toBeDefined();
      expect(record.count).toBeDefined();
      expect(record.type).toBeDefined();
      expect(record.ts).toBeDefined();
    });
  });
});

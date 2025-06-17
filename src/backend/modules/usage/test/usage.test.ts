import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as db from '../src/db';
import { usageService } from '../src/services/usage';

describe('UsageService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ingestUsageRecord', () => {
    it('should call ingestUsage with correct parameters and default count', async () => {
      const ingestUsageSpy = vi.spyOn(db, 'ingestUsage').mockImplementation(() => {});

      const opts = {
        owner: { id: 'owner1', type: 'instance' as const },
        entity: { id: 'entity1', type: 'someType' },
        type: 'testType'
      };

      await usageService.ingestUsageRecord(opts);

      expect(ingestUsageSpy).toHaveBeenCalledTimes(1);
      const callArgs = ingestUsageSpy.mock.calls[0][0];
      expect(callArgs).toMatchObject({
        ownerId: 'owner1',
        entityId: 'entity1',
        entityType: 'someType',
        type: 'testType',
        count: 1
      });
      expect(callArgs.ts).toBeInstanceOf(Date);
    });

    it('should call ingestUsage with provided count', async () => {
      const ingestUsageSpy = vi.spyOn(db, 'ingestUsage').mockImplementation(() => {});

      const opts = {
        owner: { id: 'owner2', type: 'organization' as const },
        entity: { id: 'entity2', type: 'anotherType' },
        type: 'anotherTestType',
        count: 5
      };

      await usageService.ingestUsageRecord(opts);

      expect(ingestUsageSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          ownerId: 'owner2',
          entityId: 'entity2',
          entityType: 'anotherType',
          type: 'anotherTestType',
          count: 5
        })
      );
    });
  });

  describe('getUsageTimeline', () => {
    it('should call getUsageTimeline with mapped parameters and return its result', async () => {
      const mockResult = [{ ts: new Date(), count: 2 }];
      const getUsageTimelineSpy = vi
        .spyOn(db, 'getUsageTimeline')
        .mockResolvedValue(mockResult as any);

      const opts = {
        owners: [
          { id: 'ownerA', type: 'instance' as const },
          { id: 'ownerB', type: 'organization' as const }
        ],
        entityIds: ['entityA', 'entityB'],
        entityTypes: ['typeA', 'typeB'],
        from: new Date('2023-01-01'),
        to: new Date('2023-01-31'),
        interval: { unit: 'day' as const, count: 1 }
      };

      const result = await usageService.getUsageTimeline(opts);

      expect(getUsageTimelineSpy).toHaveBeenCalledWith({
        ownerIds: ['ownerA', 'ownerB'],
        entityIds: ['entityA', 'entityB'],
        entityTypes: ['typeA', 'typeB'],
        from: opts.from,
        to: opts.to,
        interval: opts.interval
      });
      expect(result).toBe(mockResult);
    });
  });
});

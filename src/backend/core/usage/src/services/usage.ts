import { Service } from '@metorial/service';
import { getUsageTimeline, ingestUsage } from '../db';

class UsageServiceImpl {
  async ingestUsageRecord(opts: {
    owner: { id: string; type: 'instance' | 'organization' };
    entity: { id: string; type: string };
    type: string;
    count?: number;
  }) {
    ingestUsage({
      ownerId: opts.owner.id,
      entityId: opts.entity.id,
      entityType: opts.entity.type,
      type: opts.type,
      count: opts.count || 1,
      ts: new Date()
    });
  }

  async getUsageTimeline(opts: {
    owners: { id: string; type: 'instance' | 'organization' }[];
    entityIds: string[];
    entityTypes: string[];

    from: Date;
    to: Date;

    interval: {
      unit: 'day' | 'hour';
      count: number;
    };
  }) {
    return getUsageTimeline({
      ownerIds: opts.owners.map(owner => owner.id),
      entityIds: opts.entityIds,
      entityTypes: opts.entityTypes,
      from: opts.from,
      to: opts.to,
      interval: opts.interval
    });
  }
}

export let usageService = Service.create('usage', () => new UsageServiceImpl()).build();

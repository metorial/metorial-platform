import { notFoundError, ServiceError } from '@lowerdeck/error';
import { db } from '@metorial/db';
import type { ConsumerGroup, Instance } from '@metorial/db';
import { hasInstanceConsumerAccess } from '../../../lib/cargoAccess';

export let getConsumerAccessibleSkillMarketplaceIds = async (d: {
  instance: Instance;
  consumerGroups?: ConsumerGroup[] | null;
}) => {
  if (!d.consumerGroups?.length) return [];

  let accesses = await db.consumerAccess.findMany({
    where: {
      consumerGroupOid: {
        in: d.consumerGroups.map(group => group.oid)
      },
      type: 'skill_marketplace',
      skillMarketplace: {
        instanceOid: d.instance.oid,
        status: 'active'
      }
    },
    include: {
      skillMarketplace: true
    }
  });

  return [
    ...new Set(
      accesses.map(access => access.skillMarketplace?.id).filter((id): id is string => !!id)
    )
  ];
};

export let getReadSkillMarketplaceFilter = async (ctx: {
  instance: Instance;
  consumerGroups?: ConsumerGroup[] | null;
  consumerProfile?: unknown;
  member?: unknown;
}) => {
  if (!hasInstanceConsumerAccess(ctx as any)) return undefined;

  return await getConsumerAccessibleSkillMarketplaceIds({
    instance: ctx.instance,
    consumerGroups: ctx.consumerGroups
  });
};

export let assertConsumerCanAccessSkillMarketplace = async (
  ctx: {
    instance: Instance;
    consumerGroups?: ConsumerGroup[] | null;
    consumerProfile?: unknown;
    member?: unknown;
  },
  skillMarketplaceId: string
) => {
  if (!hasInstanceConsumerAccess(ctx as any)) return;

  let ids = await getConsumerAccessibleSkillMarketplaceIds({
    instance: ctx.instance,
    consumerGroups: ctx.consumerGroups
  });

  if (!ids.includes(skillMarketplaceId)) {
    throw new ServiceError(notFoundError('skill.marketplace', skillMarketplaceId));
  }
};

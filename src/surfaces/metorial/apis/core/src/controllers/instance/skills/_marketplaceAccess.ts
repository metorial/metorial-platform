import { hasInstanceConsumerAccess } from '../../../lib/cargoAccess';

export let getSkillMarketplaceAccessInput = (ctx: {
  accessTags?: any;
  consumerGroups?: Array<{ oid: bigint }> | null;
  consumerProfile?: unknown;
  member?: unknown;
}) => {
  if (!hasInstanceConsumerAccess(ctx as any)) return {};

  return {
    accessTags: ctx.accessTags
  };
};

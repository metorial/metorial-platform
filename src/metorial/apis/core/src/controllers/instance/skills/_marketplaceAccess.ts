import { hasInstanceConsumerAccess } from '../../../lib/cargoAccess';
import { isLegacyResourceAuthorizationEnabled } from '@metorial/module-access';

export let getSkillMarketplaceAccessInput = (ctx: {
  accessTags?: any;
  consumerGroups?: Array<{ oid: bigint }> | null;
  consumerProfile?: unknown;
  member?: unknown;
}) => {
  if (!hasInstanceConsumerAccess(ctx as any)) return {};

  return {
    accessTags: ctx.accessTags,
    // Keep the old ConsumerAccess relation as a shadow compatibility source until
    // every marketplace access has been materialized as an AccessTagEntity.
    legacyConsumerGroupOids: isLegacyResourceAuthorizationEnabled()
      ? (ctx.consumerGroups?.map(group => group.oid) ?? [])
      : []
  };
};

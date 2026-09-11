import type {
  AuditConsumerAccessListing,
  AuditConsumerAccessTarget,
  AuditConsumerProfile,
  AuditConsumerSurface
} from '@metorial/fabric';

export let auditedMessageLimit = 500;

export let auditedEmailWhitelistLimit = 25;

export let truncateAuditedText = (value: string | null, limit = auditedMessageLimit) => {
  if (value === null) return { value: null, truncated: false };
  if (value.length <= limit) return { value, truncated: false };

  return { value: value.slice(0, limit), truncated: true };
};

export let consumerSurfacePayload = (surface: AuditConsumerSurface) => ({
  id: surface.id,
  type: surface.type,
  name: surface.name,
  portalId: surface.portal?.id ?? null
});

export let consumerProfilePayload = (consumerProfile: AuditConsumerProfile) => ({
  id: consumerProfile.id,
  status: consumerProfile.status,
  name: consumerProfile.name,
  email: consumerProfile.email,
  inviteStatus: consumerProfile.inviteStatus,
  aresUserId: consumerProfile.aresUserId,
  consumer: {
    id: consumerProfile.consumer.id,
    email: consumerProfile.consumer.email
  },
  ssoGroupIds: consumerProfile.ssoGroupIds,
  ssoRoles: consumerProfile.ssoRoles,
  surface: consumerSurfacePayload(consumerProfile.surface)
});

export let consumerAccessTargetPayload = (
  type: string,
  target: Partial<AuditConsumerAccessTarget>
) => {
  let resolved =
    type == 'provider_template'
      ? target.providerTemplate
      : type == 'magic_mcp_server'
        ? target.magicMcpServer
        : type == 'skill'
          ? target.skill
          : type == 'skill_template'
            ? target.skillTemplate
            : type == 'skill_group'
              ? target.skillGroup
              : type == 'skill_marketplace'
                ? target.skillMarketplace
                : type == 'skill_plugin'
                  ? target.skillPlugin
                  : null;

  return {
    type,
    id: resolved?.id ?? null,
    name: resolved?.name ?? null
  };
};

export let consumerAccessListingTargetPayload = (listing: AuditConsumerAccessListing) => {
  let type = listing.providerTemplateOid
    ? 'provider_template'
    : listing.magicMcpServerOid
      ? 'magic_mcp_server'
      : listing.skillOid
        ? 'skill'
        : listing.skillTemplateOid
          ? 'skill_template'
          : listing.skillGroupOid
            ? 'skill_group'
            : listing.skillMarketplaceOid
              ? 'skill_marketplace'
              : listing.skillPluginOid
                ? 'skill_plugin'
                : 'unknown';

  return consumerAccessTargetPayload(type, listing);
};

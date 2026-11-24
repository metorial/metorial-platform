import type { GatewayToken, Instance, Organization, Project } from '@mtsrc/ai-gateway-db';
import { resolveInstanceSettings, type GatewayPrincipal } from '@mtsrc/ai-gateway-spec';

export type GatewayTokenForPrincipal = GatewayToken & {
  organization: Organization;
  instance: Instance & { project: Project };
};

export let isTokenScopeArchived = (d: GatewayTokenForPrincipal) =>
  !!(d.organization.archivedAt || d.instance.project.archivedAt || d.instance.archivedAt);

export let projectRestrictions = (
  project: Pick<
    Project,
    'disabledAt' | 'disabledReason' | 'billingRestrictedAt' | 'billingRestrictionReason'
  >
) => ({
  disabled: project.disabledAt ? { reason: project.disabledReason } : null,
  billingRestriction: project.billingRestrictedAt
    ? { reason: project.billingRestrictionReason }
    : null
});

export let tokenPrincipal = (gatewayToken: GatewayTokenForPrincipal): GatewayPrincipal => ({
  token: {
    id: gatewayToken.id,
    consumerRef: gatewayToken.consumerRef,
    allowedModels: gatewayToken.allowedModels,
    limits: gatewayToken.limits,
    metadata: gatewayToken.metadata
  },

  organization: { id: gatewayToken.organization.id, ref: gatewayToken.organization.ref },
  project: {
    id: gatewayToken.instance.project.id,
    ref: gatewayToken.instance.project.ref,
    platformLimits: gatewayToken.instance.project.platformLimits,
    ...projectRestrictions(gatewayToken.instance.project)
  },
  instance: {
    id: gatewayToken.instance.id,
    ref: gatewayToken.instance.ref,
    logRetentionDays: gatewayToken.instance.logRetentionDays,
    settings: resolveInstanceSettings(gatewayToken.instance.settings),
    limits: gatewayToken.instance.limits
  }
});

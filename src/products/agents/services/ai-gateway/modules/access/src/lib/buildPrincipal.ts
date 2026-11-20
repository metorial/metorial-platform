import type { GatewayToken, Instance, Organization, Project } from '@mtsrc/ai-gateway-db';
import { resolveInstanceSettings, type GatewayPrincipal } from '@mtsrc/ai-gateway-spec';

export type GatewayTokenForPrincipal = GatewayToken & {
  organization: Organization;
  instance: Instance & { project: Project };
};

export let isTokenScopeArchived = (d: GatewayTokenForPrincipal) =>
  !!(d.organization.archivedAt || d.instance.project.archivedAt || d.instance.archivedAt);

export let tokenPrincipal = (gatewayToken: GatewayTokenForPrincipal): GatewayPrincipal => ({
  token: {
    id: gatewayToken.id,
    consumerRef: gatewayToken.consumerRef,
    allowedModels: gatewayToken.allowedModels,
    limits: gatewayToken.limits,
    metadata: gatewayToken.metadata
  },

  organization: { id: gatewayToken.organization.id, ref: gatewayToken.organization.ref },
  project: { id: gatewayToken.instance.project.id, ref: gatewayToken.instance.project.ref },
  instance: {
    id: gatewayToken.instance.id,
    ref: gatewayToken.instance.ref,
    logRetentionDays: gatewayToken.instance.logRetentionDays,
    settings: resolveInstanceSettings(gatewayToken.instance.settings)
  }
});

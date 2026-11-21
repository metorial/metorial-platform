import type { GatewayToken, Instance, Project } from '@mtsrc/ai-gateway-db';

export let gatewayTokenPresenter = (
  gatewayToken: GatewayToken & { instance: Instance & { project: Project } }
) => ({
  object: 'ai_gateway#gateway_token',

  id: gatewayToken.id,
  prefix: gatewayToken.prefix,
  name: gatewayToken.name,
  consumerRef: gatewayToken.consumerRef,

  instance: {
    id: gatewayToken.instance.id,
    ref: gatewayToken.instance.ref,
    projectId: gatewayToken.instance.project.id
  },

  allowedModels: gatewayToken.allowedModels,
  limits: gatewayToken.limits,
  metadata: gatewayToken.metadata,

  lastUsedAt: gatewayToken.lastUsedAt,
  expiresAt: gatewayToken.expiresAt,
  revokedAt: gatewayToken.revokedAt,
  createdAt: gatewayToken.createdAt
});

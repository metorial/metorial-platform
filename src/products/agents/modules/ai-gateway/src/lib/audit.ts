import type {
  AuditAiGatewayConfig,
  AuditAiGatewayProviderConnection,
  AuditAiGatewayToken,
  AuditAiGatewayVirtualModel
} from '@metorial/fabric';
import type {
  AiGatewayInstance,
  AiGatewayProviderConnection,
  AiGatewayToken,
  AiGatewayVirtualModel
} from './client';

export let toAuditConfig = (instance: AiGatewayInstance): AuditAiGatewayConfig => ({
  logRetentionDays: instance.logRetentionDays,
  settings: instance.settings,
  limits: instance.limits
});

export let toAuditToken = (token: AiGatewayToken): AuditAiGatewayToken => ({
  id: token.id,
  name: token.name,
  consumerRef: token.consumerRef,
  allowedModels: token.allowedModels,
  expiresAt: token.expiresAt,
  revokedAt: token.revokedAt
});

export let toAuditProviderConnection = (
  connection: AiGatewayProviderConnection
): AuditAiGatewayProviderConnection => ({
  id: connection.id,
  name: connection.name,
  providerSlug: connection.provider.slug,
  status: connection.status,
  priority: connection.priority
});

export let toAuditVirtualModel = (
  virtualModel: AiGatewayVirtualModel
): AuditAiGatewayVirtualModel => ({
  id: virtualModel.id,
  slug: virtualModel.slug,
  name: virtualModel.name,
  versionId: virtualModel.currentVersion?.id ?? null,
  versionNumber: virtualModel.currentVersion?.number ?? null
});

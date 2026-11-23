import type {
  Instance,
  Organization,
  Project,
  Provider,
  ProviderConnection
} from '@mtsrc/ai-gateway-db';

export let providerConnectionPresenter = (
  connection: ProviderConnection & {
    provider: Provider;
    organization: Organization;
    instance: Instance & { project: Project };
  }
) => ({
  object: 'ai_gateway#provider_connection',

  id: connection.id,
  name: connection.name,
  description: connection.description,
  priority: connection.priority,

  provider: {
    id: connection.provider.id,
    slug: connection.provider.slug,
    name: connection.provider.name
  },

  organizationId: connection.organization.id,
  instance: {
    id: connection.instance.id,
    ref: connection.instance.ref,
    projectId: connection.instance.project.id
  },

  config: connection.config,
  features: connection.features,
  pricingOverride: connection.pricingOverride,
  credentialHint: connection.credentialHint,

  status: connection.status,
  statusMessage: connection.statusMessage,
  consecutiveFailures: connection.consecutiveFailures,

  lastCheckedAt: connection.lastCheckedAt,
  lastValidAt: connection.lastValidAt,
  nextCheckAt: connection.nextCheckAt,
  archivedAt: connection.archivedAt,
  createdAt: connection.createdAt,
  updatedAt: connection.updatedAt
});

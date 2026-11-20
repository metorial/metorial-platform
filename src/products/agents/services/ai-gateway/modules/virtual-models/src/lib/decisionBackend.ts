import { db } from '@mtsrc/ai-gateway-db';
import { DecisionError } from '@mtsrc/ai-gateway-decisions';
import {
  allPlatformConnections,
  connectionInclude,
  platformConnectionRegistry,
  providerConnectionService
} from '@mtsrc/ai-gateway-module-credentials';
import {
  decisionModels,
  hasFeatures,
  type DecisionConfig,
  type ProviderConnectionConfig,
  type ProviderCredentials,
  type ProviderFeature
} from '@mtsrc/ai-gateway-spec';

let usableStatuses = new Set(['valid', 'pending']);

export type DecisionBackend = {
  credentials: ProviderCredentials;
  config: ProviderConnectionConfig;
} & (
  | { source: 'customer'; connectionId: string }
  | { source: 'platform'; platformConnectionSlug: string }
);

export let findCustomerDecisionConnection = async (d: {
  instanceId: string;
  connectionId: string;
}) =>
  await db.providerConnection.findFirst({
    where: { id: d.connectionId, instance: { id: d.instanceId }, archivedAt: null },
    include: connectionInclude
  });

export let resolveDecisionBackend = async (d: {
  instanceId: string;
  config: DecisionConfig;
  requiredFeatures: ProviderFeature[];
}): Promise<DecisionBackend> => {
  let model = decisionModels[d.config.model];

  if (d.config.connectionId) {
    let connection = await findCustomerDecisionConnection({
      instanceId: d.instanceId,
      connectionId: d.config.connectionId
    });

    if (!connection || connection.provider.slug != model.providerSlug) {
      throw new DecisionError(
        'unavailable',
        'The decision model connection no longer exists.'
      );
    }
    if (!usableStatuses.has(connection.status)) {
      throw new DecisionError(
        'unavailable',
        `The decision model connection is ${connection.status}.`
      );
    }
    if (!hasFeatures(connection.features, d.requiredFeatures)) {
      throw new DecisionError(
        'unavailable',
        'The decision model connection does not have zero data retention enabled.'
      );
    }

    return {
      source: 'customer',
      connectionId: connection.id,
      credentials: await providerConnectionService.getCredentials({ connection }),
      config: connection.config
    };
  }

  let platform = allPlatformConnections.find(
    definition =>
      definition.providerSlug == model.providerSlug &&
      usableStatuses.has(platformConnectionRegistry.status(definition.slug) ?? '') &&
      hasFeatures(definition.features, d.requiredFeatures)
  );
  if (!platform) {
    throw new DecisionError(
      'unavailable',
      `Metorial cannot serve ${model.name} for this instance. Connect your own ${model.name} key.`
    );
  }

  return {
    source: 'platform',
    platformConnectionSlug: platform.slug,
    credentials: platformConnectionRegistry.credentials(platform.slug),
    config: platformConnectionRegistry.config(platform.slug)
  };
};

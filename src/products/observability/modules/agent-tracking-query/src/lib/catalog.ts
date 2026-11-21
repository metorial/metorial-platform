import { isServiceError } from '@lowerdeck/error';
import {
  clientFamilyName,
  fromServiceFamily,
  requireAgentTracking
} from '@metorial/module-agent-tracking-sync';
import { cached, catalogTtlSeconds } from './cache';
import { unique } from './members';
import { readCallOptions } from './service';

export let lookupModelNames = async (modelIds: (string | null | undefined)[]) => {
  let ids = unique(modelIds);

  let names = await Promise.all(
    ids.map(modelId =>
      cached({
        key: `catalog:model:${modelId}`,
        ttlSeconds: catalogTtlSeconds,
        load: async () => {
          let agentTracking = requireAgentTracking();

          try {
            let model = await agentTracking.knowledge.models.get({ modelId }, readCallOptions);
            return model.name ?? null;
          } catch (error) {
            if (isServiceError(error) && error.data.status == 404) return null;
            throw error;
          }
        }
      }).catch(() => null)
    )
  );

  return new Map(ids.map((id, index) => [id, names[index] ?? null]));
};

export let clientOf = (client: {
  family: string;
  surface?: string | null;
  version?: string | null;
}) => {
  let family = fromServiceFamily(client.family);

  return {
    family,
    name: clientFamilyName(family) as string | null,
    surface: client.surface ?? null,
    version: client.version ?? null
  };
};

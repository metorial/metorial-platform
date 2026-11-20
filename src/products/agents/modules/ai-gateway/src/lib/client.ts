import { isServiceError } from '@lowerdeck/error';
import { createAiGatewayClient } from '@mtsrc/ai-gateway-client-internal';
import { aiGatewaySettings } from '../env';

export type AiGateway = ReturnType<typeof createAiGatewayClient>;

let client: AiGateway | undefined;

export let isAiGatewayEnabled = () => !!aiGatewaySettings.apiUrl;

export let getAiGateway = () => {
  let endpoint = aiGatewaySettings.apiUrl;
  if (!endpoint) return null;

  client ??= createAiGatewayClient({ endpoint });

  return client;
};

// Archiving something the gateway no longer has (or already archived) is the goal state.
export let ignoreNotFound = async <T>(promise: Promise<T>) => {
  try {
    return await promise;
  } catch (error) {
    if (isServiceError(error) && error.data.status == 404) return null;
    throw error;
  }
};

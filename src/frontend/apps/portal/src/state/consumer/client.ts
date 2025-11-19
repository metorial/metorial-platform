import { MetorialConsumerSDK, createMetorialConsumerSDK } from '@metorial/consumer-sdk';
import { withTokens } from '../portal/client';

let clients = new Map<string, MetorialConsumerSDK>();

export let withSdk = <T>(fn: (sdk: MetorialConsumerSDK) => Promise<T>) =>
  withTokens(async tokens => {
    let hash = `${tokens.apiKey}|${tokens.consumerSessionToken}|${tokens.portalSessionToken}`;

    let sdk = clients.get(hash);
    if (!sdk) {
      sdk = createMetorialConsumerSDK({
        apiKey: tokens.apiKey,
        consumerToken: tokens.consumerSessionToken,
        apiHost: import.meta.env.VITE_CORE_API_URL
      });
      clients.set(hash, sdk);
    }

    return await fn(sdk);
  });

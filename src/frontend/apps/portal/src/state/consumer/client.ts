import { MetorialConsumerSDK, createMetorialConsumerSDK } from '@metorial/consumer-sdk';
import { withTokens } from '../portal/client';

export type PortalConsumerClient = MetorialConsumerSDK;

let clients = new Map<string, PortalConsumerClient>();

export let withSdk = <T>(fn: (sdk: PortalConsumerClient) => Promise<T>) =>
  withTokens(async tokens => {
    let hash = `${tokens.apiKey}|${tokens.consumerSessionToken}`;

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

export let withConsumerClient = withSdk;

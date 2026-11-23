import {
  decisionProviderSlugs,
  type DecisionModel,
  type ProviderConnectionConfig,
  type ProviderCredentials
} from '@mtsrc/ai-gateway-spec';
import { DecisionError } from './errors';

let typesafeUrl = 'https://api.typesafe.ai/v1/systemone';

let cloudflareUrl = (accountId: string, vendorModelId: string) =>
  `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/run/@cf/cloudflare/${vendorModelId}`;

let stringValue = (values: Record<string, unknown>, key: string) => {
  let value = values[key];
  if (typeof value != 'string' || !value) {
    throw new DecisionError('unavailable', `The decision connection is missing its ${key}.`);
  }

  return value;
};

export let decisionEndpoint = (d: {
  model: DecisionModel;
  credentials: ProviderCredentials;
  config: ProviderConnectionConfig;
}) => {
  if (d.model.providerSlug == decisionProviderSlugs.cloudflare) {
    return {
      url: cloudflareUrl(stringValue(d.config, 'accountId'), d.model.vendorModelId),
      headers: { authorization: `Bearer ${stringValue(d.credentials, 'apiToken')}` }
    };
  }

  if (d.model.providerSlug == decisionProviderSlugs.typesafe) {
    return {
      url: typesafeUrl,
      headers: { authorization: `Bearer ${stringValue(d.credentials, 'apiKey')}` }
    };
  }

  throw new DecisionError('unavailable', `No decision backend serves ${d.model.name}.`);
};

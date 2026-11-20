import type { ValidationType } from '@lowerdeck/validation';
import type {
  ConnectionCheckResult,
  ProviderConnectionConfig,
  ProviderCredentials,
  ProviderFeature
} from '@mtsrc/ai-gateway-spec';

export type ProviderCheckContext<Credentials, Config> = {
  credentials: Credentials;
  config: Config;
  signal: AbortSignal;
  fetch: typeof fetch;
};

export type ProviderKind = 'inference' | 'decision';

export type ProviderDefinition<
  Credentials extends ProviderCredentials = ProviderCredentials,
  Config extends ProviderConnectionConfig = ProviderConnectionConfig
> = {
  slug: string;
  name: string;
  kind?: ProviderKind;
  website?: string;
  docs?: string;

  credentials: ValidationType<Credentials>;
  config: ValidationType<Config>;
  features: ProviderFeature[];

  credentialHint: (credentials: Credentials) => string;
  check: (d: ProviderCheckContext<Credentials, Config>) => Promise<ConnectionCheckResult>;
};

export let defineProvider = <
  Credentials extends ProviderCredentials,
  Config extends ProviderConnectionConfig
>(
  definition: ProviderDefinition<Credentials, Config>
) => definition as unknown as ProviderDefinition;

export let lastFourHint = (secret: string) =>
  secret.length > 8 ? `…${secret.slice(-4)}` : '…';

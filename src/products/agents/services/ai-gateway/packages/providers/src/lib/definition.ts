import type { LanguageModelV4, SharedV4ProviderOptions } from '@ai-sdk/provider';
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

export type ProviderModelContext<Credentials, Config> = {
  credentials: Credentials;
  config: Config;
  modelId: string;
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

  languageModel?: (d: ProviderModelContext<Credentials, Config>) => LanguageModelV4;

  // Exact input token counts for a request in Anthropic Messages shape. Providers without a
  // counting endpoint are estimated by the gateway instead.
  countTokens?: (
    d: ProviderModelContext<Credentials, Config> & {
      body: Record<string, unknown>;
      signal?: AbortSignal;
    }
  ) => Promise<number>;

  // The AI SDK provider reads its options from this namespace; request translation writes
  // vendor options under the namespaces in `inheritsProviderOptions` (Azure runs OpenAI's
  // models but reads `azure`), which are copied over before the call.
  providerOptionsKey?: string;
  inheritsProviderOptions?: string[];

  // Applied on top of whatever the request asked for, so gateway-wide behaviour (never storing
  // generations upstream) cannot be switched back on by a caller.
  enforcedProviderOptions?: SharedV4ProviderOptions;
};

export let defineProvider = <
  Credentials extends ProviderCredentials,
  Config extends ProviderConnectionConfig
>(
  definition: ProviderDefinition<Credentials, Config>
) => definition as unknown as ProviderDefinition;

export let lastFourHint = (secret: string) =>
  secret.length > 8 ? `…${secret.slice(-4)}` : '…';

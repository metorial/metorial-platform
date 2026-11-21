import { parseProviderFeatures, parseProviderInput } from '@mtsrc/ai-gateway-providers';
import type {
  ProviderConnectionConfig,
  ProviderCredentials,
  ProviderFeatures
} from '@mtsrc/ai-gateway-spec';

let slugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;

type EnvValues = Record<string, string | undefined>;

export type PlatformConnectionDefinition = {
  slug: string;
  providerSlug: string;
  name: string;
  priority: number;
  credentials: EnvValues;
  config: EnvValues;
  features: ProviderFeatures;
};

export type ResolvedPlatformConnection =
  | {
      configured: true;
      credentials: ProviderCredentials;
      config: ProviderConnectionConfig;
      credentialHint: string;
    }
  | { configured: false; reason: string };

export let platformConnection = (d: {
  slug: string;
  provider: string;
  name: string;
  priority?: number;
  credentials: EnvValues;
  config?: EnvValues;
  features?: ProviderFeatures;
}): PlatformConnectionDefinition => {
  if (!slugPattern.test(d.slug)) {
    throw new Error(`Platform connection slug "${d.slug}" must be lowercase kebab-case.`);
  }

  let features = parseProviderFeatures({ providerSlug: d.provider, features: d.features });

  return {
    slug: d.slug,
    providerSlug: d.provider,
    name: d.name,
    priority: d.priority ?? 0,
    credentials: d.credentials,
    config: d.config ?? {},
    features
  };
};

let missingKeys = (values: EnvValues) =>
  Object.entries(values)
    .filter(([, value]) => !value)
    .map(([key]) => key);

export let resolvePlatformConnection = (
  definition: PlatformConnectionDefinition
): ResolvedPlatformConnection => {
  let missing = [...missingKeys(definition.credentials), ...missingKeys(definition.config)];
  if (missing.length) {
    return { configured: false, reason: `Not configured: missing ${missing.join(', ')}.` };
  }

  try {
    let parsed = parseProviderInput({
      providerSlug: definition.providerSlug,
      credentials: definition.credentials,
      config: definition.config
    });

    return {
      configured: true,
      credentials: parsed.credentials!,
      config: parsed.config,
      credentialHint: parsed.definition.credentialHint(parsed.credentials!)
    };
  } catch (error) {
    return {
      configured: false,
      reason: error instanceof Error ? error.message : 'Invalid platform connection settings.'
    };
  }
};

export let validatePlatformConnections = (definitions: PlatformConnectionDefinition[]) => {
  let seen = new Set<string>();

  for (let definition of definitions) {
    if (seen.has(definition.slug)) {
      throw new Error(`Platform connection "${definition.slug}" is defined twice.`);
    }
    seen.add(definition.slug);
  }
};

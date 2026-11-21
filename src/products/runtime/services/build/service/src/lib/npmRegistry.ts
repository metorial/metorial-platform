export let npmRegistryEnv = (registryUrl: string | undefined): Record<string, string> =>
  registryUrl ? { NPM_CONFIG_REGISTRY: registryUrl, YARN_REGISTRY: registryUrl } : {};

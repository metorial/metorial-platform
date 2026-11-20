export let providerFeatures = {
  zdr: {
    name: 'Zero data retention',
    description:
      'The provider account behind this connection does not retain prompts or completions. Requests that require zero data retention only route to connections with it enabled.'
  }
} as const;

export type ProviderFeature = keyof typeof providerFeatures;

export let providerFeatureSlugs = Object.keys(providerFeatures) as ProviderFeature[];

export type ProviderFeatures = Partial<Record<ProviderFeature, boolean>>;

export let hasFeatures = (features: ProviderFeatures, required: ProviderFeature[]) =>
  required.every(feature => features[feature] === true);

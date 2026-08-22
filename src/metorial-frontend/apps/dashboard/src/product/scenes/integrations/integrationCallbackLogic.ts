export let buildIntegrationProviderCallbackInput = (p: {
  selectedTriggerIds: readonly string[];
  eventTypesByTrigger: Readonly<Record<string, readonly string[]>>;
  destinationIds: readonly string[];
  configValues: Readonly<Record<string, string>>;
}) => {
  if (!p.selectedTriggerIds.length) {
    throw new Error('At least one callback trigger is required');
  }

  let configValues = Object.fromEntries(
    Object.entries(p.configValues).filter(([, value]) => value.length > 0)
  );

  return {
    triggers: p.selectedTriggerIds.map(triggerId => ({
      triggerId,
      eventTypes: [...(p.eventTypesByTrigger[triggerId] ?? [])]
    })),
    destinationIds: [...p.destinationIds],
    ...(Object.keys(configValues).length ? { configValues } : {})
  };
};

export let getCallbackConfigMissingKeys = (error: unknown) => {
  let candidate = error as any;
  let code = candidate?.code ?? candidate?.data?.code ?? candidate?.response?.code;
  if (code !== 'callback_config_incomplete') return null;

  let missingKeys =
    candidate?.data?.metadata?.missingKeys ??
    candidate?.response?.metadata?.missingKeys ??
    candidate?.metadata?.missingKeys;
  return Array.isArray(missingKeys)
    ? missingKeys.filter((key): key is string => typeof key === 'string')
    : [];
};

export let getMissingRequiredCallbackConfigKeys = (p: {
  requiredKeys: readonly string[];
  configuredKeys: readonly string[];
  configValues: Readonly<Record<string, string>>;
}) => {
  let configuredKeys = new Set(p.configuredKeys);
  return p.requiredKeys.filter(
    key => !configuredKeys.has(key) && !p.configValues[key]?.length
  );
};

export let isCallbacksTabVisible = (flags: Record<string, unknown>) =>
  flags['callbacks-enabled'] === true;

export let isCallbackConfigSchemaRequestPending = (
  selectedTriggerIds: readonly string[],
  isLoading: boolean
) => selectedTriggerIds.length > 0 && isLoading;

export type ProviderAdapterCapabilityValue = { id: string; value: any };

export let canonicalizeAdapterCapabilities = (
  capabilities: ProviderAdapterCapabilityValue[]
) =>
  [...new Map(capabilities.map(capability => [capability.id, capability])).values()].sort(
    (a, b) => a.id.localeCompare(b.id)
  );

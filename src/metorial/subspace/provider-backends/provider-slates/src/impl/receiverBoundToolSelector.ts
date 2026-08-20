let RECEIVER_SELECTOR_FORBIDDEN_INPUT_KEYS = new Set([
  'receiver',
  'receiver_id',
  'receiver_trigger_id',
  'receiver_callback_selector',
  'receiver_url',
  'receiver_secret',
  'callback_url',
  'callback_secret',
  'webhook_url',
  'webhook_secret',
  'registration_generation',
  'secret',
  'secret_version',
  'url'
]);

let normalizeReceiverSelectorInputKey = (key: string) =>
  key
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase();

let hasForbiddenReceiverSelectorInput = (value: unknown): boolean => {
  if (Array.isArray(value)) return value.some(hasForbiddenReceiverSelectorInput);
  if (typeof value !== 'object' || value === null) return false;
  return Object.entries(value as Record<string, unknown>).some(
    ([key, nested]) =>
      RECEIVER_SELECTOR_FORBIDDEN_INPUT_KEYS.has(normalizeReceiverSelectorInputKey(key)) ||
      hasForbiddenReceiverSelectorInput(nested)
  );
};

export let resolveReceiverBoundToolSelectorFromAuthority = async (d: {
  tenantOid: bigint;
  providerConfigVersionOid: bigint;
  providerAuthConfigVersionOid: bigint | null;
  input: unknown;
  findMany: (
    query: Record<string, unknown>
  ) => Promise<{ slateTriggerReceiverId: string | null }[]>;
}) => {
  if (hasForbiddenReceiverSelectorInput(d.input)) {
    throw new Error('Receiver callback fields are not permitted in public tool input');
  }
  let matches = await d.findMany({
    where: {
      isParentDeleted: false,
      status: 'attached',
      registrationStatus: 'registered',
      slateTriggerReceiverId: { not: null },
      callback: {
        tenantOid: d.tenantOid,
        status: 'active',
        callbackProviderTriggers: {
          some: { providerTrigger: { key: 'agent_status_change' } }
        }
      },
      providerDeploymentConfigPair: {
        tenantOid: d.tenantOid,
        providerConfigVersionOid: d.providerConfigVersionOid,
        providerAuthConfigVersionOid: d.providerAuthConfigVersionOid
      }
    },
    select: { slateTriggerReceiverId: true },
    take: 2
  });
  if (matches.length !== 1 || !matches[0]!.slateTriggerReceiverId) {
    throw new Error('Exactly one eligible attached callback receiver is required');
  }
  return matches[0]!.slateTriggerReceiverId;
};

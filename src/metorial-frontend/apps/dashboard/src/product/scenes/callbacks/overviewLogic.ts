export type CallbackTriggerSelection = {
  providerTrigger: { key: string };
  eventTypes: string[];
};

export type CallbackInstanceCombinationInput = {
  status: 'attached' | 'detached';
  config: { id: string };
  authConfig: { id: string } | null;
};

export type UnavailableProviderCombination = {
  providerConfigId: string;
  providerAuthConfigId: string | null;
};

export let buildUnavailableCallbackInstanceCombinations = (
  instances: readonly CallbackInstanceCombinationInput[]
): UnavailableProviderCombination[] =>
  instances
    .filter(instance => instance.status === 'attached')
    .map(instance => ({
      providerConfigId: instance.config.id,
      providerAuthConfigId: instance.authConfig?.id ?? null
    }));

type CallbackReconciliationInstance = {
  id: string;
  status: 'attached' | 'detached';
  triggers: readonly {
    source: 'webhook' | 'polling';
    registrationStatus: string;
    nextPollAt: Date | null;
  }[];
};

let transitionalRegistrationStatuses = ['pending', 'registering', 'renewing', 'unregistering'];

export let hasPendingCallbackReconciliation = (input: {
  instances: readonly CallbackReconciliationInstance[];
  expectedTriggerCount: number;
  callbackInstanceId?: string;
}) => {
  let candidates = input.callbackInstanceId
    ? input.instances.filter(instance => instance.id === input.callbackInstanceId)
    : input.instances.filter(instance => instance.status === 'attached');

  if (input.callbackInstanceId && candidates.length === 0) return true;

  return candidates.some(
    instance =>
      instance.status !== 'attached' ||
      instance.triggers.length !== input.expectedTriggerCount ||
      instance.triggers.some(
        trigger =>
          transitionalRegistrationStatuses.includes(trigger.registrationStatus) ||
          (trigger.source === 'polling' && !trigger.nextPollAt)
      )
  );
};

export let normalizeCallbackEventTypes = (eventTypes: readonly string[]) => [
  ...new Set(eventTypes.map(eventType => eventType.trim()).filter(Boolean))
];

export let buildCallbackTriggerUpdateInput = (
  selectedTriggerKeys: readonly string[],
  existingTriggers: readonly CallbackTriggerSelection[],
  eventTypeEdits: Readonly<Record<string, readonly string[]>> = {}
) => {
  let existingByKey = new Map(
    existingTriggers.map(trigger => [trigger.providerTrigger.key, trigger.eventTypes] as const)
  );

  return selectedTriggerKeys.map(triggerId => ({
    triggerId,
    eventTypes: normalizeCallbackEventTypes(
      eventTypeEdits[triggerId] ?? existingByKey.get(triggerId) ?? []
    )
  }));
};

export let shouldShowManualWebhookSetup = (
  triggers: readonly { webhookUrl: string | null; registrationStatus: string }[]
) =>
  triggers.some(trigger => trigger.webhookUrl && trigger.registrationStatus !== 'registered');

export let canonicalizeCallbackTriggerInput = (
  triggers: readonly { triggerId: string; eventTypes: readonly string[] }[]
) =>
  JSON.stringify(
    triggers
      .map(trigger => ({
        triggerId: trigger.triggerId,
        eventTypes: [...normalizeCallbackEventTypes(trigger.eventTypes)].sort()
      }))
      .sort((first, second) => first.triggerId.localeCompare(second.triggerId))
  );

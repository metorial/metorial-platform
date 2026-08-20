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

export type CallbackProvisionedAppSetupInput = {
  vendor: string;
  credentialOwnerType: 'managed' | 'byo';
  status: string;
  githubManifestStateExpiresAt: Date | null;
  githubManifestCompletedAt: Date | null;
  githubInstallationCompletedAt: Date | null;
};

export let buildCallbackProvisionedAppSetup = (input: CallbackProvisionedAppSetupInput) => {
  let vendor = input.vendor.trim().toLowerCase();
  if (vendor === 'github') {
    if (input.credentialOwnerType === 'managed') {
      return {
        instructions:
          'GitHub delivery uses the managed app. Install or approve the app for the target organization and repository.',
        manifestActionAvailable: false,
        manifestActionLabel: null
      };
    }
    if (input.githubInstallationCompletedAt) {
      return {
        instructions:
          'GitHub app installation is complete. Keep the app installed for the selected repositories.',
        manifestActionAvailable: false,
        manifestActionLabel: null
      };
    }
    if (input.githubManifestCompletedAt) {
      return {
        instructions:
          'The GitHub app manifest is complete. Continue by installing the app for the target organization and repositories.',
        manifestActionAvailable: false,
        manifestActionLabel: null
      };
    }
    return {
      instructions: input.githubManifestStateExpiresAt
        ? `GitHub manifest setup is pending until ${input.githubManifestStateExpiresAt.toISOString()}. Continue to replace the expiring setup link.`
        : 'Create a GitHub app from an authorized manifest, then return to complete installation.',
      manifestActionAvailable: ['pending', 'manifest_pending'].includes(input.status),
      manifestActionLabel:
        input.status === 'manifest_pending' ? 'Continue GitHub setup' : 'Start GitHub setup'
    };
  }
  if (vendor === 'slack') {
    return {
      instructions:
        'In Slack, enable Event Subscriptions, use the secured callback URL as the Request URL, and subscribe only to the listed events.',
      manifestActionAvailable: false,
      manifestActionLabel: null
    };
  }
  if (vendor === 'discord') {
    return {
      instructions:
        'In Discord, configure the secured callback URL for the interaction or webhook endpoint and preserve signature verification.',
      manifestActionAvailable: false,
      manifestActionLabel: null
    };
  }
  return {
    instructions:
      'Configure the secured callback URL in the provider and preserve the displayed verification mechanism.',
    manifestActionAvailable: false,
    manifestActionLabel: null
  };
};

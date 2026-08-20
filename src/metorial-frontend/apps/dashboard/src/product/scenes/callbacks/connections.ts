export type CallbackConnectionIntegrationInstance = {
  id: string;
  name: string;
  integrationId: string;
  providers: readonly {
    id: string;
    status: string;
    provider: { id: string };
    integrationProvider: { deploymentId: string; name: string };
    config: { id: string; name: string | null; updatedAt: Date } | null;
    authConfig: { id: string } | null;
  }[];
};

export type CallbackConnectionOption = {
  id: string;
  integrationId: string;
  integrationName: string | null;
  integrationInstanceId: string;
  integrationInstanceName: string;
  connectionName: string | null;
  deploymentId: string;
  configId: string;
  authConfigId: string | null;
  configUpdatedAt: number;
};

export let buildCallbackConnectionOptions = (input: {
  providerId: string;
  integrationInstances: readonly CallbackConnectionIntegrationInstance[];
  integrations: readonly { id: string; name: string }[];
}): CallbackConnectionOption[] => {
  let integrationNameById = new Map(
    input.integrations.map(integration => [integration.id, integration.name])
  );
  let options: CallbackConnectionOption[] = [];

  for (let integrationInstance of input.integrationInstances) {
    for (let instanceProvider of integrationInstance.providers) {
      if (instanceProvider.status !== 'active') continue;
      if (instanceProvider.provider.id !== input.providerId) continue;
      if (!instanceProvider.config) continue;

      options.push({
        id: instanceProvider.id,
        integrationId: integrationInstance.integrationId,
        integrationName:
          integrationNameById.get(integrationInstance.integrationId) ?? null,
        integrationInstanceId: integrationInstance.id,
        integrationInstanceName: integrationInstance.name,
        connectionName:
          instanceProvider.config.name?.trim() ||
          instanceProvider.integrationProvider.name ||
          null,
        deploymentId: instanceProvider.integrationProvider.deploymentId,
        configId: instanceProvider.config.id,
        authConfigId: instanceProvider.authConfig?.id ?? null,
        configUpdatedAt: instanceProvider.config.updatedAt.getTime()
      });
    }
  }

  return options.sort((a, b) => b.configUpdatedAt - a.configUpdatedAt);
};

export type CallbackConnectionDisplayItem = CallbackConnectionOption & {
  pathLabel: string;
  connectionLabel: string;
};

export let buildCallbackConnectionDisplayItems = (
  options: readonly CallbackConnectionOption[]
): CallbackConnectionDisplayItem[] => {
  let duplicateKey = (option: CallbackConnectionOption) =>
    `${option.integrationInstanceId}:${option.connectionName ?? ''}`;

  let counts = new Map<string, number>();
  for (let option of options) {
    counts.set(duplicateKey(option), (counts.get(duplicateKey(option)) ?? 0) + 1);
  }

  return options.map(option => {
    let baseLabel = option.connectionName ?? 'Default connection';
    let isAmbiguous = (counts.get(duplicateKey(option)) ?? 0) > 1;

    return {
      ...option,
      pathLabel: option.integrationName
        ? `${option.integrationName} › ${option.integrationInstanceName}`
        : option.integrationInstanceName,
      connectionLabel: isAmbiguous ? `${baseLabel} · ${option.id.slice(-6)}` : baseLabel
    };
  });
};

export let buildCallbackConnectionUsageByConfigId = (input: {
  deploymentId: string;
  integrationInstances: readonly CallbackConnectionIntegrationInstance[];
  integrations: readonly { id: string; name: string }[];
}): Map<string, string[]> => {
  let integrationNameById = new Map(
    input.integrations.map(integration => [integration.id, integration.name])
  );
  let usage = new Map<string, string[]>();

  for (let integrationInstance of input.integrationInstances) {
    for (let instanceProvider of integrationInstance.providers) {
      if (instanceProvider.status !== 'active') continue;
      if (!instanceProvider.config) continue;
      if (instanceProvider.integrationProvider.deploymentId !== input.deploymentId) continue;

      let integrationName = integrationNameById.get(integrationInstance.integrationId);
      let label = integrationName
        ? `${integrationName} › ${integrationInstance.name}`
        : integrationInstance.name;

      let labels = usage.get(instanceProvider.config.id) ?? [];
      if (!labels.includes(label)) labels.push(label);
      usage.set(instanceProvider.config.id, labels);
    }
  }

  return usage;
};

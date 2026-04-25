import {
  DashboardInstanceProviderDeploymentsConfigsListOutput,
  DashboardInstanceProviderDeploymentsConfigVaultsListOutput
} from '@metorial/dashboard-sdk';
import {
  useProviderConfig,
  useProviderConfigs,
  useProviderConfigSchemaTarget,
  useProviderConfigVault,
  useProviderConfigVaults
} from '@metorial/state';
import { Button, Callout, Combobox, Flex, Text, Tooltip } from '@metorial/ui';
import { RiAddLine, RiSafeLine } from '@remixicon/react';
import { useEffect, useRef, useState } from 'react';
import {
  ConfigurationSelection,
  decodeConfigurationSelection,
  encodeConfigurationSelection
} from '../../lib/configSelection';
import { getProviderConfigSchemaCapabilities } from '../../lib/providerCreationCapabilities';
import { showProviderConfigVaultFormModal } from '../providerConfigVaults/modal';
import { showProviderConfigFormModal } from './modal';

type ConfigItem = DashboardInstanceProviderDeploymentsConfigsListOutput['items'][number];
type VaultItem = DashboardInstanceProviderDeploymentsConfigVaultsListOutput['items'][number];
type CreatedSelectionState = {
  kind: 'config' | 'vault';
  id: string;
  label: string;
};

export let ProviderConfigurationSelection = ({
  instanceId,
  providerDeploymentId,
  providerId,
  value,
  onChange,
  label = 'Config',
  includeVaults = true,
  createConfigButtonLabel,
  showExistingOptions = true,
  disabled = false
}: {
  instanceId: string;
  providerDeploymentId?: string;
  providerId?: string;
  value: ConfigurationSelection;
  onChange: (value: ConfigurationSelection) => void;
  label?: string;
  includeVaults?: boolean;
  createConfigButtonLabel?: string;
  showExistingOptions?: boolean;
  disabled?: boolean;
}) => {
  let query = providerDeploymentId
    ? { providerDeploymentId }
    : providerId
      ? { providerId }
      : {};
  let configs = useProviderConfigs(instanceId, query);
  let vaults = useProviderConfigVaults(instanceId, query);
  let configSchema = useProviderConfigSchemaTarget(
    instanceId,
    providerDeploymentId ? { providerDeploymentId } : providerId ? { providerId } : null
  );
  let configCreation = getProviderConfigSchemaCapabilities({
    schemaValue: configSchema.data?.schema,
    hasVaults: (vaults.data?.items?.length ?? 0) > 0,
    isLoading: configSchema.isLoading || vaults.isLoading
  });
  let defaultConfig = (configs.data?.items ?? []).find(config => config.isDefault);
  let selectedConfig = useProviderConfig(
    instanceId,
    value.kind === 'config' ? value.id : defaultConfig?.id
  );
  let selectedVault = useProviderConfigVault(
    instanceId,
    value.kind === 'vault' ? value.id : null
  );
  let scopeKey = providerDeploymentId ?? providerId ?? '__none__';
  let handledAutoSelectionRef = useRef<string | null>(null);
  let [createdSelection, setCreatedSelection] = useState<CreatedSelectionState | null>(null);

  useEffect(() => {
    handledAutoSelectionRef.current = null;
  }, [scopeKey]);

  useEffect(() => {
    if (value.kind !== 'none') {
      handledAutoSelectionRef.current = scopeKey;
      return;
    }

    if (configs.isLoading || handledAutoSelectionRef.current === scopeKey) return;

    let defaultConfig = (configs.data?.items ?? []).find(config => config.isDefault);
    if (!defaultConfig) return;

    handledAutoSelectionRef.current = scopeKey;
    onChange({ kind: 'config', id: defaultConfig.id });
  }, [configs.data?.items, configs.isLoading, onChange, scopeKey, value.kind]);

  let effectiveValue: ConfigurationSelection =
    value.kind === 'none' && defaultConfig ? { kind: 'config', id: defaultConfig.id } : value;
  let effectiveSelectionId = effectiveValue.kind === 'none' ? null : effectiveValue.id;

  useEffect(() => {
    if (!createdSelection) return;
    if (
      effectiveValue.kind !== createdSelection.kind ||
      effectiveSelectionId !== createdSelection.id
    ) {
      setCreatedSelection(null);
    }
  }, [createdSelection, effectiveSelectionId, effectiveValue.kind]);

  let valueLabel =
    createdSelection?.label ??
    (effectiveValue.kind === 'config'
      ? (selectedConfig.data?.name ?? defaultConfig?.name ?? defaultConfig?.id)
      : effectiveValue.kind === 'vault'
        ? (selectedVault.data?.name ?? selectedVault.data?.id)
        : undefined);

  return (
    <Flex direction="column" gap={8}>
      {createdSelection ? (
        <Callout color="gray">
          <Flex justify="space-between" align="center" gap={12} wrap="wrap">
            <Text size="2">
              New {createdSelection.kind === 'vault' ? 'config vault' : 'config'} selected:{' '}
              <strong>{createdSelection.label}</strong>
            </Text>
            <Button
              type="button"
              size="2"
              variant="outline"
              onClick={() => setCreatedSelection(null)}
            >
              Choose another
            </Button>
          </Flex>
        </Callout>
      ) : (
        <Flex gap={8} align="end">
          {showExistingOptions ? (
            <div style={{ flex: 1 }}>
              <Combobox
                label={label}
                placeholder="Search configs and vaults"
                value={encodeConfigurationSelection(effectiveValue)}
                valueLabel={valueLabel}
                disabled={disabled}
                provider={({ searchQuery }) => {
                  let hasSearchQuery = Boolean(searchQuery);
                  let comboboxConfigs = useProviderConfigs(instanceId, {
                    ...query,
                    limit: 25,
                    search: searchQuery || undefined
                  });
                  let comboboxVaults = useProviderConfigVaults(
                    includeVaults ? instanceId : null,
                    includeVaults
                      ? {
                          ...query,
                          limit: 25,
                          search: searchQuery || undefined
                        }
                      : undefined
                  );

                  let items = [
                    ...(!defaultConfig && !hasSearchQuery
                      ? [{ id: '__none__', label: 'None' }]
                      : []),
                    ...(comboboxConfigs.data?.items ?? []).map((config: ConfigItem) => ({
                      id: `config:${config.id}`,
                      label: config.name ?? config.id
                    })),
                    ...(includeVaults
                      ? (comboboxVaults.data?.items ?? []).map((vault: VaultItem) => ({
                          id: `vault:${vault.id}`,
                          label: `${vault.name ?? vault.id} (Vault)`
                        }))
                      : [])
                  ];

                  return {
                    items,
                    isLoading: comboboxConfigs.isLoading || comboboxVaults.isLoading,
                    empty: searchQuery
                      ? 'No matching configs or vaults found.'
                      : 'No configs or vaults available.'
                  };
                }}
                onChange={next => onChange(decodeConfigurationSelection(next ?? '__none__'))}
              />
            </div>
          ) : null}

          <Tooltip
            content={configCreation.configDisabledReason ?? ''}
            enabled={!configCreation.canCreateConfig}
            delayDuration={0}
          >
            <div style={{ display: 'inline-flex' }}>
              <Button
                type="button"
                size="3"
                iconLeft={<RiAddLine />}
                disabled={disabled || !configCreation.canCreateConfig}
                onClick={() =>
                  showProviderConfigFormModal({
                    type: 'create',
                    instanceId,
                    ...(providerDeploymentId ? { providerDeploymentId } : {}),
                    ...(providerId ? { providerId } : {}),
                    onCreate: async config => {
                      let label = config.name ?? config.id;
                      onChange({ kind: 'config', id: config.id });
                      setCreatedSelection({ kind: 'config', id: config.id, label });
                      await Promise.resolve(configs.refetch?.());
                      onChange({ kind: 'config', id: config.id });
                    }
                  })
                }
              >
                {createConfigButtonLabel}
              </Button>
            </div>
          </Tooltip>

          {includeVaults && (
            <Tooltip
              content={configCreation.configVaultDisabledReason ?? ''}
              enabled={!configCreation.canCreateConfigVault}
              delayDuration={0}
            >
              <div style={{ display: 'inline-flex' }}>
                <Button
                  type="button"
                  size="3"
                  iconLeft={<RiSafeLine />}
                  disabled={disabled || !configCreation.canCreateConfigVault}
                  onClick={() =>
                    showProviderConfigVaultFormModal({
                      type: 'create',
                      instanceId,
                      ...(providerDeploymentId ? { providerDeploymentId } : {}),
                      ...(providerId ? { providerId } : {}),
                      onCreate: async vault => {
                        let label = vault.name ?? vault.id;
                        onChange({ kind: 'vault', id: vault.id });
                        setCreatedSelection({ kind: 'vault', id: vault.id, label });
                        await Promise.resolve(vaults.refetch?.());
                        onChange({ kind: 'vault', id: vault.id });
                      }
                    })
                  }
                />
              </div>
            </Tooltip>
          )}
        </Flex>
      )}

      {(configs.error || vaults.error) && (
        <Text size="2" color="red500">
          {configs.error?.message ??
            vaults.error?.message ??
            'Failed to load configs and config vaults.'}
        </Text>
      )}
    </Flex>
  );
};

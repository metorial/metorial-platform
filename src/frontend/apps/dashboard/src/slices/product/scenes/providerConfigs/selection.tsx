import {
  DashboardInstanceProviderDeploymentsConfigsListOutput,
  DashboardInstanceProviderDeploymentsConfigVaultsListOutput
} from '@metorial/dashboard-sdk';
import {
  useProviderConfigs,
  useProviderConfigSchemaTarget,
  useProviderConfigVaults
} from '@metorial/state';
import { Button, Flex, Select, Text, Tooltip } from '@metorial/ui';
import { RiAddLine, RiSafeLine } from '@remixicon/react';
import { useEffect, useRef } from 'react';
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

export let ProviderConfigurationSelection = ({
  instanceId,
  providerDeploymentId,
  providerId,
  value,
  onChange,
  label = 'Config',
  includeVaults = true,
  createConfigButtonLabel
}: {
  instanceId: string;
  providerDeploymentId?: string;
  providerId?: string;
  value: ConfigurationSelection;
  onChange: (value: ConfigurationSelection) => void;
  label?: string;
  includeVaults?: boolean;
  createConfigButtonLabel?: string;
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
  let scopeKey = providerDeploymentId ?? providerId ?? '__none__';
  let handledAutoSelectionRef = useRef<string | null>(null);

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

  let defaultConfig = (configs.data?.items ?? []).find(config => config.isDefault);
  let effectiveValue: ConfigurationSelection =
    value.kind === 'none' && defaultConfig ? { kind: 'config', id: defaultConfig.id } : value;
  let items = [
    ...(!defaultConfig ? [{ id: '__none__', label: 'None' }] : []),
    ...(configs.data?.items ?? []).map((config: ConfigItem) => ({
      id: `config:${config.id}`,
      label: config.name ?? config.id
    })),
    ...(includeVaults
      ? (vaults.data?.items ?? []).map((vault: VaultItem) => ({
          id: `vault:${vault.id}`,
          label: `${vault.name ?? vault.id} (Vault)`
        }))
      : [])
  ];

  return (
    <Flex direction="column" gap={8}>
      <Flex gap={8} align="end">
        <div style={{ flex: 1 }}>
          <Select
            label={label}
            value={encodeConfigurationSelection(effectiveValue)}
            onChange={next => onChange(decodeConfigurationSelection(next))}
            items={items}
          />
        </div>

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
              disabled={!configCreation.canCreateConfig}
              onClick={() =>
                showProviderConfigFormModal({
                  type: 'create',
                  instanceId,
                  ...(providerDeploymentId ? { providerDeploymentId } : {}),
                  ...(providerId ? { providerId } : {}),
                  onCreate: async config => {
                    onChange({ kind: 'config', id: config.id });
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
                disabled={!configCreation.canCreateConfigVault}
                onClick={() =>
                  showProviderConfigVaultFormModal({
                    type: 'create',
                    instanceId,
                    ...(providerDeploymentId ? { providerDeploymentId } : {}),
                    ...(providerId ? { providerId } : {}),
                    onCreate: async vault => {
                      onChange({ kind: 'vault', id: vault.id });
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

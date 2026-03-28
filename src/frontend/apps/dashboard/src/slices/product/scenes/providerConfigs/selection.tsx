import {
  DashboardInstanceProviderDeploymentsConfigsListOutput,
  DashboardInstanceProviderDeploymentsConfigVaultsListOutput
} from '@metorial/dashboard-sdk';
import { useProviderConfigs, useProviderConfigVaults } from '@metorial/state';
import { Button, Flex, Select, Text, Tooltip } from '@metorial/ui';
import { RiAddLine, RiSafeLine } from '@remixicon/react';
import { useEffect, useRef } from 'react';
import {
  ConfigurationSelection,
  decodeConfigurationSelection,
  encodeConfigurationSelection
} from '../../lib/configSelection';
import { useProviderConfigCreationCapabilities } from '../../lib/providerCreationCapabilities';
import { showProviderConfigVaultFormModal } from '../providerConfigVaults/modal';
import { showProviderConfigFormModal } from './modal';

type ConfigItem = DashboardInstanceProviderDeploymentsConfigsListOutput['items'][number];
type VaultItem = DashboardInstanceProviderDeploymentsConfigVaultsListOutput['items'][number];

export let ProviderConfigurationSelection = ({
  instanceId,
  providerDeploymentId,
  value,
  onChange,
  label = 'Config',
  includeVaults = true
}: {
  instanceId: string;
  providerDeploymentId: string;
  value: ConfigurationSelection;
  onChange: (value: ConfigurationSelection) => void;
  label?: string;
  includeVaults?: boolean;
}) => {
  let configs = useProviderConfigs(instanceId, { providerDeploymentId });
  let vaults = useProviderConfigVaults(instanceId, { providerDeploymentId });
  let configCreation = useProviderConfigCreationCapabilities(instanceId, providerDeploymentId);
  let handledAutoSelectionRef = useRef<string | null>(null);

  useEffect(() => {
    handledAutoSelectionRef.current = null;
  }, [providerDeploymentId]);

  useEffect(() => {
    if (value.kind !== 'none') {
      handledAutoSelectionRef.current = providerDeploymentId;
      return;
    }

    if (configs.isLoading || handledAutoSelectionRef.current === providerDeploymentId) return;

    let defaultConfig = (configs.data?.items ?? []).find(config => config.isDefault);
    if (!defaultConfig) return;

    handledAutoSelectionRef.current = providerDeploymentId;
    onChange({ kind: 'config', id: defaultConfig.id });
  }, [configs.data?.items, configs.isLoading, onChange, providerDeploymentId, value.kind]);

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
                  providerDeploymentId,
                  onCreate: config => {
                    configs.refetch?.();
                    onChange({ kind: 'config', id: config.id });
                  }
                })
              }
            />
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
                    providerDeploymentId,
                    onCreate: vault => {
                      vaults.refetch?.();
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

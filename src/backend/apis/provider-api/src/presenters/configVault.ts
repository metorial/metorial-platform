import { deploymentPreviewPresenter } from './deployment';

export type ConfigVaultDeploymentData = {
  id: string;
  isEphemeral: boolean;
  isDefault: boolean;
  name: string | null;
  description: string | null;
  metadata: unknown;
  providerId: string;
  createdAt: Date;
  updatedAt: Date;
};

export type ConfigVaultData = {
  id: string;
  name: string | null;
  description: string | null;
  metadata: unknown;
  providerId: string;
  deployment: ConfigVaultDeploymentData | null;
  createdAt: Date;
  updatedAt: Date;
};

export let configVaultPresenter = (vault: ConfigVaultData) => ({
  object: 'provider.config_vault' as const,
  id: vault.id,
  name: vault.name,
  description: vault.description,
  metadata: vault.metadata,
  providerId: vault.providerId,
  deployment: vault.deployment ? deploymentPreviewPresenter(vault.deployment) : null,
  createdAt: vault.createdAt,
  updatedAt: vault.updatedAt
});

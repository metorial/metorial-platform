import { deploymentPreviewPresenter } from './deployment';
import { configVaultPresenter, ConfigVaultData } from './configVault';

export type ConfigDeploymentData = {
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

export type ConfigData = {
  id: string;
  isEphemeral: boolean;
  isDefault: boolean;
  name: string | null;
  description: string | null;
  metadata: unknown;
  providerId: string;
  deployment: ConfigDeploymentData | null;
  fromVault: ConfigVaultData | null;
  providerSpecificationId: string;
  createdAt: Date;
  updatedAt: Date;
};

export let configPresenter = (config: ConfigData) => ({
  object: 'provider.config' as const,
  id: config.id,
  isEphemeral: config.isEphemeral,
  isDefault: config.isDefault,
  name: config.name,
  description: config.description,
  metadata: config.metadata,
  providerId: config.providerId,
  deployment: config.deployment ? deploymentPreviewPresenter(config.deployment) : null,
  fromVault: config.fromVault ? configVaultPresenter(config.fromVault) : null,
  providerSpecificationId: config.providerSpecificationId,
  createdAt: config.createdAt,
  updatedAt: config.updatedAt
});

export let configPreviewPresenter = (config: {
  id: string;
  isEphemeral: boolean;
  isDefault: boolean;
  name: string | null;
  description: string | null;
  metadata: unknown;
  providerId: string;
  createdAt: Date;
  updatedAt: Date;
}) => ({
  object: 'provider.config#preview' as const,
  id: config.id,
  isEphemeral: config.isEphemeral,
  isDefault: config.isDefault,
  name: config.name,
  description: config.description,
  metadata: config.metadata,
  providerId: config.providerId,
  createdAt: config.createdAt,
  updatedAt: config.updatedAt
});

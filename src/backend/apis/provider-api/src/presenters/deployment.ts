import { versionPresenter, VersionData } from './version';
import { configPreviewPresenter } from './config';

export type DeploymentConfigPreviewData = {
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

export type DeploymentData = {
  id: string;
  isEphemeral: boolean;
  isDefault: boolean;
  name: string | null;
  description: string | null;
  metadata: unknown;
  providerId: string;
  lockedVersion: VersionData | null;
  defaultConfig: DeploymentConfigPreviewData | null;
  createdAt: Date;
  updatedAt: Date;
};

export let deploymentPresenter = (deployment: DeploymentData) => ({
  object: 'provider.deployment' as const,
  id: deployment.id,
  isEphemeral: deployment.isEphemeral,
  isDefault: deployment.isDefault,
  name: deployment.name,
  description: deployment.description,
  metadata: deployment.metadata,
  providerId: deployment.providerId,
  lockedVersion: deployment.lockedVersion ? versionPresenter(deployment.lockedVersion) : null,
  defaultConfig: deployment.defaultConfig ? configPreviewPresenter(deployment.defaultConfig) : null,
  createdAt: deployment.createdAt,
  updatedAt: deployment.updatedAt
});

export let deploymentPreviewPresenter = (deployment: {
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
  object: 'provider.deployment#preview' as const,
  id: deployment.id,
  isEphemeral: deployment.isEphemeral,
  isDefault: deployment.isDefault,
  name: deployment.name,
  description: deployment.description,
  metadata: deployment.metadata,
  providerId: deployment.providerId,
  createdAt: deployment.createdAt,
  updatedAt: deployment.updatedAt
});

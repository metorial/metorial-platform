export type AuthConfigData = {
  id: string;
  status: string;
  isEphemeral: boolean;
  name: string | null;
  description: string | null;
  metadata: unknown;
  providerId: string;
  providerDeploymentId: string | null;
  providerAuthMethodId: string;
  createdAt: Date;
  updatedAt: Date;
};

export let authConfigPresenter = (authConfig: AuthConfigData) => ({
  object: 'provider.auth_config' as const,
  id: authConfig.id,
  status: authConfig.status,
  isEphemeral: authConfig.isEphemeral,
  name: authConfig.name,
  description: authConfig.description,
  metadata: authConfig.metadata,
  providerId: authConfig.providerId,
  providerDeploymentId: authConfig.providerDeploymentId,
  providerAuthMethodId: authConfig.providerAuthMethodId,
  createdAt: authConfig.createdAt,
  updatedAt: authConfig.updatedAt
});

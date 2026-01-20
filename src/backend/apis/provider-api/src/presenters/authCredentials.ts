export type AuthCredentialsData = {
  id: string;
  isEphemeral: boolean;
  name: string | null;
  description: string | null;
  metadata: unknown;
  providerId: string;
  providerAuthMethodId: string;
  createdAt: Date;
  updatedAt: Date;
};

export let authCredentialsPresenter = (credentials: AuthCredentialsData) => ({
  object: 'provider.auth_credentials' as const,
  id: credentials.id,
  isEphemeral: credentials.isEphemeral,
  name: credentials.name,
  description: credentials.description,
  metadata: credentials.metadata,
  providerId: credentials.providerId,
  providerAuthMethodId: credentials.providerAuthMethodId,
  createdAt: credentials.createdAt,
  updatedAt: credentials.updatedAt
});

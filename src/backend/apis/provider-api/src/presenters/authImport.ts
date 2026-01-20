import { authConfigPresenter, AuthConfigData } from './authConfig';

export type AuthImportData = {
  id: string;
  note: string | null;
  ip: string | null;
  userAgent: string | null;
  metadata: unknown;
  authConfig: AuthConfigData;
  providerId: string;
  providerDeploymentId: string | null;
  providerAuthMethodId: string;
  providerAuthCredentialsId: string | null;
  createdAt: Date;
  expiresAt: Date;
};

export let authImportPresenter = (authImport: AuthImportData) => ({
  object: 'provider.auth_import' as const,
  id: authImport.id,
  note: authImport.note,
  ip: authImport.ip,
  userAgent: authImport.userAgent,
  metadata: authImport.metadata,
  authConfig: authConfigPresenter(authImport.authConfig),
  providerId: authImport.providerId,
  providerDeploymentId: authImport.providerDeploymentId,
  providerAuthMethodId: authImport.providerAuthMethodId,
  providerAuthCredentialsId: authImport.providerAuthCredentialsId,
  createdAt: authImport.createdAt,
  expiresAt: authImport.expiresAt
});

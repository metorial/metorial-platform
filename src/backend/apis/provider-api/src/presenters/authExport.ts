import { authConfigPresenter, AuthConfigData } from './authConfig';

export type AuthExportData = {
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

export let authExportPresenter = (authExport: AuthExportData) => ({
  object: 'provider.auth_export' as const,
  id: authExport.id,
  note: authExport.note,
  ip: authExport.ip,
  userAgent: authExport.userAgent,
  metadata: authExport.metadata,
  authConfig: authConfigPresenter(authExport.authConfig),
  providerId: authExport.providerId,
  providerDeploymentId: authExport.providerDeploymentId,
  providerAuthMethodId: authExport.providerAuthMethodId,
  providerAuthCredentialsId: authExport.providerAuthCredentialsId,
  createdAt: authExport.createdAt,
  expiresAt: authExport.expiresAt
});

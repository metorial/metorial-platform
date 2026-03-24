import type {
  Provider,
  ProviderAuthConfig,
  ProviderAuthCredentials,
  ProviderAuthExport,
  ProviderAuthMethod,
  ProviderDeployment,
  ProviderSpecification
} from '@metorial-subspace/db';
import { providerAuthConfigPresenter } from './providerAuthConfig';

export let providerAuthExportPresenter = (
  providerAuthExport: ProviderAuthExport & {
    authConfig: ProviderAuthConfig & {
      provider: Provider;
      deployment: ProviderDeployment | null;
      authCredentials: ProviderAuthCredentials | null;
      authMethod: ProviderAuthMethod & {
        specification: Omit<ProviderSpecification, 'value'>;
      };
    };
  }
) => ({
  object: 'provider.auth_import',

  id: providerAuthExport.id,
  note: providerAuthExport.note,
  ip: providerAuthExport.ip,
  userAgent: providerAuthExport.ua,
  metadata: providerAuthExport.metadata,

  authConfig: providerAuthConfigPresenter(providerAuthExport.authConfig),

  providerId: providerAuthExport.authConfig.provider.id,
  providerDeploymentId: providerAuthExport.authConfig.deployment?.id ?? null,
  authMethodId: providerAuthExport.authConfig.authMethod.id,
  credentialsId: providerAuthExport.authConfig.authCredentials?.id ?? null,

  createdAt: providerAuthExport.createdAt,
  expiresAt: providerAuthExport.expiresAt
});

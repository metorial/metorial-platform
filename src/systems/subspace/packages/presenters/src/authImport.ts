import type {
  Provider,
  ProviderAuthConfig,
  ProviderAuthCredentials,
  ProviderAuthImport,
  ProviderAuthMethod,
  ProviderDeployment,
  ProviderSpecification
} from '@metorial-subspace/db';
import { providerAuthConfigPresenter } from './providerAuthConfig';

export let providerAuthImportPresenter = (
  providerAuthImport: ProviderAuthImport & {
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

  id: providerAuthImport.id,
  note: providerAuthImport.note,
  ip: providerAuthImport.ip,
  userAgent: providerAuthImport.ua,
  metadata: providerAuthImport.metadata,

  authConfig: providerAuthConfigPresenter(providerAuthImport.authConfig),

  providerId: providerAuthImport.authConfig.provider.id,
  providerDeploymentId: providerAuthImport.authConfig.deployment?.id ?? null,
  authMethodId: providerAuthImport.authConfig.authMethod.id,
  credentialsId: providerAuthImport.authConfig.authCredentials?.id ?? null,

  createdAt: providerAuthImport.createdAt,
  expiresAt: providerAuthImport.expiresAt
});

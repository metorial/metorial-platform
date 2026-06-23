import type {
  Identity,
  IdentityActor,
  Integration,
  IntegrationInstance,
  IntegrationInstanceProvider,
  IntegrationInstanceProviderVersion,
  IntegrationProvider,
  IntegrationProviderVersion,
  Provider,
  ProviderAuthConfig,
  ProviderAuthCredentials,
  ProviderAuthMethod,
  ProviderConfig,
  ProviderDeployment,
  ProviderSpecification,
  SessionTemplate
} from '@metorial-subspace/db';
import { integrationInstanceProviderPresenter } from './integrationInstanceProvider';

export let integrationInstancePresenter = (
  integrationInstance: IntegrationInstance & {
    integration: Integration;
    identityActor: IdentityActor | null;
    identity: Identity | null;
    integrationInstanceProviders: (IntegrationInstanceProvider & {
      integration: Integration;
      integrationInstance: IntegrationInstance;
      integrationProvider: IntegrationProvider & {
        integration: Integration;
        provider: Provider;
        currentVersion:
          | (IntegrationProviderVersion & {
              deployment: ProviderDeployment;
              authMethod:
                | (ProviderAuthMethod & {
                    specification: Omit<ProviderSpecification, 'value'>;
                  })
                | null;
              authCredentials: ProviderAuthCredentials | null;
              config: ProviderConfig | null;
            })
          | null;
      };
      currentVersion:
        | (IntegrationInstanceProviderVersion & {
            integrationProviderVersion: IntegrationProviderVersion & {
              deployment: ProviderDeployment;
              authMethod:
                | (ProviderAuthMethod & {
                    specification: Omit<ProviderSpecification, 'value'>;
                  })
                | null;
              authCredentials: ProviderAuthCredentials | null;
              config: ProviderConfig | null;
            };
            config: (ProviderConfig & { provider: Provider }) | null;
            authConfig: (ProviderAuthConfig & { provider: Provider }) | null;
          })
        | null;
    })[];
    defaultSessionTemplate: SessionTemplate | null;
    magicMcpServerBackings: {
      id: string;
    }[];
  }
) => {
  let magicMcpServerBackingId = integrationInstance.magicMcpServerBackings[0]?.id ?? null;

  return {
    object: 'integration.instance',

    id: integrationInstance.id,
    status: integrationInstance.status,

    name: integrationInstance.name,
    description: integrationInstance.description,
    metadata: integrationInstance.metadata,
    privateMetadata: integrationInstance.privateMetadata,

    integrationId: integrationInstance.integration.id,
    identityActorId: integrationInstance.identityActor?.id ?? null,
    identityId: integrationInstance.identity?.id ?? null,
    defaultSessionTemplateId: integrationInstance.defaultSessionTemplate?.id ?? null,
    magicMcpServerBackingId,

    providers: integrationInstance.integrationInstanceProviders.map(provider =>
      integrationInstanceProviderPresenter(provider)
    ),

    createdAt: integrationInstance.createdAt,
    updatedAt: integrationInstance.updatedAt,
    archivedAt: integrationInstance.archivedAt
  };
};

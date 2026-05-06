import type {
  EphemeralManagedSession,
  IdentityActor,
  Integration,
  IntegrationInstance,
  IntegrationInstanceGroup,
  IntegrationProvider,
  IntegrationProviderVersion,
  MagicMcpEndpointBacking,
  MagicMcpEndpointServerBacking,
  Provider,
  ProviderAuthCredentials,
  ProviderAuthMethod,
  ProviderConfig,
  ProviderDeployment,
  ProviderSpecification,
  MagicMcpServerBacking,
  ProviderTemplateBacking,
  SessionTemplate
} from '@metorial-subspace/db';
import { integrationProviderPresenter } from './integrationProvider';

type ProviderTemplateBackingIntegration = Integration & {
  providers: (IntegrationProvider & {
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
  })[];
};

export let providerTemplateBackingPresenter = (
  backing: ProviderTemplateBacking & {
    integration: ProviderTemplateBackingIntegration;
  }
) => ({
  object: 'magic_mcp.provider_template_backing',
  id: backing.id,
  integrationId: backing.integration.id,
  providers: backing.integration.providers
    .filter(provider => !!provider.currentVersion)
    .map(provider =>
      integrationProviderPresenter({
        ...provider,
        integration: backing.integration,
        currentVersion: provider.currentVersion
      })
    ),
  createdAt: backing.createdAt
});

export let magicMcpServerBackingPresenter = (
  backing: MagicMcpServerBacking & {
    providerTemplateBacking: ProviderTemplateBacking | null;
    ownerIntegration: Integration | null;
    integration: Integration | null;
    integrationInstance: IntegrationInstance;
    sessionTemplate: SessionTemplate;
    ephemeralManagedSession: EphemeralManagedSession;
    actor: IdentityActor | null;
  }
) => ({
  object: 'magic_mcp.server_backing',
  id: backing.id,
  ownerType: backing.ownerType,
  providerTemplateBackingId: backing.providerTemplateBacking?.id ?? null,
  ownerIntegrationId: backing.ownerIntegration?.id ?? null,
  integrationId: backing.integration?.id ?? null,
  integrationInstanceId: backing.integrationInstance.id,
  sessionTemplateId: backing.sessionTemplate.id,
  ephemeralManagedSessionId: backing.ephemeralManagedSession.id,
  willRotateAt: backing.ephemeralManagedSession.willRotateAt,
  identityActorId: backing.actor?.id ?? null,
  createdAt: backing.createdAt
});

export let magicMcpEndpointServerBackingPresenter = (
  backing: MagicMcpEndpointServerBacking & {
    magicMcpServerBacking: MagicMcpServerBacking;
  }
) => ({
  object: 'magic_mcp.endpoint_server_backing',
  id: backing.id,
  magicMcpServerBackingId: backing.magicMcpServerBacking.id,
  createdAt: backing.createdAt
});

export let magicMcpEndpointBackingPresenter = (
  backing: MagicMcpEndpointBacking & {
    integrationGroup: IntegrationInstanceGroup;
    sessionTemplate: SessionTemplate;
    ephemeralManagedSession: EphemeralManagedSession;
    actor: IdentityActor | null;
    servers: (MagicMcpEndpointServerBacking & {
      magicMcpServerBacking: MagicMcpServerBacking;
    })[];
  }
) => ({
  object: 'magic_mcp.endpoint_backing',
  id: backing.id,
  integrationInstanceGroupId: backing.integrationGroup.id,
  sessionTemplateId: backing.sessionTemplate.id,
  ephemeralManagedSessionId: backing.ephemeralManagedSession.id,
  willRotateAt: backing.ephemeralManagedSession.willRotateAt,
  identityActorId: backing.actor?.id ?? null,
  servers: backing.servers.map(magicMcpEndpointServerBackingPresenter),
  createdAt: backing.createdAt
});

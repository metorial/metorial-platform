import type {
  EphemeralManagedSession,
  IdentityActor,
  Integration,
  IntegrationInstance,
  MagicMcpEndpointBacking,
  MagicMcpEndpointServerBacking,
  MagicMcpServerBacking,
  ProviderTemplateBacking,
  SessionTemplate
} from '@metorial-subspace/db';

export let providerTemplateBackingPresenter = (
  backing: ProviderTemplateBacking & {
    integration: Integration;
  }
) => ({
  object: 'magic_mcp.provider_template_backing',
  id: backing.id,
  integrationId: backing.integration.id,
  createdAt: backing.createdAt
});

export let magicMcpServerBackingPresenter = (
  backing: MagicMcpServerBacking & {
    providerTemplateBacking: ProviderTemplateBacking | null;
    integration: Integration | null;
    integrationInstance: IntegrationInstance;
    sessionTemplate: SessionTemplate;
    ephemeralManagedSession: EphemeralManagedSession;
    actor: IdentityActor | null;
  }
) => ({
  object: 'magic_mcp.server_backing',
  id: backing.id,
  providerTemplateBackingId: backing.providerTemplateBacking?.id ?? null,
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
    integrationGroup: Integration;
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

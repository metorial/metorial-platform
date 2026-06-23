import type {
  FunctionServer,
  ServerAuthConfig,
  ServerConfig,
  ServerDiscovery,
  ServerSpecification,
  ServerVersion
} from '../../prisma/generated/client';

export let serverDiscoveryPresenter = (
  serverDiscovery: ServerDiscovery & {
    serverConfig: ServerConfig;
    serverVersion: ServerVersion & {
      functionServer: FunctionServer | null;
    };
    serverAuthConfig: ServerAuthConfig | null;
    specification: ServerSpecification | null;
  }
) => ({
  object: 'shuttle#server_discovery',

  id: serverDiscovery.id,
  status: serverDiscovery.status,

  error: serverDiscovery.error,
  warnings: serverDiscovery.warnings,

  authConfigSchema: serverDiscovery.serverVersion.functionServer?.authConfigSchema ?? null,
  configSchema: serverDiscovery.serverVersion.configSchema ?? null,

  capabilities: serverDiscovery.specification?.value.capabilities ?? {},
  instructions: serverDiscovery.specification?.value.instructions || null,
  prompts: serverDiscovery.specification?.value.prompts ?? [],
  resourceTemplates: serverDiscovery.specification?.value.resourceTemplates ?? [],
  tools: serverDiscovery.specification?.value.tools ?? [],
  info: serverDiscovery.specification?.value.info ?? { name: 'unknown', version: 'unknown' },

  serverConfigId: serverDiscovery.serverConfig.id,
  serverVersionId: serverDiscovery.serverVersion.id,
  serverAuthConfigId: serverDiscovery.serverAuthConfig?.id,

  createdAt: serverDiscovery.createdAt
});

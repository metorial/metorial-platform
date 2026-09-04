import { delay } from '@lowerdeck/delay';
import { db } from '@metorial-subspace/db';
import {
  IProviderCapabilities,
  type ConnectionSpecificationBehavior,
  type ProviderConnectionSpecificationBehaviorParam,
  type ProviderSpecificationBehaviorParam,
  type ProviderSpecificationBehaviorRes,
  type ProviderSpecificationGetForPairParam,
  type ProviderSpecificationGetForProviderParam,
  type ProviderSpecificationGetRes
} from '@metorial-subspace/provider-utils';
import { getTenantForShuttle, shuttle, shuttleDefaultReaderTenant } from '../client';
import {
  buildMcpAuthMethods,
  buildMcpSpecification,
  buildMcpTools,
  type McpSpecificationSource
} from '../lib/mapMcpSpecification';
import { resolveConnectionSpecificationBehavior } from '../lib/serverTypes';

export class ProviderCapabilities extends IProviderCapabilities {
  override async getSpecificationBehavior(
    data: ProviderSpecificationBehaviorParam
  ): Promise<ProviderSpecificationBehaviorRes> {
    return {
      supportsVersionSpecification: true,
      supportsDeploymentSpecification: true
    };
  }

  override async shouldDiscoverSpecificationForProviderPair(
    data: ProviderSpecificationGetForPairParam
  ): Promise<{ shouldDiscover: boolean }> {
    if (!data.providerVersion.shuttleServerOid) {
      throw new Error('Provider version does not have a server associated with it');
    }

    let shuttle = await db.shuttleServer.findUnique({
      where: { oid: data.providerVersion.shuttleServerOid }
    });

    return { shouldDiscover: shuttle?.type != 'container' };
  }

  override async getConnectionSpecificationBehavior(
    data: ProviderConnectionSpecificationBehaviorParam
  ): Promise<ConnectionSpecificationBehavior> {
    return await resolveConnectionSpecificationBehavior(data.providerVersion);
  }

  override async getSpecificationForProviderVersion(
    data: ProviderSpecificationGetForProviderParam
  ): Promise<ProviderSpecificationGetRes> {
    if (!data.providerVersion.shuttleServerVersionOid) {
      throw new Error('Provider version does not have a server associated with it');
    }

    let tenant = data.tenant
      ? await getTenantForShuttle(data.tenant)
      : shuttleDefaultReaderTenant;

    let shuttleServerVersion = await db.shuttleServerVersion.findUniqueOrThrow({
      where: { oid: data.providerVersion.shuttleServerVersionOid },
      include: { server: true }
    });

    let version = await shuttle.serverVersion.get({
      serverVersionId: shuttleServerVersion.id,
      tenantId: tenant.id
    });
    let server = await shuttle.server.get({
      serverId: shuttleServerVersion.server.id,
      tenantId: tenant.id
    });

    return this.mapDiscovery(server, version, undefined);
  }

  override async getSpecificationForProviderPair(
    data: ProviderSpecificationGetForPairParam
  ): Promise<ProviderSpecificationGetRes> {
    if (!data.providerVersion.shuttleServerVersionOid) {
      throw new Error('Provider version does not have a server associated with it');
    }
    if (!data.configVersion.shuttleConfigOid) {
      throw new Error('Config version does not have a shuttle config associated with it');
    }
    if (data.authConfigVersion && !data.authConfigVersion.shuttleAuthConfigOid) {
      throw new Error(
        'Auth config version does not have a shuttle auth config associated with it'
      );
    }

    let tenant = await getTenantForShuttle(data.tenant);

    let shuttleServerVersion = await db.shuttleServerVersion.findUniqueOrThrow({
      where: { oid: data.providerVersion.shuttleServerVersionOid },
      include: { server: true }
    });
    let config = await db.shuttleServerConfig.findUniqueOrThrow({
      where: { oid: data.configVersion.shuttleConfigOid }
    });
    let authConfig = data.authConfigVersion?.shuttleAuthConfigOid
      ? await db.shuttleAuthConfig.findUniqueOrThrow({
          where: { oid: data.authConfigVersion.shuttleAuthConfigOid }
        })
      : null;

    let version = await shuttle.serverVersion.get({
      serverVersionId: shuttleServerVersion.id,
      tenantId: tenant.id
    });
    let server = await shuttle.server.get({
      serverId: shuttleServerVersion.server.id,
      tenantId: tenant.id
    });
    let discovery = await shuttle.serverDiscovery.create({
      tenantId: tenant.id,
      serverConfigId: config.id,
      serverAuthConfigId: authConfig?.id,
      serverVersionId: shuttleServerVersion.id,
      waitForCompletion: false
    });

    let i = 0;
    while (discovery.status == 'pending') {
      discovery = await shuttle.serverDiscovery.get({
        serverDiscoveryId: discovery.id,
        tenantId: tenant.id
      });

      await delay(i++ < 15 ? 1000 : 5000);
    }

    if (discovery.status == 'failed') {
      return {
        status: 'failure',
        warnings: discovery.warnings,
        error: discovery.error
      };
    }

    return this.mapDiscovery(server, version, discovery);
  }

  private async mapDiscovery(
    server: Awaited<ReturnType<typeof shuttle.server.get>>,
    version: Awaited<ReturnType<typeof shuttle.serverVersion.get>>,
    discovery?: Awaited<ReturnType<typeof shuttle.serverDiscovery.create>>
  ): Promise<ProviderSpecificationGetRes> {
    let source: McpSpecificationSource = {
      serverId: server.id,
      serverName: server.name,
      serverVersionId: version.id,
      configJsonSchema: version.configSchema,
      oauthAuthConfigSchema: server.oauthConfig?.authConfigSchema,
      hasOAuth: !!server.oauthConfig
    };

    let mapped = discovery
      ? {
          specId: discovery.id,
          info: discovery.info,
          capabilities: discovery.capabilities,
          instructions: discovery.instructions,
          tools: discovery.tools,
          prompts: discovery.prompts,
          resourceTemplates: discovery.resourceTemplates
        }
      : null;

    return {
      status: 'success',
      type: discovery ? 'full' : 'preliminary',
      warnings: discovery?.warnings,

      features: {
        supportsAuthMethod: !!server.oauthConfig,
        configContainsAuth: !server.oauthConfig
      },

      specification: buildMcpSpecification(source, mapped),
      triggers: [],
      authMethods: buildMcpAuthMethods(source),
      tools: buildMcpTools(source, mapped)
    };
  }
}

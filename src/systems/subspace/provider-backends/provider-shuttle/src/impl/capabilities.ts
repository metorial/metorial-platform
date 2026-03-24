import { delay } from '@lowerdeck/delay';
import { slugify } from '@lowerdeck/slugify';
import { db } from '@metorial-subspace/db';
import {
  IProviderCapabilities,
  type ProviderSpecificationBehaviorParam,
  type ProviderSpecificationBehaviorRes,
  type ProviderSpecificationGetForPairParam,
  type ProviderSpecificationGetForProviderParam,
  type ProviderSpecificationGetRes
} from '@metorial-subspace/provider-utils';
import { UriTemplate } from '@modelcontextprotocol/sdk/shared/uriTemplate.js';
import z from 'zod';
import { getTenantForShuttle, shuttle, shuttleDefaultReaderTenant } from '../client';
import {
  COMPLETION_COMPLETE_KEY,
  LOGGING_SETLEVEL_KEY,
  RESOURCES_LIST_KEY,
  RESOURCES_READ_KEY
} from '../const';

let toolSlug = (name: string) =>
  slugify(name.replaceAll('_', '-').replaceAll(' ', '-').toLowerCase());

let emptyConfigSchema = z.object({}).toJSONSchema();

let shuttleOAuthOutputSchema = z
  .object({
    accessToken: z.string(),
    expiresAt: z.string().optional().nullable()
  })
  .toJSONSchema();

let promptArgumentsToZod = (
  args: {
    name: string;
    description?: string | undefined;
    required?: boolean | undefined;
  }[]
): z.ZodTypeAny => {
  let inner: Record<string, z.ZodTypeAny> = {};
  for (let arg of args) {
    let schema: z.ZodTypeAny = z.string();
    if (!arg.required) schema = schema.optional();
    inner[arg.name] = schema;
  }
  return z.object(inner);
};

let resourceTemplateUriToZod = (uriTemplate: string): z.ZodTypeAny => {
  let template = new UriTemplate(uriTemplate);

  let inner: Record<string, z.ZodTypeAny> = {};
  for (let varName of template.variableNames) {
    inner[varName] = z.string();
  }
  return z.object(inner);
};

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
    return {
      status: 'success',

      type: discovery ? 'full' : 'preliminary',

      warnings: discovery?.warnings,

      features: {
        supportsAuthMethod: !!server.oauthConfig,
        configContainsAuth: !server.oauthConfig
      },

      specification: discovery
        ? {
            specId: discovery.id,
            key: toolSlug(server.name),
            name: discovery.info.title ?? `${discovery.info.name}@${discovery.info.version}`,
            metadata: {},
            configJsonSchema: version.configSchema || emptyConfigSchema,
            configVisibility: 'encrypted',
            triggers: [],

            mcp: {
              serverInfo: discovery.info,
              capabilities: discovery.capabilities,
              instructions: discovery.instructions ?? undefined
            }
          }
        : {
            specId: `shuttle::${server.id}::${version.id}::preliminary`,
            key: toolSlug(server.name),
            name: server.name,
            metadata: {},
            configJsonSchema: version.configSchema || emptyConfigSchema,
            configVisibility: 'encrypted',
            triggers: [],
            mcp: null
          },

      triggers: [],

      authMethods: server.oauthConfig
        ? [
            {
              specId: `shuttle::${server.id}::oauth`,
              callableId: 'oauth',
              key: 'oauth',
              name: 'OAuth',
              inputJsonSchema: server.oauthConfig.authConfigSchema ?? emptyConfigSchema,
              outputJsonSchema: shuttleOAuthOutputSchema,
              scopes: [],
              type: 'oauth',
              capabilities: {},
              metadata: {}
            }
          ]
        : [],

      tools: discovery
        ? [
            ...discovery.tools.map(t => ({
              specId: `shuttle::${server.id}::tool::${t.name}`,
              callableId: t.name,
              key: `tool_${toolSlug(t.name)}`,
              name: t.name,
              title: t.title,
              description: t.description,
              inputJsonSchema: t.inputSchema,
              outputJsonSchema: t.outputSchema,
              constraints: [],
              instructions: [],
              capabilities: {},
              mcpToolType: {
                type: 'mcp.tool' as const,
                key: t.name,
                title: t.title,
                icons: t.icons,
                annotations: t.annotations,
                execution: t.execution,
                _meta: t._meta
              },
              tags: {
                readOnly: t.annotations?.readOnlyHint,
                destructive: t.annotations?.destructiveHint
              },
              metadata: {}
            })),

            ...discovery.prompts.map(t => ({
              specId: `shuttle::${server.id}::tool::${t.name}`,
              callableId: t.name,
              key: `prompt_${toolSlug(t.name)}`,
              name: t.name,
              title: t.title,
              description: t.description,
              inputJsonSchema: t.arguments
                ? promptArgumentsToZod(t.arguments).toJSONSchema()
                : emptyConfigSchema,
              constraints: [],
              instructions: [],
              capabilities: {},
              mcpToolType: {
                type: 'mcp.prompt' as const,
                key: t.name,
                title: t.title,
                arguments: t.arguments || [],
                icons: t.icons,
                _meta: t._meta
              },
              tags: {},
              metadata: {}
            })),

            ...discovery.resourceTemplates.map(t => ({
              specId: `shuttle::${server.id}::tool::${t.name}`,
              callableId: t.uriTemplate,
              key: `resource_${toolSlug(t.name)}`,
              name: t.name,
              title: t.title,
              description: t.description,
              inputJsonSchema: resourceTemplateUriToZod(t.uriTemplate).toJSONSchema(),
              constraints: [],
              instructions: [],
              capabilities: {},
              mcpToolType: {
                type: 'mcp.resource_template' as const,
                uriTemplate: t.uriTemplate,
                variableNames: new UriTemplate(t.uriTemplate).variableNames,
                annotations: t.annotations,
                icons: t.icons,
                mimeType: t.mimeType,
                title: t.title,
                _meta: t._meta
              },
              tags: {},
              metadata: {}
            })),

            ...(discovery.capabilities.resources
              ? [
                  {
                    specId: `shuttle::${server.id}::tool::resources_list`,
                    callableId: RESOURCES_LIST_KEY,
                    key: `resources_list`,
                    name: 'resources_list',
                    title: 'List Resources',
                    description: 'List all resources',
                    inputJsonSchema: emptyConfigSchema,
                    outputJsonSchema: emptyConfigSchema,
                    constraints: [],
                    instructions: [],
                    capabilities: {},
                    mcpToolType: {
                      type: 'mcp.resources_list' as const
                    },
                    tags: {},
                    metadata: {}
                  },

                  {
                    specId: `shuttle::${server.id}::tool::resources_read`,
                    callableId: RESOURCES_READ_KEY,
                    key: `resources_read`,
                    name: 'resources_read',
                    title: 'Read Resource',
                    description: 'Read a specific resource',
                    inputJsonSchema: emptyConfigSchema,
                    outputJsonSchema: emptyConfigSchema,
                    constraints: [],
                    instructions: [],
                    capabilities: {},
                    mcpToolType: {
                      type: 'mcp.resources_read' as const
                    },
                    tags: {},
                    metadata: {}
                  }
                ]
              : []),

            ...(discovery.capabilities.completions
              ? [
                  {
                    specId: `shuttle::${server.id}::tool::completion_complete`,
                    callableId: COMPLETION_COMPLETE_KEY,
                    key: `completion_complete`,
                    name: 'completion_complete',
                    title: 'List Resources',
                    description: 'List all resources',
                    inputJsonSchema: emptyConfigSchema,
                    outputJsonSchema: emptyConfigSchema,
                    constraints: [],
                    instructions: [],
                    capabilities: {},
                    mcpToolType: {
                      type: 'mcp.completion_complete' as const
                    },
                    tags: {},
                    metadata: {}
                  }
                ]
              : []),

            ...(discovery.capabilities.logging
              ? [
                  {
                    specId: `shuttle::${server.id}::tool::logging_setLevel`,
                    callableId: LOGGING_SETLEVEL_KEY,
                    key: `logging_setLevel`,
                    name: 'logging_setLevel',
                    title: 'List Resources',
                    description: 'List all resources',
                    inputJsonSchema: emptyConfigSchema,
                    outputJsonSchema: emptyConfigSchema,
                    constraints: [],
                    instructions: [],
                    capabilities: {},
                    mcpToolType: {
                      type: 'mcp.logging_setLevel' as const
                    },
                    tags: {},
                    metadata: {}
                  }
                ]
              : [])
          ]
        : []
    };
  }
}

import { slugify } from '@lowerdeck/slugify';
import type {
  Specification,
  SpecificationAuthMethod,
  SpecificationTool
} from '@metorial-subspace/provider-utils';
import { UriTemplate } from '@modelcontextprotocol/sdk/shared/uriTemplate.js';
import type { InitializeResult } from '@modelcontextprotocol/sdk/types.js';
import z from 'zod';
import {
  COMPLETION_COMPLETE_KEY,
  LOGGING_SETLEVEL_KEY,
  RESOURCES_LIST_KEY,
  RESOURCES_READ_KEY
} from '../const';

export let toolSlug = (name: string) =>
  slugify(name.replaceAll('_', '-').replaceAll(' ', '-').toLowerCase());

export let emptyConfigSchema = z.object({}).toJSONSchema();

let shuttleOAuthOutputSchema = z
  .object({
    accessToken: z.string(),
    expiresAt: z.string().optional().nullable()
  })
  .toJSONSchema();

export interface McpDiscoveredTool {
  name: string;
  title?: string;
  description?: string;
  inputSchema: Record<string, any>;
  outputSchema?: Record<string, any>;
  icons?: any;
  annotations?: any;
  execution?: any;
  _meta?: Record<string, any>;
}

export interface McpDiscoveredPrompt {
  name: string;
  title?: string;
  description?: string;
  arguments?: { name: string; description?: string; required?: boolean }[];
  icons?: any;
  _meta?: Record<string, any>;
}

export interface McpDiscoveredResourceTemplate {
  name: string;
  uriTemplate: string;
  title?: string;
  description?: string;
  mimeType?: string;
  annotations?: any;
  icons?: any;
  _meta?: Record<string, any>;
}

export interface McpDiscovery {
  specId: string;
  info: InitializeResult['serverInfo'];
  capabilities: InitializeResult['capabilities'];
  instructions?: string | null;
  tools: McpDiscoveredTool[];
  prompts: McpDiscoveredPrompt[];
  resourceTemplates: McpDiscoveredResourceTemplate[];
}

export interface McpSpecificationSource {
  serverId: string;
  serverName: string;
  serverVersionId: string;
  configJsonSchema: Record<string, any> | null;
  oauthAuthConfigSchema: Record<string, any> | null | undefined;
  hasOAuth: boolean;
}

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

export let buildMcpSpecification = (
  source: McpSpecificationSource,
  discovery: McpDiscovery | null
): Specification =>
  discovery
    ? {
        specId: discovery.specId,
        key: toolSlug(source.serverName),
        name: discovery.info.title ?? `${discovery.info.name}@${discovery.info.version}`,
        metadata: {},
        configJsonSchema: source.configJsonSchema || emptyConfigSchema,
        configVisibility: 'encrypted',
        triggers: [],

        mcp: {
          serverInfo: discovery.info,
          capabilities: discovery.capabilities,
          instructions: discovery.instructions ?? undefined
        }
      }
    : {
        specId: `shuttle::${source.serverId}::${source.serverVersionId}::preliminary`,
        key: toolSlug(source.serverName),
        name: source.serverName,
        metadata: {},
        configJsonSchema: source.configJsonSchema || emptyConfigSchema,
        configVisibility: 'encrypted',
        triggers: [],
        mcp: null
      };

export let buildMcpAuthMethods = (
  source: McpSpecificationSource
): SpecificationAuthMethod[] =>
  source.hasOAuth
    ? [
        {
          specId: `shuttle::${source.serverId}::oauth`,
          callableId: 'oauth',
          key: 'oauth',
          name: 'OAuth',
          inputJsonSchema: source.oauthAuthConfigSchema ?? emptyConfigSchema,
          outputJsonSchema: shuttleOAuthOutputSchema,
          scopes: [],
          type: 'oauth',
          capabilities: {},
          metadata: {}
        }
      ]
    : [];

export let buildMcpTools = (
  source: McpSpecificationSource,
  discovery: McpDiscovery | null
): SpecificationTool[] => {
  if (!discovery) return [];

  let builtin = (
    key: string,
    callableId: string,
    name: string,
    title: string,
    description: string,
    mcpToolType: SpecificationTool['mcpToolType']
  ): SpecificationTool => ({
    specId: `shuttle::${source.serverId}::tool::${key}`,
    callableId,
    key,
    name,
    title,
    description,
    inputJsonSchema: emptyConfigSchema,
    outputJsonSchema: emptyConfigSchema,
    constraints: [],
    instructions: [],
    capabilities: {},
    mcpToolType,
    tags: {},
    metadata: {}
  });

  return [
    ...discovery.tools.map(t => ({
      specId: `shuttle::${source.serverId}::tool::${t.name}`,
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
      specId: `shuttle::${source.serverId}::tool::${t.name}`,
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
      specId: `shuttle::${source.serverId}::tool::${t.name}`,
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
          builtin(
            'resources_list',
            RESOURCES_LIST_KEY,
            'resources_list',
            'List Resources',
            'List all resources exposed by this MCP server',
            { type: 'mcp.resources_list' }
          ),
          builtin(
            'resources_read',
            RESOURCES_READ_KEY,
            'resources_read',
            'Read Resource',
            'Read a specific resource exposed by this MCP server',
            { type: 'mcp.resources_read' }
          )
        ]
      : []),

    ...(discovery.capabilities.completions
      ? [
          builtin(
            'completion_complete',
            COMPLETION_COMPLETE_KEY,
            'completion_complete',
            'Complete Argument',
            'Request completion suggestions for a prompt or resource argument',
            { type: 'mcp.completion_complete' }
          )
        ]
      : []),

    ...(discovery.capabilities.logging
      ? [
          builtin(
            'logging_setLevel',
            LOGGING_SETLEVEL_KEY,
            'logging_setLevel',
            'Set Log Level',
            'Set the logging level of this MCP server',
            { type: 'mcp.logging_setLevel' }
          )
        ]
      : [])
  ];
};

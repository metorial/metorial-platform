import { MetorialSDK } from '@metorial/core';
import { JsonSchema, jsonSchemaToOpenApi } from '@metorial/json-schema';
import { McpUriTemplate } from './lib/mcpUri';
import { slugify } from './lib/slugify';
import { MetorialMcpSession } from './mcpSession';

type Tool = MetorialSDK.ServerCapabilities['tools'][number];
type ResourceTemplate = MetorialSDK.ServerCapabilities['resourceTemplates'][number];

export class MetorialMcpTool {
  #id: string;
  #name: string;
  #description: string | null;
  #parameters: JsonSchema;

  private constructor(
    private readonly session: MetorialMcpSession,
    opts: {
      id: string;
      name: string;
      description: string | null;
      parameters: JsonSchema;
    },
    private readonly action: (args: any) => Promise<any>
  ) {
    this.#id = opts.id;
    this.#name = opts.name;
    this.#description = opts.description;
    this.#parameters = opts.parameters;
  }

  get name() {
    return this.#name;
  }

  get id() {
    return this.#id;
  }

  get description() {
    return this.#description;
  }

  get parameters() {
    return this.#parameters;
  }

  async call(args: any) {
    return await this.action(args);
  }

  getParametersAs(as: 'json-schema' | 'openapi-3.0.0' | 'openapi-3.1.0' = 'json-schema') {
    if (as == 'json-schema') return this.#parameters;

    if (as == 'openapi-3.0.0' || as == 'openapi-3.1.0') {
      return jsonSchemaToOpenApi(this.#parameters, {
        openApiVersion: as == 'openapi-3.0.0' ? '3.0.0' : '3.1.0',
        preserveJsonSchemaKeywords: false,
        nullHandling: 'nullable'
      });
    }

    throw new Error(`[METORIAL MCP]: Unknown parameters format: ${as}`);
  }

  static fromTool(
    session: MetorialMcpSession,
    capabilities: MetorialSDK.ServerCapabilities,
    tool: Tool
  ) {
    let mcpServer = capabilities.mcpServers.find(s => s.id === tool.mcpServerId)!;
    if (!mcpServer) {
      throw new Error(`[METORIAL MCP]: Tool ${tool.name} not found in capabilities`);
    }

    if (!mcpServer.serverDeployment) {
      throw new Error(`[METORIAL MCP]: Tool ${tool.name} has no server deployment to run on`);
    }

    return new MetorialMcpTool(
      session,
      {
        id: slugify(tool.name),
        name: tool.name,
        description: tool.description ?? null,
        parameters: tool.inputSchema
      },
      async params => {
        let client = await session.getClient({
          deploymentId: mcpServer.serverDeployment!.id
        });

        let result = await client.callTool({
          name: tool.name,
          arguments: params
        });

        return result.toolResult;
      }
    );
  }

  static fromResourceTemplate(
    session: MetorialMcpSession,
    capabilities: MetorialSDK.ServerCapabilities,
    template: ResourceTemplate
  ) {
    let mcpServer = capabilities.mcpServers.find(s => s.id === template.mcpServerId)!;
    if (!mcpServer) {
      throw new Error(`[METORIAL MCP]: Tool ${template.name} not found in capabilities`);
    }

    if (!mcpServer.serverDeployment) {
      throw new Error(
        `[METORIAL MCP]: Tool ${template.name} has no server deployment to run on`
      );
    }

    let uri = new McpUriTemplate(template.uriTemplate);

    return new MetorialMcpTool(
      session,
      {
        id: slugify(template.name),
        name: template.name,
        description: template.description ?? null,
        parameters: {
          type: 'object',
          properties: Object.fromEntries(
            uri.getProperties().map(prop => [prop.key, { type: 'string' }])
          ),
          required: uri
            .getProperties()
            .filter(prop => !prop.optional)
            .map(prop => prop.key)
        }
      },
      async params => {
        let client = await session.getClient({
          deploymentId: mcpServer.serverDeployment!.id
        });

        let finalUri = uri.expand(params);

        let result = await client.readResource({
          uri: finalUri
        });

        return result.contents;
      }
    );
  }
}

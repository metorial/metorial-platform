import { MetorialSDK } from '@metorial/core';
import { JsonSchema, jsonSchemaToOpenApi } from '@metorial/json-schema';
import { McpUriTemplate } from './lib/mcpUri';
import { slugify } from './lib/slugify';
import { MetorialMcpSession } from './mcpSession';

type SmallServerDeployment =
  MetorialSDK.ServerCapabilities['mcpServers'][number]['serverDeployment'];
type Tool = Omit<MetorialSDK.ServerCapabilities['tools'][number], 'mcpServerId'>;
type ResourceTemplate = Omit<
  MetorialSDK.ServerCapabilities['resourceTemplates'][number],
  'mcpServerId'
>;

export type Capability =
  | {
      type: 'tool';
      tool: Tool;
      serverDeployment: SmallServerDeployment;
    }
  | {
      type: 'resource-template';
      resourceTemplate: ResourceTemplate;
      serverDeployment: SmallServerDeployment;
    };

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

  static fromTool(session: MetorialMcpSession, capability: Capability) {
    if (capability.type !== 'tool') {
      throw new Error(
        `[METORIAL MCP]: Expected capability type to be 'tool', got '${capability.type}'`
      );
    }

    let { tool, serverDeployment } = capability;

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
          deploymentId: serverDeployment!.id
        });

        let result = await client.callTool({
          name: tool.name,
          arguments: params
        });

        return result;
      }
    );
  }

  static fromResourceTemplate(session: MetorialMcpSession, capability: Capability) {
    if (capability.type !== 'resource-template') {
      throw new Error(
        `[METORIAL MCP]: Expected capability type to be 'resource-template', got '${capability.type}'`
      );
    }

    let { resourceTemplate, serverDeployment } = capability;

    let uri = new McpUriTemplate(resourceTemplate.uriTemplate);

    return new MetorialMcpTool(
      session,
      {
        id: slugify(resourceTemplate.name),
        name: resourceTemplate.name,
        description: resourceTemplate.description ?? null,
        parameters: {
          type: 'object',
          properties: Object.fromEntries(
            uri.getProperties().map(prop => [prop.key, { type: 'string' }])
          ),
          required: uri
            .getProperties()
            .filter(prop => !prop.optional)
            .map(prop => prop.key),
          additionalProperties: false
        }
      },
      async params => {
        let client = await session.getClient({
          deploymentId: serverDeployment!.id
        });

        let finalUri = uri.expand(params);

        let result = await client.readResource({
          uri: finalUri
        });

        return result;
      }
    );
  }

  static fromCapability(session: MetorialMcpSession, capability: Capability): MetorialMcpTool {
    if (capability.type === 'tool') {
      return MetorialMcpTool.fromTool(session, capability);
    }

    if (capability.type === 'resource-template') {
      return MetorialMcpTool.fromResourceTemplate(session, capability);
    }

    throw new Error(
      `[METORIAL MCP]: Unknown capability type: ${capability}. Expected 'tool' or 'resource-template'.`
    );
  }
}

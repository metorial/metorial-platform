import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {
  CompatibilityCallToolResultSchema,
  type CallToolRequest,
  type CompatibilityCallToolResult,
  type GetPromptRequest,
  type GetPromptResult,
  type ListPromptsRequest,
  type ListPromptsResult,
  type ListResourcesRequest,
  type ListResourcesResult,
  type ListResourceTemplatesRequest,
  type ListResourceTemplatesResult,
  type ListToolsRequest,
  type ListToolsResult,
  type ReadResourceRequest,
  type ReadResourceResult
} from '@modelcontextprotocol/sdk/types.js';
import type { ParsedConnectionParams } from './query';

export class ExplorerMcpClient {
  private constructor(private readonly client: Client) {}

  static async create(params: ParsedConnectionParams) {
    let client = new Client({
      name: 'Metorial Explorer',
      version: '1.0.0'
    });

    let headers: Record<string, string> = {};

    if (params.token) {
      headers.Authorization = `Bearer ${params.token}`;
    }

    let transport =
      params.transport === 'streamable_http'
        ? new StreamableHTTPClientTransport(new URL(params.url), {
            requestInit: Object.keys(headers).length > 0 ? { headers } : undefined
          })
        : new SSEClientTransport(new URL(params.url), {
            requestInit: Object.keys(headers).length > 0 ? { headers } : undefined,
            eventSourceInit:
              Object.keys(headers).length > 0
                ? {
                    fetch: (url, init) => fetch(url, { ...init, headers })
                  }
                : undefined
          });

    await client.connect(transport);

    return new ExplorerMcpClient(client);
  }

  close() {
    return this.client.close();
  }

  getServerCapabilities() {
    return this.client.getServerCapabilities();
  }

  getServerVersion() {
    return this.client.getServerVersion();
  }

  listTools(params?: ListToolsRequest['params']): Promise<ListToolsResult> {
    return this.client.listTools(params);
  }

  listResources(params?: ListResourcesRequest['params']): Promise<ListResourcesResult> {
    return this.client.listResources(params);
  }

  listResourceTemplates(
    params?: ListResourceTemplatesRequest['params']
  ): Promise<ListResourceTemplatesResult> {
    return this.client.listResourceTemplates(params);
  }

  listPrompts(params?: ListPromptsRequest['params']): Promise<ListPromptsResult> {
    return this.client.listPrompts(params);
  }

  callTool(params: CallToolRequest['params']): Promise<CompatibilityCallToolResult> {
    return this.client.callTool(params, CompatibilityCallToolResultSchema);
  }

  readResource(params: ReadResourceRequest['params']): Promise<ReadResourceResult> {
    return this.client.readResource(params);
  }

  getPrompt(params: GetPromptRequest['params']): Promise<GetPromptResult> {
    return this.client.getPrompt(params);
  }
}

export let createExplorerMcpClient = (params: ParsedConnectionParams) =>
  ExplorerMcpClient.create(params);

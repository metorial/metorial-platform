import { MetorialSDK } from '@metorial/core';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { RequestOptions } from '@modelcontextprotocol/sdk/shared/protocol.js';
import {
  CallToolRequest,
  CallToolResultSchema,
  ClientCapabilities,
  CompatibilityCallToolResultSchema,
  CompleteRequest,
  GetPromptRequest,
  ListPromptsRequest,
  ListResourcesRequest,
  ListResourceTemplatesRequest,
  ListToolsRequest,
  LoggingLevel,
  ReadResourceRequest
} from '@modelcontextprotocol/sdk/types.js';

export class MetorialMcpClient {
  private constructor(private readonly client: Client) {}

  static async create(
    session: MetorialSDK.Session,
    opts: {
      host: string;
      deploymentId: string;
      clientName?: string;
      clientVersion?: string;
    }
  ) {
    let client = new Client({
      name: opts?.clientName ?? 'metorial-js-client',
      version: opts?.clientVersion ?? '1.0.0'
    });

    let transport = new SSEClientTransport(
      new URL(
        `/mcp/${session.id}/${opts.deploymentId}/sse?key=${session.clientSecret.secret}`,
        opts.host
      )
    );

    await client.connect(transport);

    return new MetorialMcpClient(client);
  }

  public registerCapabilities(capabilities: ClientCapabilities) {
    return this.client.registerCapabilities(capabilities);
  }

  public getServerCapabilities() {
    return this.client.getServerCapabilities()!;
  }

  public getServerVersion() {
    return this.client.getServerVersion()!;
  }

  public getInstructions() {
    return this.client.getInstructions();
  }

  complete(params: CompleteRequest['params'], options?: RequestOptions) {
    return this.client.complete(params, options);
  }

  setLoggingLevel(level: LoggingLevel, options?: RequestOptions) {
    return this.client.setLoggingLevel(level, options);
  }

  getPrompt(params: GetPromptRequest['params'], options?: RequestOptions) {
    return this.client.getPrompt(params, options);
  }

  listPrompts(params?: ListPromptsRequest['params'], options?: RequestOptions) {
    return this.client.listPrompts(params, options);
  }

  listResources(params?: ListResourcesRequest['params'], options?: RequestOptions) {
    return this.client.listResources(params, options);
  }

  listResourceTemplates(
    params?: ListResourceTemplatesRequest['params'],
    options?: RequestOptions
  ) {
    return this.client.listResourceTemplates(params, options);
  }

  readResource(params: ReadResourceRequest['params'], options?: RequestOptions) {
    return this.client.readResource(params, options);
  }

  callTool(
    params: CallToolRequest['params'],
    resultSchema:
      | typeof CallToolResultSchema
      | typeof CompatibilityCallToolResultSchema = CallToolResultSchema,
    options?: RequestOptions
  ) {
    return this.client.callTool(params, resultSchema, options);
  }

  listTools(params?: ListToolsRequest['params'], options?: RequestOptions) {
    return this.client.listTools(params, options);
  }

  sendRootsListChanged() {
    return this.client.sendRootsListChanged();
  }

  close() {
    return this.client.close();
  }
}

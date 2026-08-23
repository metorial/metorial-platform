import { createMCPClient, type MCPClient, type MCPTransport } from '@ai-sdk/mcp';
import type { ToolSet } from 'ai';
import type { SubspaceMcpToolList } from '../../../types';

export interface HttpMCPServer {
  type: 'http';
  url: string;
  headers?: Record<string, string>;
}

export interface SseMCPServer {
  type: 'sse';
  url: string;
  headers?: Record<string, string>;
}

type JsonRpcId = string | number;

type JsonRpcMessage = {
  jsonrpc: '2.0';
  id?: JsonRpcId;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: unknown;
};

type InternalMcpTransportOptions = {
  connectionToken?: string | null;
  sendMessage: (
    message: JsonRpcMessage,
    connectionToken: string | null | undefined,
    onProgress: (message: JsonRpcMessage) => Promise<void>
  ) => Promise<{
    responses: JsonRpcMessage[];
    connection?: { id: string; token: string } | null;
  }>;
  getCachedTools?: () => Promise<SubspaceMcpToolList | null | undefined>;
  setCachedTools?: (tools: SubspaceMcpToolList) => Promise<void>;
  onConnection?: (connection: {
    connectionId: string;
    connectionToken: string;
    mcpSessionId?: string | null;
  }) => Promise<void>;
  onActivity?: (d: { method?: string }) => Promise<void>;
};

let toError = (error: unknown) => {
  if (error instanceof Error) return error;
  return new Error(typeof error == 'string' ? error : 'Unknown MCP transport error');
};

let isRequest = (message: JsonRpcMessage): message is JsonRpcMessage & { id: JsonRpcId } =>
  typeof message.id == 'string' || typeof message.id == 'number';

export class InternalMcpTransport implements MCPTransport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JsonRpcMessage) => void;

  private abortController?: AbortController;
  private connectionToken?: string | null;

  constructor(private readonly options: InternalMcpTransportOptions) {
    this.connectionToken = options.connectionToken;
  }

  async start() {
    if (this.abortController) throw new Error('MCP transport already started');
    this.abortController = new AbortController();
  }

  async close() {
    this.abortController?.abort();
    this.onclose?.();
  }

  async send(message: JsonRpcMessage) {
    try {
      if (this.shouldUseCachedTools(message)) {
        let cached = await this.options.getCachedTools?.();

        if (cached) {
          this.onmessage?.({
            jsonrpc: '2.0',
            id: message.id,
            result: cached
          });
          await this.options.onActivity?.({ method: message.method });
          return;
        }
      }

      let result = await this.options.sendMessage(
        message,
        this.connectionToken,
        async progress => this.onmessage?.(progress)
      );
      let responses = result.responses;

      if (result.connection) {
        this.connectionToken = result.connection.token;
        await this.options.onConnection?.({
          connectionId: result.connection.id,
          connectionToken: result.connection.token,
          mcpSessionId: result.connection.token
        });
      }

      if (this.shouldUseCachedTools(message)) {
        let response = responses.find(response => response.id === message.id);
        if (response?.result) {
          await this.options.setCachedTools?.(response.result as SubspaceMcpToolList);
        }
      }

      for (let response of responses) {
        this.onmessage?.(response);
      }

      if (message.method == 'tools/list' || message.method == 'tools/call') {
        await this.options.onActivity?.({ method: message.method });
      }
    } catch (error) {
      let err = toError(error);
      this.onerror?.(err);
      throw err;
    }
  }

  private shouldUseCachedTools(message: JsonRpcMessage) {
    if (!isRequest(message)) return false;
    if (message.method != 'tools/list') return false;
    if (!message.params) return true;

    let params = message.params as Record<string, unknown>;
    return !params.cursor;
  }
}

export type CustomMCPServer = {
  transport: MCPTransport | (() => MCPTransport | Promise<MCPTransport>);
  name?: string;
  version?: string;
  onUncaughtError?: (error: unknown) => void;
};

export type MCPServerConfig = HttpMCPServer | SseMCPServer | CustomMCPServer;

export type MCPConnection = {
  clients: MCPClient[];
  tools: ToolSet;
};

export let connectMCPServers = async (
  configs: Record<string, MCPServerConfig>
): Promise<MCPConnection> => {
  let clients: MCPClient[] = [];
  let tools: ToolSet = {};
  let entries = Object.entries(configs);
  let shouldNamespace = entries.length > 1;

  for (let [serverName, config] of entries) {
    let transport = await buildTransport(config);
    let client = await createMCPClient({
      transport,
      name: 'name' in config ? config.name : serverName,
      version: 'version' in config ? config.version : undefined,
      onUncaughtError: 'onUncaughtError' in config ? config.onUncaughtError : undefined
    });

    clients.push(client);

    let serverTools = (await client.tools()) as ToolSet;
    for (let [toolName, toolDefinition] of Object.entries(serverTools)) {
      tools[shouldNamespace ? `${serverName}_${toolName}` : toolName] = toolDefinition;
    }
  }

  return { clients, tools };
};

export let closeMCPClients = async (clients: MCPClient[]) => {
  await Promise.all(clients.map(client => client.close().catch(() => undefined)));
};

let buildTransport = async (config: MCPServerConfig): Promise<any> => {
  if ('transport' in config) {
    return typeof config.transport == 'function' ? await config.transport() : config.transport;
  }

  switch (config.type) {
    case 'http':
      return { type: 'http' as const, url: config.url, headers: config.headers };

    case 'sse':
      return { type: 'sse' as const, url: config.url, headers: config.headers };
  }
};

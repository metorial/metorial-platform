import { createMCPClient, type MCPClient, type MCPTransport } from '@ai-sdk/mcp';
import type { ToolSet } from 'ai';
import type { SubspaceMcpToolList } from '../../../types';

export interface StdioMCPServer {
  type: 'stdio';
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
}

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

type ReusableHttpMcpTransportOptions = {
  url: string;
  headers?: Record<string, string>;
  connectionToken?: string | null;
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

let getHeader = (headers: Headers, name: string) =>
  headers.get(name) ?? headers.get(name.toLowerCase());

let parseSseMessages = (text: string): JsonRpcMessage[] => {
  let messages: JsonRpcMessage[] = [];
  let events = text.split(/\n\n+/g);

  for (let event of events) {
    let data = event
      .split(/\r?\n/g)
      .filter(line => line.startsWith('data:'))
      .map(line => line.slice('data:'.length).trimStart())
      .join('\n');

    if (!data) continue;
    messages.push(JSON.parse(data));
  }

  return messages;
};

export class ReusableHttpMcpTransport implements MCPTransport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JsonRpcMessage) => void;

  private abortController?: AbortController;
  private connectionToken?: string | null;

  constructor(private readonly options: ReusableHttpMcpTransportOptions) {
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

      let responses = await this.forward(message);

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

  private async forward(message: JsonRpcMessage): Promise<JsonRpcMessage[]> {
    let headers: Record<string, string> = {
      ...this.options.headers,
      Accept: 'application/json, text/event-stream',
      'Content-Type': 'application/json',
      'mcp-protocol-version': '2025-06-18'
    };

    if (this.connectionToken) {
      headers['MCP-Session-ID'] = this.connectionToken;
    }

    let response = await fetch(this.options.url, {
      method: 'POST',
      headers,
      body: JSON.stringify(message),
      signal: this.abortController?.signal
    });

    await this.captureConnectionHeaders(response.headers);

    if (response.status == 202 || response.status == 204 || !isRequest(message)) {
      return [];
    }

    if (!response.ok) {
      let text = await response.text().catch(() => '');
      throw new Error(
        `MCP request failed (${response.status}): ${text || response.statusText}`
      );
    }

    let contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
      let json = await response.json();
      return (Array.isArray(json) ? json : [json]) as JsonRpcMessage[];
    }

    if (contentType.includes('text/event-stream')) {
      return parseSseMessages(await response.text());
    }

    throw new Error(`Unexpected MCP response content type: ${contentType}`);
  }

  private async captureConnectionHeaders(headers: Headers) {
    let connectionId = getHeader(headers, 'Metorial-Connection-Id');
    let connectionToken =
      getHeader(headers, 'Metorial-Connection-Token') ?? getHeader(headers, 'Mcp-Session-Id');
    let mcpSessionId = getHeader(headers, 'Mcp-Session-Id');

    if (!connectionToken) return;
    this.connectionToken = connectionToken;

    if (!connectionId) return;
    await this.options.onConnection?.({
      connectionId,
      connectionToken,
      mcpSessionId
    });
  }
}

export type CustomMCPServer = {
  transport: MCPTransport | (() => MCPTransport | Promise<MCPTransport>);
  name?: string;
  version?: string;
  onUncaughtError?: (error: unknown) => void;
};

export type MCPServerConfig = StdioMCPServer | HttpMCPServer | SseMCPServer | CustomMCPServer;

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
    case 'stdio': {
      let { Experimental_StdioMCPTransport } = await import('@ai-sdk/mcp/mcp-stdio');
      return new Experimental_StdioMCPTransport({
        command: config.command,
        args: config.args,
        env: config.env,
        cwd: config.cwd
      });
    }

    case 'http':
      return { type: 'http' as const, url: config.url, headers: config.headers };

    case 'sse':
      return { type: 'sse' as const, url: config.url, headers: config.headers };
  }
};

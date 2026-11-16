import { afterAll, beforeAll } from 'vitest';

export interface McpTestTool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  handler: (args: Record<string, any>) => unknown | Promise<unknown>;
}

export interface McpTestRequest {
  method: string;
  params: any;
  headers: Record<string, string>;
}

export interface McpTestServerOptions {
  tools?: McpTestTool[];
  /** Requests without `Authorization: Bearer <token>` are rejected with 401. */
  bearerToken?: string;
  serverName?: string;
}

export interface McpTestServer {
  /** Streamable-HTTP endpoint, reachable from every service in the e2e stack. */
  url: string;
  port: number;
  /** Every JSON-RPC request and notification received, in order. */
  requests: McpTestRequest[];
  toolCalls: () => { name: string; arguments: Record<string, any> }[];
  stop: () => Promise<void>;
}

export let defaultMcpTestTools: McpTestTool[] = [
  {
    name: 'echo',
    description: 'Returns the given text',
    inputSchema: {
      type: 'object',
      properties: { text: { type: 'string' } },
      required: ['text']
    },
    handler: args => String(args.text)
  },
  {
    name: 'add',
    description: 'Adds two numbers',
    inputSchema: {
      type: 'object',
      properties: { a: { type: 'number' }, b: { type: 'number' } },
      required: ['a', 'b']
    },
    handler: args => String(Number(args.a) + Number(args.b))
  }
];

let toContent = (value: unknown) =>
  typeof value === 'string'
    ? { content: [{ type: 'text', text: value }] }
    : (value as Record<string, unknown>);

/**
 * A dependency-free, stateless streamable-HTTP MCP server bound inside the test process. Every
 * service of an e2e stack shares the runner's network namespace, so shuttle reaches it on
 * localhost (shuttle's e2e env bypasses its SSRF filter).
 */
export let startMcpTestServer = (options: McpTestServerOptions = {}): McpTestServer => {
  let tools = options.tools ?? defaultMcpTestTools;
  let requests: McpTestRequest[] = [];
  let sessionId = crypto.randomUUID();

  let handle = async (message: any) => {
    if (message.id === undefined || message.id === null) return undefined;

    let reply = (result: unknown) => ({ jsonrpc: '2.0', id: message.id, result });
    let fail = (code: number, text: string) => ({
      jsonrpc: '2.0',
      id: message.id,
      error: { code, message: text }
    });

    switch (message.method) {
      case 'initialize':
        return reply({
          protocolVersion: message.params?.protocolVersion ?? '2025-03-26',
          capabilities: { tools: { listChanged: false }, resources: {}, prompts: {} },
          serverInfo: { name: options.serverName ?? 'metorial-e2e', version: '1.0.0' }
        });

      case 'ping':
        return reply({});

      case 'tools/list':
        return reply({
          tools: tools.map(tool => ({
            name: tool.name,
            description: tool.description ?? tool.name,
            inputSchema: tool.inputSchema ?? { type: 'object', properties: {} }
          }))
        });

      case 'tools/call': {
        let tool = tools.find(item => item.name === message.params?.name);
        if (!tool) return fail(-32602, `Unknown tool: ${message.params?.name}`);
        try {
          return reply(toContent(await tool.handler(message.params?.arguments ?? {})));
        } catch (error) {
          return reply({
            isError: true,
            content: [
              { type: 'text', text: error instanceof Error ? error.message : String(error) }
            ]
          });
        }
      }

      case 'resources/list':
        return reply({ resources: [] });

      case 'resources/templates/list':
        return reply({ resourceTemplates: [] });

      case 'prompts/list':
        return reply({ prompts: [] });

      default:
        return fail(-32601, `Method not found: ${message.method}`);
    }
  };

  let server = Bun.serve({
    port: 0,
    hostname: '0.0.0.0',
    fetch: async request => {
      let url = new URL(request.url);
      if (url.pathname === '/health') return Response.json({ status: 'ok' });
      if (url.pathname !== '/mcp') return new Response('Not found', { status: 404 });

      if (
        options.bearerToken &&
        request.headers.get('authorization') !== `Bearer ${options.bearerToken}`
      ) {
        return Response.json({ error: 'unauthorized' }, { status: 401 });
      }

      if (request.method === 'DELETE') return new Response(null, { status: 200 });
      if (request.method !== 'POST') return new Response(null, { status: 405 });

      let body = await request.json();
      let messages = Array.isArray(body) ? body : [body];
      let headers = Object.fromEntries(request.headers);
      for (let message of messages) {
        requests.push({ method: message.method, params: message.params, headers });
      }

      let responses = (await Promise.all(messages.map(handle))).filter(Boolean);
      let responseHeaders = { 'mcp-session-id': sessionId };
      if (responses.length === 0) {
        return new Response(null, { status: 202, headers: responseHeaders });
      }

      return Response.json(Array.isArray(body) ? responses : responses[0], {
        headers: responseHeaders
      });
    }
  });

  return {
    url: `http://127.0.0.1:${server.port}/mcp`,
    port: server.port!,
    requests,
    toolCalls: () =>
      requests
        .filter(request => request.method === 'tools/call')
        .map(request => ({
          name: request.params?.name,
          arguments: request.params?.arguments ?? {}
        })),
    stop: async () => {
      await server.stop(true);
    }
  };
};

/** Starts one MCP test server per test file; the returned view is only readable inside tests. */
export let useMcpTestServer = (options: McpTestServerOptions = {}) => {
  let server: McpTestServer | undefined;

  beforeAll(() => {
    server = startMcpTestServer(options);
  });

  afterAll(async () => {
    await server?.stop();
  });

  return new Proxy({} as McpTestServer, {
    get: (_, property) => {
      if (!server)
        throw new Error('The MCP test server is only available inside tests and hooks');
      return server[property as keyof McpTestServer];
    }
  });
};

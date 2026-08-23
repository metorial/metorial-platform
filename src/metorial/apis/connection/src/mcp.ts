import { delay } from '@lowerdeck/delay';
import type { Instance } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import {
  handleMcpRequest as handleSubspaceMcpRequest,
  McpConnection
} from '@metorial-subspace/module-connection';
import { subspaceScopeService } from '@metorial-subspace/module-tenant';
import type { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';
import type { Context } from 'hono';
import { streamSSE } from 'hono/streaming';
import z from 'zod';

let agentClientSchema = z.discriminatedUnion('type', [
  z.object({
    name: z.string(),
    type: z.literal('mcp_client_oauth'),
    privateMetadata: z.record(z.string(), z.any()).optional(),
    oauthRegistrationId: z.string(),
    foreignId: z.string()
  }),
  z.object({
    name: z.string(),
    type: z.literal('system_client'),
    privateMetadata: z.record(z.string(), z.any()).optional(),
    foreignId: z.string()
  })
]);

let privateMetadataSchema = z.record(z.string(), z.any());

export type ConnectionMcpAgentClient = z.infer<typeof agentClientSchema>;

let parseOptionalJsonHeader = <T>(
  value: string | undefined,
  schema: z.ZodSchema<T>,
  name: string
) => {
  if (!value) return { success: true as const, data: undefined };

  try {
    let parsed = schema.safeParse(JSON.parse(value));
    if (parsed.success) return { success: true as const, data: parsed.data };
  } catch {}

  return { success: false as const, message: `Invalid ${name} header value` };
};

let publicProxyUrl = (c: Context) => {
  let inputUrl = new URL(c.req.url);
  let hostname = inputUrl.hostname;

  if (
    hostname.endsWith('.metorial.com') &&
    (hostname.startsWith('api-') ||
      hostname.startsWith('connect-') ||
      hostname.startsWith('mcp-'))
  ) {
    let identifier = hostname.split('.')[0]!.split('-')[0]!;
    hostname = `${identifier}.metorial.com`;
  }

  return process.env.NODE_ENV == 'production'
    ? `https://${hostname}${inputUrl.pathname}${inputUrl.search}`
    : `http://${inputUrl.host}${inputUrl.pathname}${inputUrl.search}`;
};

let applyConnectionHeaders = (
  c: Context,
  connection: {
    session: { id: string };
    connection?: { id: string; token: string } | null;
  }
) => {
  // Mutate the live response headers in place. `c.header()` after streamSSE
  // returns recreates the Response from `.body`, which steals the stream and
  // closes the SSE connection with Content-Length: 0.
  c.res.headers.set('Metorial-Session-Id', connection.session.id);
  if (connection.connection) {
    c.res.headers.set('Mcp-Session-Id', connection.connection.token);
    c.res.headers.set('Metorial-Connection-Id', connection.connection.id);
    c.res.headers.set('Metorial-Connection-Token', connection.connection.token);
  }
};

export let handleMcpRequest = async (
  c: Context,
  d: {
    instance: Instance;
    sessionId: string;
    agentClient?: ConnectionMcpAgentClient | null;
    enforceIngressNetworkPolicy?: boolean;
    ingressIp?: string | null;
    onSubspaceSessionResolved?: (d: {
      subspaceSessionId: string;
      response: Response;
    }) => Promise<void> | void;
  }
) => {
  let { tenant, solution } = await subspaceScopeService.ensureForInstance(d.instance);
  let connectionToken =
    c.req.header('mcp-session-id') || c.req.query('connection_token') || undefined;
  let transport: 'sse' | 'streamable_http' =
    connectionToken || (c.req.method === 'POST' && !c.req.query('connection_token'))
      ? 'streamable_http'
      : 'sse';
  let proxyUrl = publicProxyUrl(c);

  let privateMetadata = parseOptionalJsonHeader(
    c.req.header('metorial-connection-private-metadata'),
    privateMetadataSchema,
    'Metorial-Connection-Private-Metadata'
  );
  if (!privateMetadata.success) return c.text(privateMetadata.message, 400);

  let ingressPolicyCheck:
    | {
        sourceIp: string;
        hostname?: string;
        port?: number;
        recordLog?: boolean;
      }
    | undefined;

  if (d.enforceIngressNetworkPolicy) {
    if (!d.ingressIp) return c.text('Missing ingress IP', 400);
    let parsedProxyUrl = new URL(proxyUrl);
    ingressPolicyCheck = {
      sourceIp: d.ingressIp,
      hostname: parsedProxyUrl.hostname,
      port: parsedProxyUrl.port
        ? Number(parsedProxyUrl.port)
        : parsedProxyUrl.protocol === 'https:'
          ? 443
          : 80,
      recordLog: true
    };
  }

  let connectionInput = {
    connectionToken,
    sessionId: d.sessionId,
    solutionId: solution.id,
    tenantId: tenant.id,
    mcpTransport: transport,
    agentClient: d.agentClient ?? undefined,
    connectionPrivateMetadata: privateMetadata.data,
    ingressPolicyCheck
  };

  await Fabric.fire('provider.session_message.created:before', { instance: d.instance });

  let finish = async (response: Response, connection: McpConnection) => {
    applyConnectionHeaders(c, connection);
    let headers = new Headers(response.headers);
    for (let [key, value] of c.res.headers) headers.set(key, value);
    let finalResponse = new Response(response.body, {
      status: response.status,
      headers
    });
    await d.onSubspaceSessionResolved?.({
      subspaceSessionId: connection.session.id,
      response: finalResponse
    });
    return finalResponse;
  };

  if (transport === 'sse') {
    if (c.req.method === 'GET') {
      let connection = await McpConnection.create(connectionInput);
      applyConnectionHeaders(c, connection);
      await d.onSubspaceSessionResolved?.({
        subspaceSessionId: connection.session.id,
        response: c.res
      });

      return streamSSE(c, async stream => {
        let listener = await connection.listener({ selectedChannels: 'all' });
        stream.onAbort(async () => await listener.close());
        let created = await connection.createConnection();
        let endpoint = new URL(proxyUrl);
        endpoint.searchParams.set('connection_token', created.token);
        applyConnectionHeaders(c, connection);
        await stream.writeSSE({ event: 'endpoint', data: endpoint.toString() });

        for await (let event of listener.iterator()) {
          await stream.writeSSE({
            id: event.message?.id,
            data: JSON.stringify(event.mcp)
          });
        }
      });
    }

    if (c.req.method === 'POST') {
      let message = await readMessage(c);
      if (message instanceof Response) return message;
      let { connection } = await handleSubspaceMcpRequest({
        ...connectionInput,
        message,
        waitForResponse: false
      });
      return finish(c.text('OK', 200), connection);
    }

    return c.text('Method Not Allowed', 405);
  }

  if (c.req.method === 'GET') {
    if (!connectionToken) return c.text('Mcp-Session-Id header must be set', 400);
    let connection = await McpConnection.create(connectionInput);
    applyConnectionHeaders(c, connection);
    let lastMessageId = c.req.header('Last-Event-ID');

    return streamSSE(c, async stream => {
      let listener = await connection.listener({
        selectedChannels: 'broadcast',
        replayFromMessageId: lastMessageId
      });
      stream.onAbort(async () => await listener.close());

      for await (let event of listener.iterator()) {
        await stream.writeSSE({
          id: event.message?.id,
          data: JSON.stringify(event.mcp)
        });
      }
    });
  }

  if (c.req.method === 'POST') {
    let message = await readMessage(c);
    if (message instanceof Response) return message;
    let progress: JSONRPCMessage[] = [];
    let { connection, response } = await handleSubspaceMcpRequest({
      ...connectionInput,
      message,
      waitForResponse: true,
      onProgress: async event => {
        progress.push(event);
      }
    });

    if (!response && progress.length === 0) {
      return finish(new Response(null, { status: 202 }), connection);
    }

    return finish(
      await sseResponse([
        ...progress,
        response?.mcp ?? {
          jsonrpc: '2.0',
          id: 'id' in message ? message.id : undefined,
          error: {
            code: -32603,
            message: 'No response produced for MCP request'
          }
        }
      ]),
      connection
    );
  }

  if (c.req.method === 'DELETE') {
    let connection = await McpConnection.create(connectionInput);
    await connection.disableConnection();
    return finish(c.text('OK', 200), connection);
  }

  return c.text('Method Not Allowed', 405);
};

let readMessage = async (c: Context): Promise<JSONRPCMessage | Response> => {
  try {
    return (await c.req.json()) as JSONRPCMessage;
  } catch {
    return c.text('Invalid JSON body', 400);
  }
};

let sseResponse = async (messages: JSONRPCMessage[]) => {
  let body = messages.map(message => `data: ${JSON.stringify(message)}\n\n`).join('');
  await delay(100);
  return new Response(body, {
    headers: { 'Content-Type': 'text/event-stream' }
  });
};

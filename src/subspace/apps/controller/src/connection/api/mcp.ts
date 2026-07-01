import { delay } from '@lowerdeck/delay';
import { createHono } from '@lowerdeck/hono';
import { McpConnection } from '@metorial-subspace/module-connection';
import { streamSSE } from 'hono/streaming';
import z from 'zod';

let isDev = process.env.NODE_ENV !== 'production';

type Transports = 'sse' | 'streamable_http';

let agentClientHeaderSchema = z.discriminatedUnion('type', [
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

let privateMetadataHeaderSchema = z.record(z.string(), z.any());

let parseOptionalJsonHeader = <T>(
  value: string | undefined,
  schema: z.ZodSchema<T>,
  name: string
) => {
  if (!value) return { success: true as const, data: undefined };

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(value);
  } catch {
    return { success: false as const, message: `Invalid ${name} header JSON` };
  }

  let parsed = schema.safeParse(parsedJson);
  if (!parsed.success) {
    return { success: false as const, message: `Invalid ${name} header value` };
  }

  return { success: true as const, data: parsed.data };
};

let isLongRunningMcpMethod = (method: unknown) => {
  return method === 'tools/call' || method === 'prompts/get' || method === 'resources/read';
};

export let mcpRouter = createHono().all(`/:key?`, async c => {
  if (isDev) {
    c.res.headers.set('Access-Control-Allow-Origin', '*');
    c.res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE');
    c.res.headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Metorial-Proxy-URL, Metorial-Agent-Client, Metorial-Connection-Private-Metadata, Metorial-Ingress-Policy-Check, Metorial-Ingress-IP, MCP-Protocol-Version, MCP-Session-ID, Authorization,  baggage, sentry-trace'
    );
    c.res.headers.set('Access-Control-Allow-Credentials', 'true');
    c.res.headers.set(
      'Access-Control-Expose-Headers',
      'Metorial-Connection-Id, Metorial-Connection-Token, Metorial-Session-Id, MCP-Session-ID'
    );

    if (c.req.method === 'OPTIONS') {
      return c.text('OK', 200);
    }
  }

  let queryConnectionId = c.req.query('connection_token');
  let mcpSessionId = c.req.header('mcp-session-id');

  let transport: Transports = 'sse';
  if (mcpSessionId || (c.req.method === 'POST' && !queryConnectionId))
    transport = 'streamable_http';

  let baseParams = {
    connectionToken: mcpSessionId || queryConnectionId,
    sessionId: c.req.param('sessionId')!,
    solutionId: c.req.param('solutionId')!,
    tenantId: c.req.param('tenantId')!,
    mcpTransport: transport,
    agentClient: undefined as z.infer<typeof agentClientHeaderSchema> | undefined,
    connectionPrivateMetadata: undefined as
      | z.infer<typeof privateMetadataHeaderSchema>
      | undefined,
    ingressPolicyCheck: undefined as
      | {
          sourceIp: string;
          hostname?: string;
          port?: number;
          recordLog?: boolean;
        }
      | undefined
  };

  let metorialProxyUrl = c.req.header('metorial-proxy-url');
  if (!metorialProxyUrl) {
    if (!isDev) return c.text('Missing Metorial-Proxy-URL header', 400);
    metorialProxyUrl = c.req.url;
  }

  let enforceIngressPolicy = c.req.header('metorial-ingress-policy-check') === 'true';
  if (enforceIngressPolicy) {
    let sourceIp = c.req.header('metorial-ingress-ip');
    if (!sourceIp) return c.text('Missing Metorial-Ingress-IP header', 400);

    let proxyUrl = new URL(metorialProxyUrl);
    let port = proxyUrl.port
      ? Number(proxyUrl.port)
      : proxyUrl.protocol === 'https:'
        ? 443
        : proxyUrl.protocol === 'http:'
          ? 80
          : 0;

    baseParams.ingressPolicyCheck = {
      sourceIp,
      hostname: proxyUrl.hostname,
      port,
      recordLog: true
    };
  }

  let agentClientHeader = parseOptionalJsonHeader(
    c.req.header('metorial-agent-client'),
    agentClientHeaderSchema,
    'Metorial-Agent-Client'
  );
  if (!agentClientHeader.success) return c.text(agentClientHeader.message, 400);

  let connectionPrivateMetadataHeader = parseOptionalJsonHeader(
    c.req.header('metorial-connection-private-metadata'),
    privateMetadataHeaderSchema,
    'Metorial-Connection-Private-Metadata'
  );
  if (!connectionPrivateMetadataHeader.success) {
    return c.text(connectionPrivateMetadataHeader.message, 400);
  }

  baseParams.agentClient = agentClientHeader.data;
  baseParams.connectionPrivateMetadata = connectionPrivateMetadataHeader.data;

  if (transport === 'sse') {
    if (c.req.method === 'GET') {
      return streamSSE(c, async stream => {
        let con = await McpConnection.create(baseParams);

        let listenerStream = await con.listener({ selectedChannels: 'all' });

        stream.onAbort(async () => {
          await listenerStream.close();
        });

        let connection = await con.createConnection();
        let endpoint = new URL(metorialProxyUrl);
        endpoint.searchParams.set('connection_token', connection.token);

        c.res.headers.set('Metorial-Session-Id', con.session.id);
        if (con.connection) {
          c.res.headers.set('Mcp-Session-Id', con.connection.token);
          c.res.headers.set('Metorial-Connection-Id', con.connection.id);
          c.res.headers.set('Metorial-Connection-Token', con.connection.token);
        }

        await stream.writeSSE({
          event: 'endpoint',
          data: endpoint.toString()
        });

        for await (let event of listenerStream.iterator()) {
          await stream.writeSSE({
            id: event.message?.id,
            data: JSON.stringify(event.mcp)
          });
        }
      });
    }

    if (c.req.method === 'POST') {
      let json: any;
      try {
        json = await c.req.json();
      } catch {
        return c.text('Invalid JSON body', 400);
      }

      let con = await McpConnection.create(baseParams);

      c.res.headers.set('Metorial-Session-Id', con.session.id);
      if (con.connection) {
        c.res.headers.set('Mcp-Session-Id', con.connection.token);
        c.res.headers.set('Metorial-Connection-Id', con.connection.id);
        c.res.headers.set('Metorial-Connection-Token', con.connection.token);
      }

      await con.handleMessage(json, {
        waitForResponse: false
      });

      return c.text('OK', 200);
    }

    return c.text('Method Not Allowed', 405);
  } else {
    if (c.req.method === 'GET') {
      if (!baseParams.connectionToken) {
        return c.text('Mcp-Session-Id header must be set for this endpoint', 400);
      }

      let con = await McpConnection.create(baseParams);

      c.res.headers.set('Metorial-Session-Id', con.session.id);
      if (con.connection) {
        c.res.headers.set('Mcp-Session-Id', con.connection.token);
        c.res.headers.set('Metorial-Connection-Id', con.connection.id);
        c.res.headers.set('Metorial-Connection-Token', con.connection.token);
      }

      let lastMessageId = c.req.header('Last-Event-ID');

      return streamSSE(c, async stream => {
        let listenerStream = await con.listener({
          selectedChannels: 'broadcast',
          replayFromMessageId: lastMessageId
        });

        stream.onAbort(async () => {
          await listenerStream.close();
        });

        for await (let event of listenerStream.iterator()) {
          await stream.writeSSE({
            id: event.message?.id,
            data: JSON.stringify(event.mcp)
          });
        }
      });
    }

    if (c.req.method === 'POST') {
      let json: any;
      try {
        json = await c.req.json();
      } catch {
        return c.text('Invalid JSON body', 400);
      }

      let con = await McpConnection.create(baseParams);

      c.res.headers.set('Metorial-Session-Id', con.session.id);
      if (con.connection) {
        c.res.headers.set('Mcp-Session-Id', con.connection.token);
        c.res.headers.set('Metorial-Connection-Id', con.connection.id);
        c.res.headers.set('Metorial-Connection-Token', con.connection.token);
      }

      if (isLongRunningMcpMethod(json?.method)) {
        return streamSSE(c, async stream => {
          let res = await con.handleMessageWithProgress(
            json,
            {
              waitForResponse: true
            },
            async event => {
              await stream.writeSSE({
                data: JSON.stringify(event.mcp)
              });
            }
          );

          if (!res || !res.mcp) {
            return;
          }

          await stream.writeSSE({
            id: res.message?.id,
            data: JSON.stringify(res.mcp)
          });

          await delay(100);
        });
      }

      let res = await con.handleMessage(json, {
        waitForResponse: true
      });

      if (!res) {
        // return streamSSE(c, async stream => {
        //   await delay(100); // ensure the message is sent before closing
        // });

        // if (!res) return c.text('No response');

        return new Response(null, {
          status: 202,
          headers: c.res.headers
        });
      }

      if (!res?.mcp) {
        return new Response(null, { status: 202 });
      }

      return streamSSE(c, async stream => {
        await stream.writeSSE({
          id: res.message?.id,
          data: JSON.stringify(res.mcp)
        });

        await delay(100); // ensure the message is sent before closing
      });

      // return c.json(res.mcp);
    }

    if (c.req.method === 'DELETE') {
      let con = await McpConnection.create(baseParams);

      c.res.headers.set('Metorial-Session-Id', con.session.id);
      if (con.connection) {
        c.res.headers.set('Mcp-Session-Id', con.connection.token);
        c.res.headers.set('Metorial-Connection-Id', con.connection.id);
        c.res.headers.set('Metorial-Connection-Token', con.connection.token);
      }

      await con.disableConnection();
      return c.text('OK', 200);
    }

    return c.text('Method Not Allowed', 405);
  }
});

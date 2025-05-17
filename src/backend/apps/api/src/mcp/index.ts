import { debug } from '@metorial/debug';
import {
  badRequestError,
  conflictError,
  internalServerError,
  methodNotAllowedError,
  notFoundError,
  ServiceError,
  unauthorizedError
} from '@metorial/error';
import { createHono } from '@metorial/hono';
import { JSONRPCMessageSchema, McpError, type JSONRPCMessage } from '@metorial/mcp-utils';
import type { ServerWebSocket } from 'bun';
import { createBunWebSocket } from 'hono/bun';
import { streamSSE } from 'hono/streaming';

let CONNECTION_TYPES = ['sse', 'websocket', 'streamable_http'] as const;
let CONNECTION_TYPE_ALIASES: {
  [K in (typeof CONNECTION_TYPES)[number]]: [K, ...string[]];
} = {
  sse: ['sse', 'server-sent-events', '2024-11-05'],
  streamable_http: ['streamable_http', 'streamable-http', 'http', '2025-03-26'],
  websocket: ['websocket', 'ws']
};
let ALIAS_TO_CONNECTION_TYPE = new Map(
  Object.entries(CONNECTION_TYPE_ALIASES).flatMap(([key, value]) =>
    value.map(v => [v, key] as [string, (typeof CONNECTION_TYPES)[number]])
  )
);

let { upgradeWebSocket, websocket } = createBunWebSocket<ServerWebSocket>();
export { websocket as mcpWebSocket };

let tryParseMessages = (data: any) => {
  let dataArray = Array.isArray(data) ? data : [data];

  return dataArray.map(item => {
    let valRes = JSONRPCMessageSchema.safeParse(item);
    if (!valRes.success) {
      return {
        status: 'error' as const,
        error: new McpError('invalid_request', {
          message: 'Invalid message format',
          details: valRes.error.flatten().fieldErrors
        })
      };
    }

    return {
      status: 'ok' as const,
      message: valRes.data
    };
  });
};

export let mcpController = createHono()
  .use(async (c, next) => {
    await next();

    c.res.headers.set('Access-Control-Allow-Origin', c.req.header('Origin') || '*');
    c.res.headers.set(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, OPTIONS, PATCH'
    );
    c.res.headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, metorial-include-debug-messages'
    );
    c.res.headers.set('Access-Control-Allow-Credentials', 'true');
  })
  .options('*', c => {
    return c.text('');
  })
  .all('/:serverInstanceId/:connectionType?', async (c, next) => {
    let { serverInstanceId, connectionType: connectionTypeParam } = c.req.param();
    let { signal: requestCloseSignal } = c.req.raw;

    let connectionType = connectionTypeParam
      ? ALIAS_TO_CONNECTION_TYPE.get(connectionTypeParam)
      : undefined;

    if (connectionTypeParam && !connectionType) {
      throw new ServiceError(
        badRequestError({
          message: `Invalid connection type. Supported types are: ${CONNECTION_TYPES.join(', ')}`
        })
      );
    }

    let authToken = parseBearerToken(c.req.header('Authorization'));

    let token = await tokenService.authenticateWithToken({
      tokenSecret: 'metorial_mcp_yErKYJzJPt1yGNWTUMRYQCj64LB87NfeSCIp6E8FRVMtg8MGLD' //
    });
    if (!token.scopes.includes('session_read_write')) {
      throw new ServiceError(
        unauthorizedError({
          message: 'Token does not have the required scopes',
          scopes: ['session_read_write']
        })
      );
    }

    let serverInstance = await serverInstanceService.getServerInstance({
      actor: token.actor,
      serverInstanceId
    });

    let sessionId = c.req.query('session_id') ?? c.req.header('mcp-session-id');
    let withDebugMessages = c.req.header('metorial-include-debug-messages') == 'true';

    let session: (Session & { actor: Actor }) | undefined;
    let sessionCreated = false;

    if (sessionId) {
      let foundSession = await sessionService.getSession({
        actor: token.actor,
        sessionId
      });
      if (foundSession.status == 'archived') {
        throw new ServiceError(
          badRequestError({ message: 'Cannot connect to archived session' })
        );
      }

      if (!foundSession) throw new ServiceError(notFoundError('session'));
      if (foundSession.serverInstanceOid != serverInstance.oid)
        throw new ServiceError(
          conflictError({ message: 'Session does not belong to this server instance' })
        );

      session = {
        ...foundSession,
        actor: token.actor
      };
    }

    if (c.req.method == 'DELETE') {
      if (!session) {
        throw new ServiceError(
          badRequestError({
            message: 'Session ID is required to delete a session'
          })
        );
      }

      let connection = new SessionConnection(session, {
        mode: 'send-only',
        receiveControlMessages: false
      });

      await connection.stop();

      return c.text('Deleted', 200);
    }

    if (!session) {
      let newSession = await sessionService.createSession({
        actor: token.actor,
        serverInstance: serverInstance
      });
      session = {
        ...newSession,
        actor: token.actor
      };

      sessionCreated = true;
    }

    c.res.headers.set('Mcp-Session-Id', session.id);
    c.res.headers.set('Metorial-Gateway-Session-Id', session.id);
    c.res.headers.set('Metorial-Gateway-Server-Id', serverInstance.server.id);
    c.res.headers.set('Metorial-Gateway-Server-Instance-Id', serverInstance.id);

    let isWebsocketConnection =
      c.req.header('Upgrade') == 'websocket' || c.req.header('Connection') == 'Upgrade';
    if (!connectionType && isWebsocketConnection) connectionType = 'websocket';
    if (isWebsocketConnection && connectionType != 'websocket') {
      throw new ServiceError(
        badRequestError({
          message: `Invalid connection type for websocket request.`
        })
      );
    }

    let ensureReceiveConnection = () => {
      let connection = new SessionConnection(session, {
        mode: 'send-and-receive',
        receiveControlMessages: true
      });

      let close = async () => {
        debug.log('MCP connection closed');
        connection.close();
      };

      let onDebug = (cb: (msg: JSONRPCMessage) => Promise<any>) => {
        connection.onDebug(async msg => {
          debug.log('MCP DEBUG message - out', msg);

          await cb({
            jsonrpc: '2.0',
            method: `notifications/metorial_gateway/debug/${msg.type}`,
            params: msg.payload
          } satisfies JSONRPCMessage);
        });
      };

      let onMessage = (cb: (msg: JSONRPCMessage) => Promise<any>) => {
        connection.onMessage(
          {
            type: ['error', 'notification', 'response', 'request']
          },
          async msg => {
            debug.log('MCP message - out', msg);
            await cb(msg);
          }
        );
      };

      return [connection, onMessage, onDebug, close] as const;
    };

    let handleMessage = async (data: any, connection?: SessionConnection) => {
      if (typeof data == 'string') {
        try {
          data = JSON.parse(data);
        } catch (e) {
          throw new McpError('parse_error');
        }
      }

      connection =
        connection ??
        new SessionConnection(session, {
          mode: 'send-only',
          receiveControlMessages: true
        });

      let [res] = tryParseMessages(data);
      if (res.status == 'error') throw res.error;

      await connection.sendMessage(res.message);
    };

    if (connectionType == 'websocket') {
      let [connection, onMessage, onDebug, close] = ensureReceiveConnection();

      return upgradeWebSocket(c => ({
        onClose: () => close(),
        onError: () => close(),

        onOpen: (e, ws) => {
          if (withDebugMessages) onDebug(async msg => ws.send(JSON.stringify(msg)));
          onMessage(async msg => ws.send(JSON.stringify(msg)));

          ws.send(
            JSON.stringify({
              jsonrpc: '2.0',
              method: `notifications/metorial_gateway/debug/init`,
              params: {
                sessionId: session.id,
                serverInstanceId: serverInstance.id
              }
            } satisfies JSONRPCMessage)
          );
        },

        onMessage: async (e, ws) => {
          let data = e.data;
          if (typeof data != 'string') {
            ws.send(JSON.stringify({ error: 'Invalid message encoding, expected string' }));
          }

          try {
            await handleMessage(data, connection);
          } catch (e) {
            if (e instanceof ServiceError || e instanceof McpError) {
              ws.send(JSON.stringify(e.toResponse()));
            } else {
              ws.send(JSON.stringify(internalServerError().toResponse()));
            }
          }
        }
      }))(c, next);
    }

    // Guess the connection type if not provided
    if (!connectionType) {
      connectionType = (() => {
        if (session.mcpVersion) {
          if (session.mcpVersion == '2024-11-05') return 'sse';
          if (session.mcpVersion == '2025-03-26') return 'streamable_http';
        }

        if (sessionCreated && c.req.method == 'GET') return 'sse';
        if (sessionCreated && c.req.method == 'POST') return 'streamable_http';

        return 'sse';
      })();
    }

    if (connectionType == 'sse') {
      if (c.req.method == 'GET') {
        let [connection, onMessage, onDebug, close] = ensureReceiveConnection();
        requestCloseSignal.addEventListener('abort', close);

        return streamSSE(
          c,
          async stream => {
            if (sessionCreated) {
              let endpointUrl = new URL(
                `/mcp/${serverInstance.identifier}/sse?session_id=${session.id}`,
                env.API_HOST
              ).toString();

              await stream.writeSSE({
                event: 'endpoint',
                data: endpointUrl
              });

              if (withDebugMessages) {
                await stream.writeSSE({
                  data: JSON.stringify({
                    jsonrpc: '2.0',
                    method: `notifications/metorial_gateway/debug/init`,
                    params: {
                      sessionId: session.id,
                      serverInstanceId: serverInstance.id
                    }
                  } satisfies JSONRPCMessage)
                });
              }
            }

            if (withDebugMessages) {
              onDebug(async msg => stream.writeSSE({ data: JSON.stringify(msg) }));
            }

            onMessage(async msg => stream.writeSSE({ data: JSON.stringify(msg) }));

            await connection.waitForClose;
          },
          async error => {
            console.error('Error in SSE stream', error);
          }
        );
      }

      if (c.req.method == 'POST') {
        if (sessionCreated) {
          throw new McpError('invalid_request', {
            message: 'Cannot send messages to empty session'
          });
        }

        let data: any;
        try {
          data = await c.req.json<JSONRPCMessage>();
        } catch (e) {
          throw new McpError('parse_error');
        }

        await handleMessage(data);

        return c.text('Accepted', 202);
      }
    }

    if (connectionType == 'streamable_http') {
      if (c.req.method == 'POST') {
        let [connection, onMessage, onDebug, close] = ensureReceiveConnection();
        requestCloseSignal.addEventListener('abort', close);

        let data: any;
        try {
          data = await c.req.json<JSONRPCMessage | JSONRPCMessage[]>();
        } catch (e) {
          throw new McpError('parse_error');
        }

        return streamSSE(
          c,
          async stream => {
            if (sessionCreated) {
              if (withDebugMessages) {
                await stream.writeSSE({
                  data: JSON.stringify({
                    jsonrpc: '2.0',
                    method: `notifications/metorial_gateway/debug/init`,
                    params: {
                      sessionId: session.id,
                      serverInstanceId: serverInstance.id
                    }
                  } satisfies JSONRPCMessage)
                });
              }
            }

            if (withDebugMessages) {
              onDebug(async msg => stream.writeSSE({ data: JSON.stringify(msg) }));
            }

            let messages = tryParseMessages(data);

            let errors = messages.filter(m => m.status == 'error');
            if (errors.length) {
              for (let error of errors) {
                await stream.writeSSE({
                  data: JSON.stringify(error.error.toResponse())
                });
              }
            }

            await connection.sendMessagesAndWaitForResponse(
              messages.filter(m => m.status == 'ok').map(m => m.message),
              async (msg, stor) =>
                stream.writeSSE({
                  id: stor?.unifiedId ?? undefined,
                  data: JSON.stringify(msg)
                })
            );

            await connection.close();
          },
          async error => {
            console.error('Error in SSE stream', error);
          }
        );
      }

      if (c.req.method == 'GET') {
        let [connection, onMessage, onDebug, close] = ensureReceiveConnection();
        requestCloseSignal.addEventListener('abort', close);

        let lastEventId = c.req.header('Last-Event-ID');

        return streamSSE(
          c,
          async stream => {
            if (withDebugMessages) {
              onDebug(async msg => stream.writeSSE({ data: JSON.stringify(msg) }));
            }

            connection.onMessage(
              {
                type: ['notification', 'request'],
                pull: {
                  afterId: lastEventId,
                  type: ['error', 'notification', 'response', 'request']
                }
              },
              async msg => stream.writeSSE({ data: JSON.stringify(msg) })
            );

            await connection.waitForClose;
          },
          async error => {
            console.error('Error in SSE stream', error);
          }
        );
      }
    }

    return c.json(methodNotAllowedError().toResponse(), 405);
  });

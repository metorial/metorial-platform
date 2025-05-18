import { getConfig } from '@metorial/config';
import { ServerDeployment, ServerSession, ServerVariant } from '@metorial/db';
import {
  badRequestError,
  internalServerError,
  methodNotAllowedError,
  ServiceError
} from '@metorial/error';
import { JSONRPCMessage, McpError } from '@metorial/mcp-utils';
import type { ServerWebSocket } from 'bun';
import { Context, Next } from 'hono';
import { streamSSE } from 'hono/streaming';
import { UpgradeWebSocket, WSEvents } from 'hono/ws';
import { McpServerConnection, tryParseMessages } from './connection';
import { ALIAS_TO_CONNECTION_TYPE, CONNECTION_TYPES } from './constants';
import { SessionInfo } from './getSession';

export let mcpConnectionHandler = async (
  c: Context,
  next: Next,
  sessionInfo: SessionInfo,
  serverSession: ServerSession & {
    serverDeployment: ServerDeployment & {
      serverVariant: ServerVariant;
    };
  },
  opts: {
    connectionType: string;
    sessionCreated?: boolean;
    upgradeWebSocket: UpgradeWebSocket<
      ServerWebSocket<undefined>,
      any,
      WSEvents<ServerWebSocket<undefined>>
    >;
  }
) => {
  let { signal: requestCloseSignal } = c.req.raw;

  let connectionType = opts.connectionType
    ? ALIAS_TO_CONNECTION_TYPE.get(opts.connectionType)
    : undefined;
  if (!connectionType) {
    throw new ServiceError(
      badRequestError({
        message: `Invalid connection type. Supported types are: ${CONNECTION_TYPES.join(', ')}`
      })
    );
  }

  c.res.headers.set('Mcp-Session-Id', sessionInfo.session.id);
  c.res.headers.set('Metorial-Session-Id', sessionInfo.session.id);

  if (c.req.method == 'DELETE') {
    // TODO: Handle this like a session delete

    throw new ServiceError(
      methodNotAllowedError({
        hint: 'Use DELETE /sessions/<sessionId> to delete a session'
      })
    );
  }

  let isWebsocketConnection =
    c.req.header('Upgrade') == 'websocket' || c.req.header('Connection') == 'Upgrade';
  if (isWebsocketConnection && connectionType != 'websocket') {
    throw new ServiceError(
      badRequestError({
        message: `Invalid connection type for websocket request.`
      })
    );
  }

  let manager = new McpServerConnection(sessionInfo.session, serverSession);

  if (connectionType == 'websocket') {
    let { onMessage, close } = manager.ensureReceiveConnection();

    return opts.upgradeWebSocket(c => ({
      onClose: () => close(),
      onError: () => close(),

      onOpen: (e, ws) => {
        onMessage(async msg => ws.send(JSON.stringify(msg)));
      },

      onMessage: async (e, ws) => {
        let data = e.data;
        if (typeof data != 'string') {
          ws.send(JSON.stringify({ error: 'Invalid message encoding, expected string' }));
        }

        try {
          await manager.handleMessage(data);
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

  if (connectionType == 'sse') {
    if (c.req.method == 'GET') {
      let { connection, onMessage, close } = manager.ensureReceiveConnection();
      requestCloseSignal.addEventListener('abort', close);

      return streamSSE(
        c,
        async stream => {
          if (opts.sessionCreated) {
            let endpointUrl = new URL(
              `/mcp/${sessionInfo.session.id}/${serverSession.serverDeployment.id}/sse?metorial_server_session_id=${serverSession.id}`,
              getConfig().urls.mcpUrl
            ).toString();

            await stream.writeSSE({
              event: 'endpoint',
              data: endpointUrl
            });
          }

          onMessage(async msg => stream.writeSSE({ data: JSON.stringify(msg) }));

          console.log('MCP SSE connection opened');

          await connection.waitForClose;

          console.log('MCP SSE connection closed');
        },
        async error => {
          console.error('Error in SSE stream', error);
        }
      );
    }

    if (c.req.method == 'POST') {
      if (opts.sessionCreated) {
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

      await manager.handleMessage(data);

      return c.text('Accepted', 202);
    }
  }

  if (connectionType == 'streamable_http') {
    if (c.req.method == 'POST') {
      let { connection, onMessage, close } = manager.ensureReceiveConnection();
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
      let { connection, onMessage, close } = manager.ensureReceiveConnection();
      requestCloseSignal.addEventListener('abort', close);

      let lastEventId = c.req.header('Last-Event-ID') || undefined;

      return streamSSE(
        c,
        async stream => {
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
};

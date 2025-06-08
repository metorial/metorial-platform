import { debug } from '@metorial/debug';
import {
  badRequestError,
  internalServerError,
  isServiceError,
  methodNotAllowedError,
  notFoundError,
  ServiceError,
  unauthorizedError
} from '@metorial/error';
import { MICSessionManger } from '@metorial/interconnect';
import {
  isMcpError,
  JSONRPCMessageSchema,
  McpError,
  type JSONRPCMessage
} from '@metorial/mcp-utils';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { McpSessionManager } from '../lib/session/manager';
import { SessionTokens } from '../lib/tokens';

export interface RunnerServerRef {
  mic?: MICSessionManger;
}

export let getServer = (origin: string, ref: RunnerServerRef) =>
  new Hono()
    .onError((err, c) => {
      debug.error(err);

      if (isServiceError(err)) return c.json(err.toResponse(), err.data.status);
      if (isMcpError(err)) return c.json(err.toResponse(), 400);

      return c.json(internalServerError().toResponse(), 500);
    })
    .notFound(c => c.json(notFoundError('endpoint').toResponse(), 404))
    .get('/ping', c => c.text('ok', 200))
    .use(async (c, next) => {
      await next();
    })
    .all('/mcp/sse', async c => {
      if (!ref.mic) return c.text('INITIALIZING', 503);

      if (c.req.method == 'OPTIONS') return c.text('', 200);

      let tokenStr =
        c.req.header('Metorial-Runner-Token') ?? c.req.query('metorial-runner-token');
      if (!tokenStr)
        return c.json(unauthorizedError({ message: 'Missing token' }).toResponse(), 400);

      let token = await SessionTokens.verify(tokenStr);

      let rawReq = c.req.raw;

      let sessionRes = await McpSessionManager.getSession(token.sessionId);
      // If the session is stopped, we need to stop the connection
      if (sessionRes.type == 'stopped') return streamSSE(c, async () => {});

      let { session, info: sessionInfo } = sessionRes;

      if (c.req.method == 'GET') {
        rawReq.signal.addEventListener('abort', async () => {
          debug.log('MCP connection closed');
          session.stop();
        });

        return await streamSSE(c, async stream => {
          try {
            let endpointUrl = new URL(
              `/mcp/sse?metorial-runner-token=${tokenStr}`,
              origin
            ).toString();

            await stream.writeSSE({
              event: 'endpoint',
              data: endpointUrl
            });

            await session.onOutgoingMessage(async msg => {
              await stream.writeSSE({
                data: JSON.stringify(msg)
              });
            });

            await session.waitingForClose;
          } catch (err) {
            console.error('SSE connection error', err);
          }
        });
      }

      if (c.req.method == 'POST') {
        let data: any;
        try {
          data = await c.req.json<JSONRPCMessage>();
        } catch (e) {
          throw new McpError('parse_error');
        }

        let valRes = JSONRPCMessageSchema.safeParse(data);
        if (!valRes.success) {
          debug.log('Invalid JSON-RPC message', data, valRes.error.issues);
          throw new ServiceError(
            badRequestError({
              message: 'Invalid JSON-RPC message',
              errors: { ...valRes.error.flatten().fieldErrors }
            })
          );
        }

        await session.incomingMessage([valRes.data]);

        return c.text('Accepted', 202);
      }

      return c.json(methodNotAllowedError().toResponse(), 405);
    });

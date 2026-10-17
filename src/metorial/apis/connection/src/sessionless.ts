import {
  handleSessionlessMcpRequest,
  type McpConnection,
  parseModernMcpRequest
} from '@metorial-subspace/module-connection';
import type { Context } from 'hono';
import { createStreamableHttpResponse, missingMcpResponse } from './streamableHttpResponse';

type SessionlessConnectionInput = Omit<
  Parameters<typeof handleSessionlessMcpRequest>[0],
  'request' | 'clientIp' | 'onProgress' | 'onConnection'
>;

let readHeader = (c: Context) => (name: string) => c.req.header(name);

export let sessionlessDisabledResponse = (c: Context, body: unknown) =>
  c.json(
    {
      jsonrpc: '2.0',
      id: (body as { id?: unknown } | null)?.id ?? null,
      error: { code: -32000, message: 'Bad Request: Server not initialized' }
    },
    400
  );

export let handleSessionlessHttpRequest = async (
  c: Context,
  d: {
    body: unknown;
    connectionInput: SessionlessConnectionInput;
    clientIp?: string | null;
    onSubspaceSessionResolved?: (d: {
      subspaceSessionId: string;
      response: Response;
    }) => Promise<void> | void;
  }
) => {
  let parsed = parseModernMcpRequest({ body: d.body, getHeader: readHeader(c) });
  if (parsed.type === 'error') {
    return c.json(parsed.error.body, parsed.error.status as 400 | 404);
  }
  if (parsed.type === 'notification') return c.body(null, 202);

  let request = parsed;

  let finish = async (response: Response, connection: McpConnection) => {
    for (let [key, value] of c.res.headers) response.headers.set(key, value);

    response.headers.set('Metorial-Session-Id', connection.session.id);
    response.headers.set('MCP-Protocol-Version', request.context.protocolVersion);
    if (connection.connection) {
      response.headers.set('Metorial-Connection-Id', connection.connection.id);
    }

    await d.onSubspaceSessionResolved?.({
      subspaceSessionId: connection.session.id,
      response
    });
    return response;
  };

  let stream = createStreamableHttpResponse();
  let resolveConnection!: (connection: McpConnection) => void;
  let connectionPromise = new Promise<McpConnection>(resolve => {
    resolveConnection = resolve;
  });

  let outcomePromise = handleSessionlessMcpRequest({
    ...d.connectionInput,
    request,
    clientIp: d.clientIp,
    onConnection: connection => resolveConnection(connection),
    onProgress: async event => stream.write(event)
  }).then(
    result => ({ type: 'complete' as const, result }),
    error => ({ type: 'error' as const, error })
  );

  let first = await Promise.race([
    stream.started.then(() => ({ type: 'stream' as const })),
    outcomePromise
  ]);

  if (!stream.hasStarted()) {
    if (first.type === 'error') throw first.error;

    if (first.type === 'complete') {
      let { result } = first;
      let response = result.mcp
        ? Response.json(result.mcp, { status: result.httpStatus })
        : new Response(null, { status: 202 });

      return finish(response, result.connection);
    }
  }

  void outcomePromise.then(outcome => {
    if (outcome.type === 'error') return stream.error(outcome.error);

    stream.write(outcome.result.mcp ?? missingMcpResponse(request.message));
    stream.close();
  });

  return finish(stream.response, await connectionPromise);
};

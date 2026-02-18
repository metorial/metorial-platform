import { getConfig } from '@metorial/config';
import type { Instance } from '@metorial/db';
import { Context } from 'hono';

let getSubspaceMcpUrl = (instance: Instance, sessionId: string) => {
  let connectionUrl = process.env.SUBSPACE_CONNECTION_URL;
  let solution = process.env.SUBSPACE_SOLUTION;

  if (!connectionUrl || !solution) {
    throw new Error('SUBSPACE_CONNECTION_URL and SUBSPACE_SOLUTION must be set');
  }

  return `${connectionUrl}/${solution}/${instance.subspaceTenantId}/sessions/${sessionId}/mcp`;
};

export let proxySubspaceSSE = async (
  c: Context,
  instance: Instance,
  sessionId: string
): Promise<Response> => {
  let subspaceUrl = getSubspaceMcpUrl(instance, sessionId);

  let headers: Record<string, string> = {};
  let mcpVersion = c.req.header('mcp-protocol-version');
  if (mcpVersion) headers['mcp-protocol-version'] = mcpVersion;

  let upstream = await fetch(subspaceUrl, {
    method: 'GET',
    headers,
    signal: c.req.raw.signal
  });

  if (!upstream.ok || !upstream.body) {
    return new Response(upstream.body, {
      status: upstream.status,
      headers: { 'content-type': upstream.headers.get('content-type') ?? 'text/event-stream' }
    });
  }

  let mcpProxyBase = getConfig().urls.mcpUrl;
  let reader = upstream.body.getReader();
  let decoder = new TextDecoder();
  let encoder = new TextEncoder();

  let proxyStream = new ReadableStream({
    async pull(controller: ReadableStreamDefaultController<Uint8Array>) {
      try {
        let { done, value } = await reader.read();
        if (done) {
          controller.close();
          return;
        }

        let text = decoder.decode(value, { stream: true });

        if (text.includes('event: endpoint')) {
          text = text.replace(
            /(event:\s*endpoint\ndata:\s*)(\S+)/g,
            (_match: string, prefix: string, subspacePostUrl: string) => {
              try {
                let parsed = new URL(subspacePostUrl);
                let connectionToken = parsed.searchParams.get('connection_token');
                let proxyUrl = new URL(`/mcp/${sessionId}`, mcpProxyBase);
                if (connectionToken)
                  proxyUrl.searchParams.set('connection_token', connectionToken);
                return `${prefix}${proxyUrl.toString()}`;
              } catch {
                return `${prefix}${subspacePostUrl}`;
              }
            }
          );
        }

        controller.enqueue(encoder.encode(text));
      } catch (err) {
        controller.error(err);
      }
    },
    cancel() {
      reader.cancel();
    }
  });

  return new Response(proxyStream, {
    status: 200,
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive'
    }
  });
};

export let proxySubspacePost = async (
  c: Context,
  instance: Instance,
  sessionId: string,
  connectionToken: string | null
): Promise<Response> => {
  let subspaceUrl = getSubspaceMcpUrl(instance, sessionId);
  let url = new URL(subspaceUrl);
  if (connectionToken) url.searchParams.set('connection_token', connectionToken);

  let headers: Record<string, string> = {
    'content-type': c.req.header('content-type') ?? 'application/json'
  };
  let mcpVersion = c.req.header('mcp-protocol-version');
  if (mcpVersion) headers['mcp-protocol-version'] = mcpVersion;

  let body = await c.req.text();

  let response = await fetch(url.toString(), {
    method: 'POST',
    headers,
    body
  });

  return new Response(response.body, {
    status: response.status,
    headers: { 'content-type': response.headers.get('content-type') ?? 'application/json' }
  });
};

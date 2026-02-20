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

export let proxyToSubspace = async (
  c: Context,
  instance: Instance,
  sessionId: string
): Promise<Response> => {
  let subspaceUrl = getSubspaceMcpUrl(instance, sessionId);

  let connectionToken = c.req.query('connection_token');
  if (connectionToken) {
    let url = new URL(subspaceUrl);
    url.searchParams.set('connection_token', connectionToken);
    subspaceUrl = url.toString();
  }

  let headers: Record<string, string> = {
    'Metorial-Proxy-URL': `${getConfig().urls.mcpUrl}/mcp/${sessionId}`
  };

  let mcpVersion = c.req.header('mcp-protocol-version');
  if (mcpVersion) headers['mcp-protocol-version'] = mcpVersion;

  let mcpSessionId = c.req.header('mcp-session-id');
  if (mcpSessionId) headers['mcp-session-id'] = mcpSessionId;

  let contentType = c.req.header('content-type');
  if (contentType) headers['content-type'] = contentType;

  let lastEventId = c.req.header('last-event-id');
  if (lastEventId) headers['Last-Event-ID'] = lastEventId;

  let body = c.req.method !== 'GET' && c.req.method !== 'HEAD' ? c.req.raw.body : undefined;

  let response = await fetch(subspaceUrl, {
    method: c.req.method,
    headers,
    body,
    signal: c.req.raw.signal
  });

  return new Response(response.body, {
    status: response.status,
    headers: response.headers
  });
};

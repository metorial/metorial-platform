import { badRequestError, internalServerError, ServiceError } from '@metorial/error';
import { getSubspaceConnectionUrl } from '@metorial/module-subspace';
import { Context } from 'hono';
import { SessionInfo } from './getSession';

let IGNORED_QUERY_PARAMS = new Set([
  'oauth_session_id',
  'metorial_server_session_id',
  'key'
]);

let buildSubspaceUrl = (
  sessionInfo: Extract<SessionInfo, { type: 'magic_mcp_subspace_session' }>,
  reqUrl: URL,
  connectionType: string
) => {
  let subspaceUrl = new URL(getSubspaceConnectionUrl());
  let basePath = subspaceUrl.pathname.endsWith('/')
    ? subspaceUrl.pathname
    : `${subspaceUrl.pathname}/`;

  // Preserve optional base path prefix (for example: "/subspace-controller").
  subspaceUrl.pathname = `${basePath}${encodeURIComponent(
    sessionInfo.subspaceSolutionId
  )}/${encodeURIComponent(sessionInfo.subspaceTenantIdentifier)}/sessions/${encodeURIComponent(
    sessionInfo.subspaceSessionId
  )}/mcp`.replace(/\/{2,}/g, '/');
  subspaceUrl.search = '';

  for (let [key, value] of reqUrl.searchParams.entries()) {
    if (IGNORED_QUERY_PARAMS.has(key)) continue;
    subspaceUrl.searchParams.append(key, value);
  }

  if (!subspaceUrl.searchParams.has('transportType')) {
    subspaceUrl.searchParams.set('transportType', connectionType);
  }

  return subspaceUrl;
};

export let proxyMagicMcpRequestToSubspace = async (
  c: Context,
  sessionInfo: Extract<SessionInfo, { type: 'magic_mcp_subspace_session' }>,
  connectionType: string
) => {
  if (connectionType === 'websocket') {
    throw new ServiceError(
      badRequestError({
        message: 'Websocket transport is not supported for Subspace-backed Magic MCP sessions.',
        hint: 'Use sse or streamable_http.'
      })
    );
  }

  let reqUrl = new URL(c.req.url);
  let subspaceUrl = buildSubspaceUrl(sessionInfo, reqUrl, connectionType);

  let body =
    c.req.method === 'GET' || c.req.method === 'HEAD' ? undefined : await c.req.raw.arrayBuffer();

  let headers = new Headers(c.req.raw.headers);
  headers.delete('host');
  headers.delete('content-length');
  headers.delete('authorization');
  headers.delete('cookie');
  headers.set('Metorial-Proxy-URL', reqUrl.toString());

  let upstream: Response;
  try {
    upstream = await fetch(subspaceUrl, {
      method: c.req.method,
      headers,
      body
    });
  } catch {
    throw new ServiceError(
      internalServerError({
        message: 'Failed to connect to the Subspace MCP endpoint',
        hint: 'Verify SUBSPACE_URL_CONNECTION and Subspace connection server availability.'
      })
    );
  }

  let responseHeaders = new Headers(upstream.headers);
  responseHeaders.set('Metorial-Subspace-Session-Id', sessionInfo.subspaceSessionId);

  return new Response(upstream.body, {
    status: upstream.status,
    statusText: upstream.statusText,
    headers: responseHeaders
  });
};

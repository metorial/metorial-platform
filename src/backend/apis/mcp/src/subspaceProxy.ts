import { badRequestError, internalServerError, ServiceError } from '@metorial/error';
import { getSubspaceConnectionUrl } from '@metorial/module-subspace';
import { Context } from 'hono';
import { ConnectionType } from './constants';
import { SessionInfo } from './getSession';

type SubspaceSessionRoutingInfo = Pick<
  Extract<SessionInfo, { type: 'magic_mcp_subspace_session' }>,
  'subspaceSolutionId' | 'subspaceTenantIdentifier' | 'subspaceSessionId'
>;

let IGNORED_SUBSPACE_QUERY_PARAMS = new Set([
  'oauth_session_id',
  'metorial_server_session_id',
  'key'
]);

let FORWARDED_REQUEST_HEADERS = new Set([
  'accept',
  'content-type',
  'mcp-protocol-version',
  'mcp-session-id',
  'last-event-id'
]);

let isAbortError = (error: unknown) => {
  if (!error || typeof error !== 'object') return false;

  return 'name' in error && (error as { name?: string }).name === 'AbortError';
};

export let buildSubspaceUrl = (
  connectionUrl: string,
  sessionInfo: SubspaceSessionRoutingInfo,
  reqUrl: URL,
  connectionType: ConnectionType
) => {
  let subspaceUrl = new URL(connectionUrl);
  let basePath = subspaceUrl.pathname.endsWith('/')
    ? subspaceUrl.pathname
    : `${subspaceUrl.pathname}/`;

  // Preserve optional base path prefix (for example subspace-controller).
  subspaceUrl.pathname = `${basePath}${encodeURIComponent(
    sessionInfo.subspaceSolutionId
  )}/${encodeURIComponent(sessionInfo.subspaceTenantIdentifier)}/sessions/${encodeURIComponent(
    sessionInfo.subspaceSessionId
  )}/mcp`.replace(/\/{2,}/g, '/');
  subspaceUrl.search = '';

  for (let [key, value] of reqUrl.searchParams.entries()) {
    if (IGNORED_SUBSPACE_QUERY_PARAMS.has(key)) continue;
    subspaceUrl.searchParams.append(key, value);
  }

  if (!subspaceUrl.searchParams.has('transportType')) {
    subspaceUrl.searchParams.set('transportType', connectionType);
  }

  return subspaceUrl;
};

export let buildMetorialProxyUrl = (reqUrl: URL, connectionType: ConnectionType) => {
  let proxyUrl = new URL(reqUrl.toString());
  proxyUrl.search = '';

  // Subspace uses this URL to emit SSE endpoint URLs; preserve key for SSE auth continuity.
  if (connectionType === 'sse') {
    let key = reqUrl.searchParams.get('key');
    if (key) proxyUrl.searchParams.set('key', key);
  }

  return proxyUrl.toString();
};

export let buildSubspaceProxyHeaders = (
  incomingHeaders: Headers,
  reqUrl: URL,
  connectionType: ConnectionType
) => {
  let headers = new Headers();

  for (let [name, value] of incomingHeaders.entries()) {
    if (FORWARDED_REQUEST_HEADERS.has(name.toLowerCase())) {
      headers.append(name, value);
    }
  }

  headers.set('Metorial-Proxy-URL', buildMetorialProxyUrl(reqUrl, connectionType));

  return headers;
};

export let proxyMagicMcpRequestToSubspace = async (
  c: Context,
  sessionInfo: Extract<SessionInfo, { type: 'magic_mcp_subspace_session' }>,
  connectionType: ConnectionType
) => {
  if (connectionType === 'websocket') {
    throw new ServiceError(
      badRequestError({
        message:
          'Websocket transport is not supported for Subspace-backed Magic MCP sessions.',
        hint: 'Use sse or streamable_http.'
      })
    );
  }

  let reqUrl = new URL(c.req.url);
  let subspaceUrl = buildSubspaceUrl(
    getSubspaceConnectionUrl(),
    sessionInfo,
    reqUrl,
    connectionType
  );

  let body =
    c.req.method === 'GET' || c.req.method === 'HEAD'
      ? undefined
      : await c.req.raw.arrayBuffer();

  let headers = buildSubspaceProxyHeaders(c.req.raw.headers, reqUrl, connectionType);

  let upstream: Response;
  try {
    upstream = await fetch(subspaceUrl, {
      method: c.req.method,
      headers,
      body,
      signal: c.req.raw.signal
    });
  } catch (error) {
    if (isAbortError(error) || c.req.raw.signal.aborted) {
      return new Response(null, {
        status: 499,
        statusText: 'Client Closed Request'
      });
    }

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

import type { Instance } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { Context } from 'hono';
import { env } from '../env';
import { getTenantForSubspace } from '../subspace';

let baseConnectionUrl = env.subspace.SUBSPACE_CONNECTION_URL;

let getSubspaceMcpUrl = async (instance: Instance, sessionId: string, inputUrl: URL) => {
  let { tenant, solution } = await getTenantForSubspace(instance);

  return `${baseConnectionUrl}/${solution.id}/${tenant.id}/sessions/${sessionId}/mcp${inputUrl.search}`;
};

export let proxyMcpRequestToSubspace = async (
  c: Context,
  instance: Instance,
  sessionId: string
): Promise<Response> => {
  let inputUrl = new URL(c.req.url);
  let subspaceUrl = await getSubspaceMcpUrl(instance, sessionId, inputUrl);

  let headers = new Headers(c.req.raw.headers);
  headers.set(
    'Metorial-Proxy-URL',
    process.env.NODE_ENV == 'production'
      ? `https://${inputUrl.hostname}${inputUrl.pathname}${inputUrl.search}`
      : `http://${inputUrl.host}${inputUrl.pathname}${inputUrl.search}`
  );

  await Fabric.fire('provider.session_message.created:before', { instance });

  let response = await fetch(subspaceUrl, {
    method: c.req.method,
    headers,
    signal: c.req.raw.signal,
    body: c.req.raw.body
  });

  return new Response(response.body, {
    status: response.status,
    headers: response.headers
  });
};

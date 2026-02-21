import type { Instance } from '@metorial/db';
import { Context } from 'hono';
import { env } from '../env';
import { getTenantForSubspace } from '../subspace';

let baseConnectionUrl = env.subspace.SUBSPACE_CONNECTION_URL;

let getSubspaceMcpUrl = async (instance: Instance, sessionId: string, rawUrl: string) => {
  let { tenant, solution } = await getTenantForSubspace(instance);

  let inputUrl = new URL(rawUrl);
  return `${baseConnectionUrl}/${solution.id}/${tenant.id}/sessions/${sessionId}/mcp${inputUrl.search}`;
};

export let proxyMcpRequestToSubspace = async (
  c: Context,
  instance: Instance,
  sessionId: string
): Promise<Response> => {
  let subspaceUrl = await getSubspaceMcpUrl(instance, sessionId, c.req.url);

  let response = await fetch(subspaceUrl, {
    method: c.req.method,
    headers: c.req.raw.headers,
    signal: c.req.raw.signal,
    body: c.req.raw.body
  });

  return new Response(response.body, {
    status: response.status,
    headers: response.headers
  });
};

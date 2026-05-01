import { getSentry } from '@lowerdeck/sentry';
import type { Instance } from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import { usageService } from '@metorial/module-usage';
import { Context } from 'hono';
import { env } from '../env';
import { getTenantForSubspace } from '../subspace';

let baseConnectionUrl = env.subspace.SUBSPACE_CONNECTION_URL;

let Sentry = getSentry();

export type SubspaceProxyAgentClient = {
  name: string;
  type: 'mcp_client_oauth';
  privateMetadata?: Record<string, any>;
  foreignId: string;
  oauthRegistrationId: string;
};

let getSubspaceMcpUrl = async (instance: Instance, sessionId: string, inputUrl: URL) => {
  let { tenant, solution } = await getTenantForSubspace(instance);

  return `${baseConnectionUrl}/${solution.id}/${tenant.id}/sessions/${sessionId}/mcp${inputUrl.search}`;
};

export let proxyMcpRequestToSubspace = async (
  c: Context,
  instance: Instance,
  sessionId: string,
  d?: {
    agentClient?: SubspaceProxyAgentClient | null;
    onSubspaceSessionResolved?: (d: {
      subspaceSessionId: string;
      response: Response;
    }) => Promise<void> | void;
  }
): Promise<Response> => {
  let inputUrl = new URL(c.req.url);
  let subspaceUrl = await getSubspaceMcpUrl(instance, sessionId, inputUrl);

  let headers = new Headers(c.req.raw.headers);
  headers.set('User-Agent', c.req.header('User-Agent') || 'unknown');
  headers.delete('Metorial-Agent-Client');

  let finalHostName = inputUrl.hostname;
  if (
    finalHostName.endsWith('.metorial.com') &&
    (finalHostName.startsWith('api-') ||
      finalHostName.startsWith('connect-') ||
      finalHostName.startsWith('mcp-'))
  ) {
    let parts = finalHostName.split('.');
    let fistPart = parts[0];
    let identifier = fistPart.split('-')[0];

    finalHostName = `${identifier}.metorial.com`;
  }

  headers.set(
    'Metorial-Proxy-URL',
    process.env.NODE_ENV == 'production'
      ? `https://${inputUrl.hostname}${inputUrl.pathname}${inputUrl.search}`
      : `http://${inputUrl.host}${inputUrl.pathname}${inputUrl.search}`
  );

  if (d?.agentClient) {
    headers.set('Metorial-Agent-Client', JSON.stringify(d.agentClient));
  }

  await Fabric.fire('provider.session_message.created:before', { instance });

  usageService
    .ingestUsageRecord({
      owner: {
        id: instance.id,
        type: 'instance'
      },
      entity: {
        id: sessionId,
        type: 'session'
      },
      type: 'session.connected'
    })
    .catch(e => Sentry.captureException(e));

  let response = await fetch(subspaceUrl, {
    method: c.req.method,
    headers,
    signal: c.req.raw.signal,
    body: c.req.raw.body
  });

  let subspaceSessionId = response.headers.get('Metorial-Session-Id');
  if (subspaceSessionId) {
    await d?.onSubspaceSessionResolved?.({
      subspaceSessionId,
      response
    });
  }

  return new Response(response.body, {
    status: response.status,
    headers: response.headers
  });
};

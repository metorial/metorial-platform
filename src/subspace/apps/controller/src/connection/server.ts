import { getSentry } from '@lowerdeck/sentry';

export async function startConnectionServer() {
  let Sentry = getSentry();
  let { api } = await import('./api');
  let { websocket } = await import('./api/metorialIntegrationProtocol');
  return { fetch: api.fetch, websocket, Sentry };
}

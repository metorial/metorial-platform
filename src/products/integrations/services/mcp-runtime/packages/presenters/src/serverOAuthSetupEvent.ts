import type { ServerOAuthSetup, ServerOAuthSetupEvent } from '@mtsrc/mcp-runtime-db';

export let serverOAuthSetupEventPresenter = (
  event: ServerOAuthSetupEvent & {
    serverOAuthSetup: ServerOAuthSetup;
  }
) => ({
  object: 'shuttle#server.oauth_setup.event',

  id: event.id,
  type: event.type,
  message: event.message,
  payload: event.payload,
  functionInvocationId: event.functionInvocationId,
  serverConnectionId: event.serverConnectionId,
  serverOAuthSetupId: event.serverOAuthSetup.id,
  createdAt: event.createdAt
});

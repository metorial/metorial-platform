import type { ServerAuthConfig, ServerAuthConfigEvent } from '../../prisma/generated/client';

export let serverAuthConfigEventPresenter = (
  event: ServerAuthConfigEvent & {
    serverAuthConfig: ServerAuthConfig;
  }
) => ({
  object: 'shuttle#server.auth_config.event',

  id: event.id,
  type: event.type,
  message: event.message,
  payload: event.payload,

  serverAuthConfigId: event.serverAuthConfig.id,
  functionInvocationId: event.functionInvocationId,
  serverConnectionId: event.serverConnectionId,

  createdAt: event.createdAt
});

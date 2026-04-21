import type {
  FunctionServer,
  FunctionServerInvocation,
  ServerConnection
} from '../../prisma/generated/client';

export let functionServerInvocationPresenter = (
  invocation: FunctionServerInvocation & {
    connection: ServerConnection | null;
    functionServer: FunctionServer;
  }
) => ({
  object: 'shuttle#function_server.invocation',

  id: invocation.functionBayInvocationId,
  isError: invocation.isError,

  serverConnectionId: invocation.connection?.id ?? null,
  functionServerId: invocation.functionServer.id,

  createdAt: invocation.createdAt
});

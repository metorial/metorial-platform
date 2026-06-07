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
) => {
  let invocationError = invocation as typeof invocation & {
    errorCode?: string | null;
    errorMessage?: string | null;
  };

  return {
    object: 'shuttle#function_server.invocation',

    id: invocation.functionBayInvocationId,
    isError: invocation.isError,
    errorCode: invocationError.errorCode ?? null,
    errorMessage: invocationError.errorMessage ?? null,

    serverConnectionId: invocation.connection?.id ?? null,
    functionServerId: invocation.functionServer.id,

    createdAt: invocation.createdAt
  };
};

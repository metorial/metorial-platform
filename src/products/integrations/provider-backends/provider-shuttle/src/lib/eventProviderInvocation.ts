import { createProviderInvocationId } from '@metorial-subspace/provider-utils';

export let getEventProviderInvocationId = (event: {
  functionInvocationId?: string | null;
  serverConnectionId?: string | null;
}) => {
  if (event.functionInvocationId) {
    return createProviderInvocationId(
      'shuttle.function_invocation',
      event.functionInvocationId
    );
  }

  if (event.serverConnectionId) {
    return createProviderInvocationId('shuttle.server_connection', event.serverConnectionId);
  }

  return null;
};

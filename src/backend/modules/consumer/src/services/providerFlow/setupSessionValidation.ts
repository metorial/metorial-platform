import {
  preconditionFailedError,
  ServiceError
} from '@lowerdeck/error';
import type { SubspaceProviderSetupSession } from '@metorial/module-subspace';

export let assertCompletedSetupSession = (d: {
  setupSession: Pick<SubspaceProviderSetupSession, 'status' | 'authConfig'>;
}) => {
  if (d.setupSession.status != 'completed' || !d.setupSession.authConfig?.id) {
    throw new ServiceError(
      preconditionFailedError({
        message: 'The selected provider setup session is not completed yet.'
      })
    );
  }
};

import { conflictError, ServiceError } from '@lowerdeck/error';
import { createLock, LockAcquisitionError } from '@lowerdeck/lock';
import { getConfig } from '@metorial/config';

// Shared with merge-request apply so file writes never interleave with a merge.
export let skillStoreMutationLock = createLock({
  name: 'cargo/skill/merge',
  redisUrl: getConfig().redisUrl
});

export let withSkillStoreMutationLock = async <T>(
  storeId: string,
  fn: () => Promise<T>
): Promise<T> => {
  try {
    return await skillStoreMutationLock.usingLock(storeId, fn);
  } catch (error) {
    if (error instanceof LockAcquisitionError && error.isContention) {
      throw new ServiceError(
        conflictError({
          message: 'The skill is currently being modified, for example by a merge request',
          description: 'Try again in a few seconds.'
        })
      );
    }

    throw error;
  }
};

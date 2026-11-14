import { forbiddenError, paymentRequiredError, ServiceError } from '@lowerdeck/error';
import { db, type Instance } from '@metorial/db';
import { flagService, getFlagDisabledReason, isFlagEnabled } from '@metorial/module-flags';

export let assertIntegrationRuntimeEnabled = async (instance: Pick<Instance, 'oid'>) => {
  let scope = await db.instance.findUniqueOrThrow({
    where: { oid: instance.oid },
    include: { organization: true, project: true }
  });

  let flags = await flagService.getFlags({
    organization: scope.organization,
    project: scope.project
  });

  let flag = flags['paid-integration-runtime'];
  if (isFlagEnabled(flag)) return;

  let disabledReason = getFlagDisabledReason(flag);
  if (disabledReason) {
    throw new ServiceError(forbiddenError({ message: disabledReason }));
  }

  throw new ServiceError(
    paymentRequiredError({
      message: 'Please upgrade to a different plan to access this feature'
    })
  );
};

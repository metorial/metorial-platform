import { badRequestError, ServiceError } from '@lowerdeck/error';
import type { Project, Instance } from '@metorial/db';
import type { CargoOwnerScope } from '../internal/ownerScope';

export let requireInstanceScope = (
  scope: CargoOwnerScope,
  action: string
): { project: Project; instance: Instance } => {
  if (!('instance' in scope)) {
    throw new ServiceError(
      badRequestError({
        message: `${action} is only available for files owned by an instance.`
      })
    );
  }

  return scope as { project: Project; instance: Instance };
};

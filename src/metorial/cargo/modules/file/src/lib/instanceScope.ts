import { badRequestError, ServiceError } from '@lowerdeck/error';
import type { CargoOwnerScope, CargoScope } from '@metorial/cargo-list-utils';

export let requireInstanceScope = (scope: CargoOwnerScope, action: string): CargoScope => {
  if (!('instance' in scope)) {
    throw new ServiceError(
      badRequestError({
        message: `${action} is only available for files owned by an instance.`
      })
    );
  }

  return scope;
};

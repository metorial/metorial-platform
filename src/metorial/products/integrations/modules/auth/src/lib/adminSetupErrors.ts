import { badRequestError, ServiceError } from '@lowerdeck/error';

export let adminSetupInvalidBindingError = () =>
  new ServiceError(
    badRequestError({
      message: 'Admin setup sessions cannot be bound to an identity, consumer, or config',
      code: 'admin_setup_invalid_binding'
    })
  );

export let adminSetupToolFiltersError = () =>
  new ServiceError(
    badRequestError({
      message: 'Admin setup sessions do not support tool filters',
      code: 'admin_setup_invalid_configuration'
    })
  );

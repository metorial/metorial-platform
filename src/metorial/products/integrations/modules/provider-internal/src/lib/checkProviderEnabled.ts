import { badRequestError, ServiceError } from '@lowerdeck/error';

export let checkProviderEnabled = (
  provider: { id: string; isDisabled: boolean } | undefined | null
) => {
  if (!provider?.isDisabled) return;

  throw new ServiceError(
    badRequestError({
      message: 'This integration has been disabled by an administrator.',
      entityId: provider.id,
      code: 'provider_disabled'
    })
  );
};

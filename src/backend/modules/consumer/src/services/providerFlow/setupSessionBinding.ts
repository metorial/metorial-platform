import {
  preconditionFailedError,
  ServiceError,
  unauthorizedError
} from '@lowerdeck/error';

export type ConsumerProviderSetupSessionBindingLike = {
  consumerProfileId: string;
  providerTemplateId: string;
  providerId: string;
  providerDeploymentId: string;
};

export let assertSetupSessionBindingMatchesConsumerProvider = (d: {
  binding: ConsumerProviderSetupSessionBindingLike;
  consumerProfileId: string;
  providerTemplateId: string;
  providerId: string;
  providerDeploymentId: string;
}) => {
  if (d.binding.consumerProfileId != d.consumerProfileId) {
    throw new ServiceError(
      unauthorizedError({
        message: 'The selected provider setup session does not belong to this consumer.'
      })
    );
  }

  if (d.binding.providerTemplateId != d.providerTemplateId) {
    throw new ServiceError(
      unauthorizedError({
        message: 'The selected provider setup session does not belong to this template.'
      })
    );
  }

  if (
    d.binding.providerId != d.providerId ||
    d.binding.providerDeploymentId != d.providerDeploymentId
  ) {
    throw new ServiceError(
      preconditionFailedError({
        message: 'The selected provider setup session does not match this template.'
      })
    );
  }
};

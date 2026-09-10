import { badRequestError, ServiceError } from '@lowerdeck/error';
import { v } from '@lowerdeck/validation';

export let webhookRegistrationStatusValidator = v.enumOf([
  'awaiting_setup',
  'active',
  'archived',
  'deleted'
] as const);

export let callbackStatusValidator = v.enumOf(['active', 'archived', 'deleted'] as const);

export let callbackEventStatusValidator = v.enumOf(['pending', 'processed', 'failed'] as const);

export let callbackEventSourceValidator = v.enumOf(['webhook', 'polling'] as const);

export let incomingWebhookStatusValidator = v.enumOf([
  'pending',
  'failed_retrying',
  'failed_final',
  'succeeded'
] as const);

export let stringOrArray = () => v.union([v.string(), v.array(v.string())]);

export let getRequiredParam = (params: Record<string, string | undefined>, key: string) => {
  let value = params[key];
  if (!value) {
    throw new ServiceError(
      badRequestError({
        message: `${key} is required`,
        description: `The ${key} path parameter is required.`
      })
    );
  }

  return value;
};

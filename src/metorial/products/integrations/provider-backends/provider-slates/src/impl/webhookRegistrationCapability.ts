import type { SpecificationTriggerGroup } from '@metorial-subspace/provider-utils';

type WebhookRegistrationCapability = Extract<
  PrismaJson.ProviderTypeAttributes['triggers'],
  { status: 'enabled' }
>['webhookRegistration'];

// Manual groups need a registration first; automatic groups with a delivery config need one
// only for the customer's own OAuth app.
export let toWebhookRegistrationCapability = (
  triggerGroups: Pick<SpecificationTriggerGroup, 'invocation'>[]
): WebhookRegistrationCapability => {
  let registrations = triggerGroups.flatMap(group =>
    group.invocation.type === 'webhook' ? [group.invocation.registration] : []
  );

  if (registrations.some(registration => registration.mode === 'manual')) {
    return { status: 'supported' };
  }

  if (
    registrations.some(registration => registration.mode === 'auto' && registration.config)
  ) {
    return { status: 'supported', purpose: 'delivery_setup' };
  }

  return { status: 'unsupported' };
};

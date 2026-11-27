import type {
  SlateTriggerGroup,
  TriggerRegistrationInstance,
  TriggerRegistrationInstanceError,
  TriggerWebhookTarget
} from '../../prisma/generated/client';

export let triggerRegistrationInstanceErrorPresenter = (
  error: TriggerRegistrationInstanceError & {
    triggerRegistrationInstance: TriggerRegistrationInstance & {
      triggerGroup: SlateTriggerGroup;
    };
    triggerWebhookTarget: TriggerWebhookTarget | null;
  }
) => ({
  object: 'trigger_registration.instance_error',

  id: error.id,

  triggerRegistrationInstanceId: error.triggerRegistrationInstance.id,
  triggerGroupId: error.triggerRegistrationInstance.triggerGroup.id,
  triggerWebhookTargetId: error.triggerWebhookTarget?.id ?? null,

  code: error.code,
  message: error.message,

  createdAt: error.createdAt
});

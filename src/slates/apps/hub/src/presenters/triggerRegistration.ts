import type {
  Slate,
  SlateAuthConfig,
  SlateAuthMethod,
  SlateInstance,
  SlateInstanceConfig,
  SlateTriggerGroup,
  TriggerRegistration,
  TriggerRegistrationInstance,
  TriggerRegistrationSchedule
} from '../../prisma/generated/client';

export let triggerRegistrationPresenter = (
  registration: TriggerRegistration & {
    slate: Slate;
    instance: SlateInstance;
    instanceConfig: SlateInstanceConfig;
    authConfig: (SlateAuthConfig & { authMethod: SlateAuthMethod }) | null;
    instances: (TriggerRegistrationInstance & {
      triggerGroup: SlateTriggerGroup;
      schedule: TriggerRegistrationSchedule | null;
    })[];
  }
) => ({
  object: 'trigger_registration',

  id: registration.id,
  status: registration.status,

  slateId: registration.slate.id,
  slateInstanceId: registration.instance.id,
  slateInstanceConfigId: registration.instanceConfig.id,
  slateAuthConfigId: registration.authConfig?.id ?? null,

  triggerGroups: registration.instances.map(instance => ({
    object: 'trigger_registration.instance',

    id: instance.id,
    triggerGroupId: instance.triggerGroup.id,

    schedule: instance.schedule
      ? {
          id: instance.schedule.id,
          isDisabled: instance.schedule.isDisabled,
          intervalSeconds: instance.schedule.intervalSeconds,
          firstRunAt: instance.schedule.firstRunAt,
          lastRunAt: instance.schedule.lastRunAt,
          nextRunAt: instance.schedule.nextRunAt
        }
      : null
  })),

  createdAt: registration.createdAt,
  updatedAt: registration.updatedAt
});

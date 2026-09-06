import type {
  CallbackInstance,
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
import { triggerRegistrationPresenter } from './triggerRegistration';

export let callbackInstancePresenter = (
  instance: CallbackInstance & {
    triggerRegistration: TriggerRegistration & {
      slate: Slate;
      instance: SlateInstance;
      instanceConfig: SlateInstanceConfig;
      authConfig: (SlateAuthConfig & { authMethod: SlateAuthMethod }) | null;
      instances: (TriggerRegistrationInstance & {
        triggerGroup: SlateTriggerGroup;
        schedule: TriggerRegistrationSchedule | null;
      })[];
    };
  }
) => ({
  object: 'callback.instance',

  id: instance.id,
  status: instance.status,

  triggerRegistration: triggerRegistrationPresenter(instance.triggerRegistration),

  createdAt: instance.createdAt,
  updatedAt: instance.updatedAt
});

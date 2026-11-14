import type { SlateTriggerGroup } from '../../prisma/generated/client';

// An automatic group that declares a delivery config receives pushes only through one.
export let getTriggerDeliveryConfigSpec = (triggerGroup: Pick<SlateTriggerGroup, 'spec'>) => {
  let invocation = triggerGroup.spec.invocation;
  if (invocation.type !== 'webhook' || invocation.registration.mode !== 'auto') return null;

  return invocation.registration.deliveryConfig ?? null;
};

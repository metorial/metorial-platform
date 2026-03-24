import type {
  Callback,
  CallbackInstance,
  CallbackReceiverRegistration,
  Tenant
} from '@metorial-subspace/db';
import { db } from '@metorial-subspace/db';
import type {
  CallbackInstanceReceiverTrigger,
  EnrichedCallbackInstanceTrigger
} from '@metorial-subspace/presenters';
import { getTenantForSlates, slates } from '@metorial-subspace/provider-slates/src/client';

type CallbackInstanceWithRegistration = CallbackInstance & {
  activeRegistration?: CallbackReceiverRegistration | null;
};

let providerTriggerInclude = {
  provider: true,
  specification: true
};

export let resolveProviderTriggers = async (callbackOid: bigint, triggerIds: string[]) => {
  let results = await db.providerTrigger.findMany({
    where: {
      specId: { in: triggerIds },
      callbackProviderTriggers: {
        some: { callbackOid }
      }
    },
    include: providerTriggerInclude
  });

  let bySpecId = new Map<string, (typeof results)[number]>();
  for (let trigger of results) {
    bySpecId.set(trigger.specId, trigger);
  }
  return bySpecId;
};

export let enrichTriggers = (
  receiverTriggers: CallbackInstanceReceiverTrigger[],
  providerTriggerMap: Map<string, any>
): EnrichedCallbackInstanceTrigger[] => {
  return receiverTriggers.map(trigger => ({
    ...trigger,
    providerTrigger: providerTriggerMap.get(trigger.triggerId) ?? null
  }));
};

export let enrichCallbackInstanceTriggers = async (
  tenant: Tenant,
  callback: Callback,
  instances: CallbackInstanceWithRegistration[]
): Promise<Map<string, EnrichedCallbackInstanceTrigger[]>> => {
  let receiverIdToInstanceIds = new Map<string, string[]>();
  for (let instance of instances) {
    let receiverId = instance.activeRegistration?.slateTriggerReceiverId;
    if (!receiverId) continue;
    let ids = receiverIdToInstanceIds.get(receiverId);
    if (!ids) {
      ids = [];
      receiverIdToInstanceIds.set(receiverId, ids);
    }
    ids.push(instance.id);
  }

  let result = new Map<string, EnrichedCallbackInstanceTrigger[]>();
  if (!receiverIdToInstanceIds.size) return result;

  let slatesTenant = await getTenantForSlates(tenant);
  let receiverIds = [...receiverIdToInstanceIds.keys()];

  let receivers: { id: string; triggers: CallbackInstanceReceiverTrigger[] }[];
  try {
    receivers = await slates.slateTriggerReceiver.getMany({
      tenantId: slatesTenant.id,
      slateTriggerReceiverIds: receiverIds
    });
  } catch {
    return result;
  }

  let allTriggerIds = [...new Set(receivers.flatMap(r => r.triggers.map(t => t.triggerId)))];
  let providerTriggerMap = await resolveProviderTriggers(callback.oid, allTriggerIds);

  for (let receiver of receivers) {
    let instanceIds = receiverIdToInstanceIds.get(receiver.id);
    if (!instanceIds) continue;
    let enriched = enrichTriggers(receiver.triggers, providerTriggerMap);
    for (let instanceId of instanceIds) {
      result.set(instanceId, enriched);
    }
  }

  return result;
};

export let enrichSingleCallbackInstanceTriggers = async (
  tenant: Tenant,
  callback: Callback,
  instance: CallbackInstanceWithRegistration
): Promise<EnrichedCallbackInstanceTrigger[]> => {
  let receiverId = instance.activeRegistration?.slateTriggerReceiverId;
  if (!receiverId) return [];

  let slatesTenant = await getTenantForSlates(tenant);
  try {
    let receiver = await slates.slateTriggerReceiver.get({
      tenantId: slatesTenant.id,
      slateTriggerReceiverId: receiverId
    });

    let triggerIds = receiver.triggers.map(t => t.triggerId);
    let providerTriggerMap = await resolveProviderTriggers(callback.oid, triggerIds);

    return enrichTriggers(receiver.triggers, providerTriggerMap);
  } catch {
    return [];
  }
};

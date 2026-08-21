import type {
  Callback,
  CallbackInstance,
  Provider,
  ProviderSpecification,
  ProviderTrigger
} from '@metorial-subspace/db';
import { db } from '@metorial-subspace/db';
import { getTenantForSlates, slates } from '@metorial-subspace/provider-slates/src/client';
import { resolveMetorialFacing } from '@metorial-subspace/module-tenant';
import type { Instance } from '@metorial/db';

export type CallbackInstanceReceiverTrigger = Awaited<
  ReturnType<typeof slates.callbackRegistration.get>
>['triggers'][number];

export type EnrichedCallbackInstanceTrigger = CallbackInstanceReceiverTrigger & {
  providerTrigger:
    | (ProviderTrigger & {
        provider: Provider;
        specification: Omit<ProviderSpecification, 'value'>;
      })
    | null;
};

export type CallbackInstanceReceiver = {
  receiverWebhookUrl: string | null;
  receiverPathSecret: {
    id: string;
    generation: number;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  triggers: EnrichedCallbackInstanceTrigger[];
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
  instance: Instance,
  callback: Callback,
  instances: CallbackInstance[]
): Promise<Map<string, CallbackInstanceReceiver>> => {
  let { tenant } = await resolveMetorialFacing({ instance });
  let result = new Map<string, CallbackInstanceReceiver>();
  let slatesTenant = await getTenantForSlates(tenant);
  let receivers = (
    await Promise.all(
      instances.map(async callbackInstance => {
        if (
          !callbackInstance.slateTriggerReceiverId ||
          callbackInstance.registrationReceiverAuthorityVersion < 1
        ) {
          return null;
        }
        try {
          let receiver = await slates.callbackRegistration.get({
            tenantId: slatesTenant.id,
            callbackId: callback.id,
            callbackInstanceId: callbackInstance.id,
            slateTriggerReceiverId: callbackInstance.slateTriggerReceiverId,
            expectedOwnerVersion: callbackInstance.registrationReceiverAuthorityVersion
          });
          return { callbackInstanceId: callbackInstance.id, receiver };
        } catch {
          return null;
        }
      })
    )
  ).filter(item => item !== null);

  let allTriggerIds = [
    ...new Set(receivers.flatMap(item => item.receiver.triggers.map(t => t.triggerId)))
  ];
  let providerTriggerMap = await resolveProviderTriggers(callback.oid, allTriggerIds);

  for (let { callbackInstanceId, receiver } of receivers) {
    result.set(callbackInstanceId, {
      receiverWebhookUrl: receiver.receiverWebhookUrl ?? null,
      receiverPathSecret: receiver.receiverPathSecret ?? null,
      triggers: enrichTriggers(receiver.triggers, providerTriggerMap)
    });
  }

  return result;
};

export let enrichSingleCallbackInstanceTriggers = async (
  instance: Instance,
  callback: Callback,
  callbackInstance: CallbackInstance
): Promise<CallbackInstanceReceiver | undefined> => {
  let { tenant } = await resolveMetorialFacing({ instance });
  let receiverId = callbackInstance.slateTriggerReceiverId;
  if (!receiverId || callbackInstance.registrationReceiverAuthorityVersion < 1) {
    return undefined;
  }

  let slatesTenant = await getTenantForSlates(tenant);
  try {
    let receiver = await slates.callbackRegistration.get({
      tenantId: slatesTenant.id,
      callbackId: callback.id,
      callbackInstanceId: callbackInstance.id,
      slateTriggerReceiverId: receiverId,
      expectedOwnerVersion: callbackInstance.registrationReceiverAuthorityVersion
    });

    let triggerIds = receiver.triggers.map(t => t.triggerId);
    let providerTriggerMap = await resolveProviderTriggers(callback.oid, triggerIds);

    return {
      receiverWebhookUrl: receiver.receiverWebhookUrl ?? null,
      receiverPathSecret: receiver.receiverPathSecret ?? null,
      triggers: enrichTriggers(receiver.triggers, providerTriggerMap)
    };
  } catch {
    return undefined;
  }
};

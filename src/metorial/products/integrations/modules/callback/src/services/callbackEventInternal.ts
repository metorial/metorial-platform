import { Service } from '@lowerdeck/service';
import {
  type CallbackEventSource,
  type CallbackInstance,
  db,
  getId
} from '@metorial-subspace/db';
import { callbackEventProcessQueue } from '../queues/processEvent';

class callbackEventInternalServiceImpl {
  async recordEvent(d: {
    callbackInstance: CallbackInstance;
    source: CallbackEventSource;
    providerTriggerKey: string;
    mappedType?: string;
    mappedId?: string;
    occurredAt: Date;
  }) {
    let callback = await db.callback.findUniqueOrThrow({
      where: { oid: d.callbackInstance.callbackOid }
    });

    let providerTriggerGlobal = await db.providerTriggerGlobal.findUnique({
      where: {
        providerOid_key: { providerOid: callback.providerOid, key: d.providerTriggerKey }
      },
      select: { currentInstanceOid: true }
    });

    let event = await db.callbackEvent.create({
      data: {
        ...getId('callbackEvent'),
        status: 'pending',
        source: d.source,

        providerTriggerKey: d.providerTriggerKey,
        providerTriggerOid: providerTriggerGlobal?.currentInstanceOid,

        mappedType: d.mappedType,
        mappedId: d.mappedId,

        callbackOid: d.callbackInstance.callbackOid,
        callbackInstanceOid: d.callbackInstance.oid,

        tenantOid: d.callbackInstance.tenantOid,
        projectOid: d.callbackInstance.projectOid,
        environmentOid: d.callbackInstance.environmentOid,
        instanceOid: d.callbackInstance.instanceOid,
        solutionOid: d.callbackInstance.solutionOid,

        occurredAt: d.occurredAt
      }
    });

    await callbackEventProcessQueue.add({ callbackEventId: event.id }, { id: event.id });

    return event;
  }
}

export let callbackEventInternalService = Service.create(
  'callbackEventInternal',
  () => new callbackEventInternalServiceImpl()
).build();

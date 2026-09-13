import { Service } from '@lowerdeck/service';
import {
  type Callback,
  type CallbackEvent,
  type CallbackEventSource,
  type CallbackInstance,
  db,
  getId,
  type Tenant
} from '@metorial-subspace/db';
import { getBackend } from '@metorial-subspace/provider';
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
      select: {
        currentInstance: { select: { oid: true, adapter: { select: { globalOid: true } } } }
      }
    });

    let providerTrigger = providerTriggerGlobal?.currentInstance;
    let triggerAdapterGlobalOid = providerTrigger?.adapter?.globalOid ?? null;

    if (
      callback.ownership === 'managed'
        ? triggerAdapterGlobalOid !== callback.managedAdapterGlobalOid
        : triggerAdapterGlobalOid !== null
    ) {
      return null;
    }

    let event = await db.callbackEvent.create({
      data: {
        ...getId('callbackEvent'),
        status: 'pending',
        source: d.source,

        providerTriggerKey: d.providerTriggerKey,
        providerTriggerOid: providerTrigger?.oid,

        mappedType: d.mappedType,
        mappedId: d.mappedId,

        callbackOid: d.callbackInstance.callbackOid,
        callbackInstanceOid: d.callbackInstance.oid,

        tenantOid: d.callbackInstance.tenantOid,
        projectOid: d.callbackInstance.projectOid!,
        environmentOid: d.callbackInstance.environmentOid,
        instanceOid: d.callbackInstance.instanceOid!,
        solutionOid: d.callbackInstance.solutionOid,

        occurredAt: d.occurredAt
      }
    });

    await callbackEventProcessQueue.add({ callbackEventId: event.id }, { id: event.id });

    return event;
  }

  async getEventPayload(d: {
    tenant: Tenant;
    callback: Callback;
    callbackEvent: CallbackEvent;
  }): Promise<Record<string, any> | null> {
    let providerVariant = await db.providerVariant.findUniqueOrThrow({
      where: { oid: d.callback.providerVariantOid }
    });

    let backend = await getBackend({ entity: providerVariant });
    if (!backend.callbacks) return null;

    let { events } = await backend.callbacks.getManyEvents({
      tenant: d.tenant,
      callbackEvents: [d.callbackEvent]
    });

    return events[0]?.payload ?? null;
  }
}

export let callbackEventInternalService = Service.create(
  'callbackEventInternal',
  () => new callbackEventInternalServiceImpl()
).build();

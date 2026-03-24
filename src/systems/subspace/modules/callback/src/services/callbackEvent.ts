import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import {
  CallbackReceiverRegistrationStatus,
  CallbackStatus,
  db,
  type Environment,
  type Solution,
  type Tenant
} from '@metorial-subspace/db';
import { getTenantForSlates, slates } from '@metorial-subspace/provider-slates/src/client';

class callbackEventServiceImpl {
  private async resolveContext(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    callbackId: string;
  }) {
    let callback = await db.callback.findFirst({
      where: {
        id: d.callbackId,
        tenantOid: d.tenant.oid,
        solutionOid: d.solution.oid,
        environmentOid: d.environment.oid,
        status: { notIn: [CallbackStatus.deleted] }
      }
    });
    if (!callback) {
      throw new ServiceError(notFoundError('callback', d.callbackId));
    }

    let registrations = await db.callbackReceiverRegistration.findMany({
      where: {
        callbackOid: callback.oid,
        status: CallbackReceiverRegistrationStatus.active
      },
      include: {
        providerDeploymentConfigPair: true,
        callbackInstance: true
      }
    });

    let slatesTenant = await getTenantForSlates(d.tenant);

    return { callback, registrations, slatesTenant };
  }

  async listCallbackEvents(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    callbackId: string;
    input: {
      limit?: number;
      after?: string;
      before?: string;
      cursor?: string;
      order?: 'asc' | 'desc';
      eventTypes?: string[];
    };
  }) {
    let context = await this.resolveContext(d);
    let receiverIds = context.registrations
      .map(reg => reg.slateTriggerReceiverId)
      .filter(Boolean);

    let res = await slates.slateTriggerEvent.list({
      tenantId: context.slatesTenant.id,
      triggerReceiverIds: receiverIds.length ? receiverIds : undefined,
      eventTypes: d.input.eventTypes,
      limit: d.input.limit,
      after: d.input.after,
      before: d.input.before,
      cursor: d.input.cursor,
      order: d.input.order
    });

    let registrationByReceiverId = new Map(
      context.registrations.map(reg => [reg.slateTriggerReceiverId, reg] as const)
    );

    return {
      ...res,
      items: res.items.map(item => {
        let registration = registrationByReceiverId.get(item.triggerReceiverId);
        return {
          ...item,
          callbackId: context.callback.id,
          providerDeploymentConfigPairId:
            registration?.providerDeploymentConfigPair.id ?? null,
          callbackInstanceId: registration?.callbackInstance.id ?? null
        };
      })
    };
  }

  async getCallbackEvent(d: {
    tenant: Tenant;
    solution: Solution;
    environment: Environment;
    callbackId: string;
    slateTriggerEventId: string;
  }) {
    let context = await this.resolveContext(d);

    let event = await slates.slateTriggerEvent.get({
      tenantId: context.slatesTenant.id,
      slateTriggerEventId: d.slateTriggerEventId
    });

    let registration = context.registrations.find(
      reg => reg.slateTriggerReceiverId === event.triggerReceiverId
    );
    if (!registration) {
      throw new ServiceError(notFoundError('callback.event', d.slateTriggerEventId));
    }

    return {
      ...event,
      callbackId: context.callback.id,
      providerDeploymentConfigPairId: registration.providerDeploymentConfigPair.id,
      callbackInstanceId: registration.callbackInstance.id
    };
  }
}

export let callbackEventService = Service.create(
  'callbackEventService',
  () => new callbackEventServiceImpl()
).build();

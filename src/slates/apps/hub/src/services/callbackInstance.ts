import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type {
  Callback,
  CallbackInstance,
  Tenant,
  TriggerRegistration
} from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';
import { slateInstanceService } from './slateInstance';
import { triggerRegistrationService } from './triggerRegistration';

let include = {
  triggerRegistration: {
    include: {
      slate: true,
      instance: true,
      instanceConfig: true,
      authConfig: { include: { authMethod: true } },
      instances: { include: { triggerGroup: true, schedule: true } }
    }
  }
};

class callbackInstanceServiceImpl {
  async getCallbackInstanceById(d: { tenant: Tenant; callback: Callback; id: string }) {
    let instance = await db.callbackInstance.findFirst({
      where: {
        tenantOid: d.tenant.oid,
        callbackOid: d.callback.oid,
        id: d.id,
        status: { not: 'deleted' }
      },
      include
    });
    if (!instance) throw new ServiceError(notFoundError('callback.instance'));
    return instance;
  }

  async listCallbackInstances(d: { tenant: Tenant; callback: Callback }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.callbackInstance.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              callbackOid: d.callback.oid,
              status: { not: 'deleted' }
            },
            include
          })
      )
    );
  }

  async createCallbackInstance(d: {
    tenant: Tenant;
    callback: Callback;
    input: { slateInstanceId: string; authConfigId?: string };
  }) {
    if (d.callback.tenantOid !== d.tenant.oid) throw new ServiceError(notFoundError('callback'));

    let slateInstance = await slateInstanceService.getSlateInstanceById({
      tenant: d.tenant,
      id: d.input.slateInstanceId
    });
    if (slateInstance.slateOid !== d.callback.slateOid) {
      throw new ServiceError(
        badRequestError({
          message: 'This provider instance does not belong to the callback provider.'
        })
      );
    }

    let triggerRegistration = await triggerRegistrationService.createTriggerRegistration({
      tenant: d.tenant,
      input: d.input
    });

    let instance = await db.callbackInstance.create({
      data: {
        ...getId('callbackInstance'),
        tenantOid: d.tenant.oid,
        callbackOid: d.callback.oid,
        triggerRegistrationOid: triggerRegistration.oid
      }
    });

    return db.callbackInstance.findUniqueOrThrow({ where: { oid: instance.oid }, include });
  }

  async deleteCallbackInstance(d: {
    tenant: Tenant;
    callbackInstance: CallbackInstance & { triggerRegistration: TriggerRegistration };
  }) {
    if (d.callbackInstance.tenantOid !== d.tenant.oid) {
      throw new ServiceError(notFoundError('callback.instance'));
    }

    await db.callbackInstance.update({
      where: { oid: d.callbackInstance.oid },
      data: { status: 'deleted' }
    });

    await triggerRegistrationService.deleteTriggerRegistration({
      tenant: d.tenant,
      registration: d.callbackInstance.triggerRegistration
    });
  }
}

export let callbackInstanceService = Service.create(
  'callbackInstanceService',
  () => new callbackInstanceServiceImpl()
).build();

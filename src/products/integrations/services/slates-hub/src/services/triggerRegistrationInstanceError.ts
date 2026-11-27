import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Tenant, TriggerRegistration } from '../../prisma/generated/client';
import { db } from '../db';

let include = {
  triggerRegistrationInstance: { include: { triggerGroup: true } },
  triggerWebhookTarget: true
};

class triggerRegistrationInstanceErrorServiceImpl {
  async listErrors(d: { tenant: Tenant; registration: TriggerRegistration }) {
    if (d.registration.tenantOid !== d.tenant.oid) {
      throw new ServiceError(notFoundError('trigger_registration'));
    }

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.triggerRegistrationInstanceError.findMany({
            ...opts,
            where: {
              triggerRegistrationInstance: { triggerRegistrationOid: d.registration.oid }
            },
            include
          })
      )
    );
  }

  async getErrorById(d: { tenant: Tenant; registration: TriggerRegistration; id: string }) {
    if (d.registration.tenantOid !== d.tenant.oid) {
      throw new ServiceError(notFoundError('trigger_registration'));
    }

    let error = await db.triggerRegistrationInstanceError.findFirst({
      where: {
        id: d.id,
        triggerRegistrationInstance: { triggerRegistrationOid: d.registration.oid }
      },
      include
    });
    if (!error) throw new ServiceError(notFoundError('trigger_registration.instance_error'));
    return error;
  }
}

export let triggerRegistrationInstanceErrorService = Service.create(
  'triggerRegistrationInstanceErrorService',
  () => new triggerRegistrationInstanceErrorServiceImpl()
).build();

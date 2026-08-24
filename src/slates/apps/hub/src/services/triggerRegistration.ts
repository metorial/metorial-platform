import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Tenant } from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';
import { triggerRegistrationInstanceSetupQueue } from '../queues/trigger/setup';
import { slateService } from './slate';

let include = {
  slate: true,
  instance: true,
  instanceConfig: true,
  authConfig: { include: { authMethod: true } },
  instances: { include: { triggerGroup: true, schedule: true } }
};

class triggerRegistrationServiceImpl {
  async getTriggerRegistrationById(d: { tenant: Tenant; id: string }) {
    let registration = await db.triggerRegistration.findFirst({
      where: { tenantOid: d.tenant.oid, id: d.id, status: { not: 'deleted' } },
      include
    });
    if (!registration) throw new ServiceError(notFoundError('trigger_registration'));
    return registration;
  }

  async listTriggerRegistrations(d: { tenant: Tenant; slateInstanceIds?: string[] }) {
    let slateInstances = d.slateInstanceIds
      ? await db.slateInstance.findMany({
          where: { id: { in: d.slateInstanceIds }, tenantOid: d.tenant.oid }
        })
      : undefined;

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.triggerRegistration.findMany({
            ...opts,
            where: {
              tenantOid: d.tenant.oid,
              status: { not: 'deleted' },
              instanceOid: slateInstances
                ? { in: slateInstances.map(si => si.oid) }
                : undefined
            },
            include
          })
      )
    );
  }

  async createTriggerRegistration(d: {
    tenant: Tenant;
    input: {
      slateInstanceId: string;
      authConfigId?: string;
    };
  }) {
    let slateInstance = await db.slateInstance.findFirst({
      where: { tenantOid: d.tenant.oid, id: d.input.slateInstanceId },
      include: { slate: true, currentConfig: true }
    });
    if (!slateInstance) throw new ServiceError(notFoundError('slate.instance'));
    if (!slateInstance.currentConfig) {
      throw new ServiceError(
        badRequestError({ message: 'This provider instance has no configuration set.' })
      );
    }

    let authMethods = await slateService.listCurrentAuthMethods({
      slate: slateInstance.slate
    });

    let authConfig = null;
    if (d.input.authConfigId) {
      authConfig = await db.slateAuthConfig.findFirst({
        where: {
          tenantOid: d.tenant.oid,
          id: d.input.authConfigId,
          slateOid: slateInstance.slateOid
        }
      });
      if (!authConfig) throw new ServiceError(notFoundError('slate.auth_config'));
      if (authConfig.instanceOid && authConfig.instanceOid !== slateInstance.oid) {
        throw new ServiceError(
          badRequestError({
            message:
              'This authentication configuration is not valid for the selected provider instance.'
          })
        );
      }
    } else if (authMethods.length > 0) {
      throw new ServiceError(
        badRequestError({
          code: 'authentication_required',
          message: 'This provider requires authentication - provide an authConfigId.'
        })
      );
    }

    let triggerGroups = await db.slateTriggerGroup.findMany({
      where: { slateOid: slateInstance.slateOid }
    });

    let registrationOid = await db.$transaction(async db => {
      let registration = await db.triggerRegistration.create({
        data: {
          ...getId('triggerRegistration'),
          tenantOid: d.tenant.oid,
          slateOid: slateInstance.slateOid,
          instanceOid: slateInstance.oid,
          instanceConfigOid: slateInstance.currentConfig!.oid,
          authConfigOid: authConfig?.oid
        }
      });

      if (triggerGroups.length > 0) {
        await db.triggerRegistrationInstance.createMany({
          data: triggerGroups.map(triggerGroup => ({
            ...getId('triggerRegistrationInstance'),
            triggerRegistrationOid: registration.oid,
            triggerGroupOid: triggerGroup.oid
          }))
        });
      }

      return registration.oid;
    });

    let instances = await db.triggerRegistrationInstance.findMany({
      where: { triggerRegistrationOid: registrationOid },
      select: { id: true }
    });
    if (instances.length > 0) {
      await triggerRegistrationInstanceSetupQueue.addMany(
        instances.map(instance => ({ triggerRegistrationInstanceId: instance.id }))
      );
    }

    return db.triggerRegistration.findUniqueOrThrow({
      where: { oid: registrationOid },
      include
    });
  }

  async deleteTriggerRegistration(d: {
    tenant: Tenant;
    registration: { oid: bigint; tenantOid: bigint };
  }) {
    if (d.registration.tenantOid !== d.tenant.oid) {
      throw new ServiceError(notFoundError('trigger_registration'));
    }

    await db.$transaction(async db => {
      await db.triggerRegistration.update({
        where: { oid: d.registration.oid },
        data: { status: 'deleted' }
      });

      await db.triggerRegistrationSchedule.updateMany({
        where: { triggerRegistrationInstance: { triggerRegistrationOid: d.registration.oid } },
        data: { isDisabled: true }
      });
    });
  }
}

export let triggerRegistrationService = Service.create(
  'triggerRegistrationService',
  () => new triggerRegistrationServiceImpl()
).build();

import {
  badRequestError,
  isServiceError,
  notFoundError,
  ServiceError
} from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { SlatesTriggerGroup } from '@slates/proto';
import {
  Prisma,
  type Slate,
  type SlateInstance,
  type SlateTriggerGroup,
  type Tenant,
  type TriggerRegistration
} from '../../prisma/generated/client';
import { db } from '../db';
import { getId } from '../id';
import { getActiveSlateVersion } from '../lib/slateVersion';
import {
  describeSelectableTriggerGroups,
  validateTriggerGroupSelections
} from '../lib/triggerGroupSelection';
import { triggerRegistrationCleanupQueue } from '../queues/trigger/registrationCleanup';
import { triggerRegistrationInstanceSetupQueue } from '../queues/trigger/setup';
import { slateService } from './slate';

let include = {
  slate: true,
  instance: true,
  instanceConfig: true,
  authConfig: { include: { authMethod: true } },
  instances: { include: { triggerGroup: true, schedule: true } }
};

let listActiveTriggerGroups = async (d: { slate: Slate; instance: SlateInstance }) => {
  let version = await getActiveSlateVersion(d);
  if (!version.specificationOid) {
    throw new ServiceError(
      badRequestError({ message: 'Provider version has no specification set.' })
    );
  }

  return db.slateTriggerGroup.findMany({
    where: {
      slateOid: d.slate.oid,
      slateSpecifications: { some: { specificationOid: version.specificationOid } }
    }
  });
};

let describeGroups = (groups: SlateTriggerGroup[], selectionRequiredKeys: Set<string>) =>
  describeSelectableTriggerGroups(
    groups.map(group => ({
      key: group.key,
      name: group.name,
      spec: group.spec as SlatesTriggerGroup
    })),
    selectionRequiredKeys
  );

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

  async getManyTriggerRegistrationsByIds(d: { tenant: Tenant; ids: string[] }) {
    return db.triggerRegistration.findMany({
      where: { tenantOid: d.tenant.oid, id: { in: d.ids }, status: { not: 'deleted' } },
      include
    });
  }

  async createTriggerRegistration(d: {
    tenant: Tenant;
    input: {
      slateInstanceId: string;
      authConfigId?: string;
      triggerGroupSelections?: Record<string, Record<string, any>>;
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

    let triggerGroups = await listActiveTriggerGroups({
      slate: slateInstance.slate,
      instance: slateInstance
    });

    let { selections, skippedGroupIds, ignoredSelectionKeys } = validateTriggerGroupSelections(
      triggerGroups.map(group => ({ ...group.spec, id: group.key })),
      d.input.triggerGroupSelections
    );
    let activeTriggerGroups = triggerGroups.filter(group => !skippedGroupIds.has(group.key));
    let selectableTriggerGroups = describeGroups(triggerGroups, skippedGroupIds);

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

      if (activeTriggerGroups.length > 0) {
        await db.triggerRegistrationInstance.createMany({
          data: activeTriggerGroups.map(triggerGroup => ({
            ...getId('triggerRegistrationInstance'),
            triggerRegistrationOid: registration.oid,
            triggerGroupOid: triggerGroup.oid,
            selection: selections.get(triggerGroup.key) ?? Prisma.DbNull
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
      await triggerRegistrationInstanceSetupQueue.addManyWithOps(
        instances.map(instance => ({
          data: { triggerRegistrationInstanceId: instance.id },
          opts: { id: instance.id }
        }))
      );
    }

    let registration = await db.triggerRegistration.findUniqueOrThrow({
      where: { oid: registrationOid },
      include
    });

    return { ...registration, selectableTriggerGroups, ignoredSelectionKeys };
  }

  async listSelectableTriggerGroups(d: {
    registration: TriggerRegistration & {
      slate: Slate;
      instance: SlateInstance;
      instances: { triggerGroupOid: bigint }[];
    };
  }) {
    // Reading a registration must not fail because its provider has no deployable version.
    let triggerGroups = await listActiveTriggerGroups(d.registration).catch(error => {
      if (isServiceError(error)) return [];
      throw error;
    });
    let registered = new Set(d.registration.instances.map(i => i.triggerGroupOid));

    return describeGroups(
      triggerGroups,
      new Set(triggerGroups.filter(g => !registered.has(g.oid)).map(g => g.key))
    );
  }

  async deleteTriggerRegistration(d: { tenant: Tenant; registration: TriggerRegistration }) {
    if (d.registration.tenantOid !== d.tenant.oid) {
      throw new ServiceError(notFoundError('trigger_registration'));
    }

    await db.triggerRegistration.update({
      where: { oid: d.registration.oid },
      data: { status: 'deleted' }
    });

    await triggerRegistrationCleanupQueue.add(
      { triggerRegistrationId: d.registration.id },
      { id: d.registration.id }
    );
  }
}

export let triggerRegistrationService = Service.create(
  'triggerRegistrationService',
  () => new triggerRegistrationServiceImpl()
).build();

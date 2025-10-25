import { Context } from '@metorial/context';
import {
  db,
  ID,
  Instance,
  MachineAccess,
  Organization,
  OrganizationActor,
  withTransaction
} from '@metorial/db';
import { forbiddenError, ServiceError } from '@metorial/error';
import { Fabric } from '@metorial/fabric';
import { organizationActorService } from '@metorial/module-organization';
import { Service } from '@metorial/service';

class MachineAccessService {
  private async ensureMachineAccessActive(machineAccess: MachineAccess) {
    if (machineAccess.status !== 'active') {
      throw new ServiceError(
        forbiddenError({
          message: 'Cannot perform this action on a deleted machine access'
        })
      );
    }
  }

  async createMachineAccess(
    d: {
      input: {
        name: string;
      };
      context: Context;
    } & (
      | {
          type: 'organization_management';
          organization: Organization;
          performedBy: OrganizationActor;
        }
      | {
          type: 'instance_secret' | 'instance_publishable';
          organization: Organization;
          instance: Instance;
          performedBy: OrganizationActor;
        }
    )
  ) {
    let res = await withTransaction(async db => {
      await Fabric.fire('machine_access.created:before', d);

      let actor = await organizationActorService.createOrganizationActor({
        input: {
          type: 'machine_access',
          name: d.input.name,
          image: { type: 'default' }
        },
        organization: d.organization,
        context: d.context,
        performedBy: { type: 'actor', actor: d.performedBy }
      });

      let machineAccess = await db.machineAccess.create({
        data: {
          id: await ID.generateId('machineAccess'),
          status: 'active',
          type: d.type,
          name: d.input.name,
          organizationOid: d.organization.oid,
          instanceOid:
            d.type === 'instance_secret' || d.type === 'instance_publishable'
              ? d.instance.oid
              : null,
          actorOid: actor?.oid
        }
      });

      return machineAccess;
    });

    await Fabric.fire('machine_access.created:after', {
      ...d,
      machineAccess: res
    });

    return res;
  }

  async updateMachineAccess(d: {
    machineAccess: MachineAccess;
    input: {
      name?: string;
    };
    performedBy: OrganizationActor;
    context: Context;
  }) {
    await this.ensureMachineAccessActive(d.machineAccess);

    let org = await db.organization.findUniqueOrThrow({
      where: { oid: d.performedBy.organizationOid }
    });

    await Fabric.fire('machine_access.updated:before', {
      ...d,
      organization: org,
      machineAccess: d.machineAccess
    });

    let res = await withTransaction(async db => {
      let machineAccess = await db.machineAccess.update({
        where: { oid: d.machineAccess.oid },
        data: {
          name: d.input.name
        }
      });

      return machineAccess;
    });

    await Fabric.fire('machine_access.updated:after', {
      ...d,
      organization: org,
      machineAccess: res
    });

    return res;
  }

  async deleteMachineAccess(d: {
    machineAccess: MachineAccess;
    performedBy: OrganizationActor;
    context: Context;
  }) {
    await this.ensureMachineAccessActive(d.machineAccess);

    let org = await db.organization.findUniqueOrThrow({
      where: { oid: d.performedBy.organizationOid }
    });

    await Fabric.fire('machine_access.deleted:before', {
      ...d,
      organization: org,
      machineAccess: d.machineAccess
    });

    let res = await withTransaction(async db => {
      let machineAccess = await db.machineAccess.update({
        where: { oid: d.machineAccess.oid },
        data: {
          status: 'deleted',
          deletedAt: new Date()
        }
      });

      return machineAccess;
    });

    await Fabric.fire('machine_access.deleted:after', {
      ...d,
      organization: org,
      machineAccess: res
    });

    return res;
  }
}

export let machineAccessService = Service.create(
  'machineAccessService',
  () => new MachineAccessService()
).build();

import { conflictError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import {
  db,
  type Instance,
  type SandboxDisk,
  type SandboxMachine,
  type SandboxResourceStatus
} from '@metorial/db';
import { getRegional, type SandboxTenantWithRegion } from '../lib/regional';

export type SandboxDiskWithTenant = SandboxDisk & { tenant: SandboxTenantWithRegion };

export let sandboxDiskInclude = { tenant: { include: { region: true } } } as const;

class SandboxDiskInternalServiceImpl {
  assertActive(disk: { status: SandboxResourceStatus }) {
    if (disk.status != 'active') {
      throw new ServiceError(
        conflictError({ message: 'Cannot perform this action on a deleted disk' })
      );
    }
  }

  assertStandard(disk: { type: SandboxDisk['type'] }) {
    if (disk.type != 'standard') {
      throw new ServiceError(
        conflictError({ message: 'Root filesystem disks are managed by their machine' })
      );
    }
  }

  async record<Remote extends { id: string }>(d: {
    instance: Instance;
    tenant: SandboxTenantWithRegion;
    remote: Remote;
  }) {
    try {
      let disk = await db.sandboxDisk.create({
        data: {
          id: d.remote.id,
          tenantOid: d.tenant.oid,
          organizationOid: d.tenant.organizationOid,
          projectOid: d.tenant.projectOid,
          instanceOid: d.instance.oid
        },
        include: sandboxDiskInclude
      });

      return { ...disk, remote: d.remote };
    } catch (err) {
      let { genesis, tenantId } = getRegional(d.tenant);
      await genesis.disk.delete({ tenantId, diskId: d.remote.id }).catch(() => undefined);

      throw err;
    }
  }

  async recordRootFs(d: {
    machine: SandboxMachine;
    remote: {
      rootFs: { desired: { diskId: string } | null; current: { diskId: string } | null };
    };
  }) {
    let diskIds = [
      ...new Set(
        [d.remote.rootFs.desired?.diskId, d.remote.rootFs.current?.diskId].filter(
          (diskId): diskId is string => !!diskId
        )
      )
    ];
    if (!diskIds.length) return;

    await db.sandboxDisk.createMany({
      data: diskIds.map(id => ({
        id,
        type: 'root_fs' as const,
        tenantOid: d.machine.tenantOid,
        organizationOid: d.machine.organizationOid,
        projectOid: d.machine.projectOid,
        instanceOid: d.machine.instanceOid,
        machineOid: d.machine.oid
      })),
      skipDuplicates: true
    });

    await db.sandboxDisk.updateMany({
      where: {
        machineOid: d.machine.oid,
        type: 'root_fs',
        status: 'active',
        id: { notIn: diskIds }
      },
      data: { status: 'deleted', deletedAt: new Date() }
    });
  }
}

export let sandboxDiskInternalService = Service.create(
  'sandboxDiskInternalService',
  () => new SandboxDiskInternalServiceImpl()
).build();

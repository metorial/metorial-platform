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
import { indexSandboxDiskQueue } from '../queues/search';

export type SandboxDiskWithTenant = SandboxDisk & { tenant: SandboxTenantWithRegion };

export let sandboxDiskInclude = { tenant: { include: { region: true } } } as const;

type RootFsDisk = { diskId: string; diskSizeBytes: string };

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

  async record<Remote extends { id: string; name: string | null; sizeBytes: string }>(d: {
    instance: Instance;
    tenant: SandboxTenantWithRegion;
    remote: Remote;
    metadata?: Record<string, any>;
  }) {
    let disk = await db.sandboxDisk
      .create({
        data: {
          id: d.remote.id,
          name: d.remote.name,
          metadata: d.metadata ?? {},
          sizeBytes: BigInt(d.remote.sizeBytes),
          tenantOid: d.tenant.oid,
          organizationOid: d.tenant.organizationOid,
          projectOid: d.tenant.projectOid,
          instanceOid: d.instance.oid
        },
        include: sandboxDiskInclude
      })
      .catch(async err => {
        let { genesis, tenantId } = getRegional(d.tenant);
        await genesis.disk.delete({ tenantId, diskId: d.remote.id }).catch(() => undefined);

        throw err;
      });

    await indexSandboxDiskQueue.add({ diskOid: disk.oid.toString() });

    return { ...disk, remote: d.remote };
  }

  async recordRootFs(d: {
    machine: SandboxMachine;
    remote: { rootFs: { desired: RootFsDisk | null; current: RootFsDisk | null } };
  }) {
    let rootDisks = new Map<string, RootFsDisk>();
    for (let rootFs of [d.remote.rootFs.desired, d.remote.rootFs.current]) {
      if (rootFs && !rootDisks.has(rootFs.diskId)) rootDisks.set(rootFs.diskId, rootFs);
    }

    let diskIds = [...rootDisks.keys()];
    if (!diskIds.length) return;

    await db.sandboxDisk.createMany({
      data: [...rootDisks.values()].map(rootFs => ({
        id: rootFs.diskId,
        sizeBytes: BigInt(rootFs.diskSizeBytes),
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

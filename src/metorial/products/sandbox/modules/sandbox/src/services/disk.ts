import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  type Instance,
  type SandboxDiskType,
  type SandboxResourceStatus
} from '@metorial/db';
import type { GenesisInternalClient } from '@metorial/genesis-client';
import {
  sandboxDiskInclude,
  sandboxDiskInternalService,
  type SandboxDiskWithTenant
} from '../internal/diskInternal';
import { getRegional, hydrateByTenant } from '../lib/regional';
import { createRemotePaginator } from '../lib/remotePaginator';
import { sandboxRegionService } from './region';
import { sandboxTenantService } from './tenant';

type CreateDiskInput = Parameters<GenesisInternalClient['disk']['create']>[0];

class SandboxDiskServiceImpl {
  private async hydrate(disks: SandboxDiskWithTenant[]) {
    let hydrated = await hydrateByTenant(disks, ({ genesis, tenantId, ids }) =>
      genesis.disk.getMany({ tenantId, ids })
    );

    return hydrated;
  }

  private async resolveMachineDiskIds(d: { instance: Instance; machineIds: string[] }) {
    let machines = await db.sandboxMachine.findMany({
      where: { id: { in: d.machineIds }, instanceOid: d.instance.oid },
      include: sandboxDiskInclude
    });

    let hydrated = await hydrateByTenant(machines, ({ genesis, tenantId, ids }) =>
      genesis.machine.getMany({ tenantId, ids })
    );

    return [
      ...new Set(
        hydrated.flatMap(machine => {
          let remote = machine.remote;
          if (!remote) return [];

          return [
            remote.rootFs.current?.diskId,
            remote.rootFs.desired?.diskId,
            ...remote.disks.filter(disk => disk.state != 'released').map(disk => disk.diskId)
          ].filter((diskId): diskId is string => !!diskId);
        })
      )
    ];
  }

  async create(d: {
    instance: Instance;
    regionIdentifier: string;
    input: {
      name?: CreateDiskInput['name'];
      sizeBytes?: CreateDiskInput['sizeBytes'];
      idempotencyKey?: string;
    };
  }) {
    let region = await sandboxRegionService.getByIdentifier({
      identifier: d.regionIdentifier
    });
    let tenant = await sandboxTenantService.ensure({ instance: d.instance, region });
    let { genesis, tenantId } = getRegional(tenant);

    let remote = await genesis.disk.create({ tenantId, ...d.input });

    return await sandboxDiskInternalService.record({ instance: d.instance, tenant, remote });
  }

  async clone(d: {
    instance: Instance;
    disk: SandboxDiskWithTenant;
    input: { name?: string; idempotencyKey?: string };
  }) {
    sandboxDiskInternalService.assertStandard(d.disk);
    sandboxDiskInternalService.assertActive(d.disk);

    let { genesis, tenantId } = getRegional(d.disk.tenant);
    let remote = await genesis.disk.clone({ tenantId, diskId: d.disk.id, ...d.input });

    return await sandboxDiskInternalService.record({
      instance: d.instance,
      tenant: d.disk.tenant,
      remote
    });
  }

  async get(d: { instance: Instance; diskId: string; statuses?: SandboxResourceStatus[] }) {
    let disk = await db.sandboxDisk.findFirst({
      where: {
        id: d.diskId,
        instanceOid: d.instance.oid,
        ...(d.statuses ? { status: { in: d.statuses } } : {})
      },
      include: sandboxDiskInclude
    });
    if (!disk) throw new ServiceError(notFoundError('sandbox_disk', d.diskId));

    let [hydrated] = await this.hydrate([disk]);

    return hydrated!;
  }

  list(d: { instance: Instance; types?: SandboxDiskType[]; machineIds?: string[] }) {
    let machineDiskIds: Promise<string[]> | undefined;

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        if (d.machineIds && !machineDiskIds) {
          machineDiskIds = this.resolveMachineDiskIds({
            instance: d.instance,
            machineIds: d.machineIds
          });
        }

        let diskIds = await machineDiskIds;

        return await db.sandboxDisk.findMany({
          ...opts,
          where: {
            instanceOid: d.instance.oid,
            status: 'active',
            ...(d.types ? { type: { in: d.types } } : {}),
            ...(diskIds ? { id: { in: diskIds } } : {})
          },
          include: sandboxDiskInclude
        });
      })
    ).mapAll(disks => this.hydrate(disks));
  }

  async delete(d: { disk: SandboxDiskWithTenant }) {
    sandboxDiskInternalService.assertStandard(d.disk);
    sandboxDiskInternalService.assertActive(d.disk);

    let { genesis, tenantId } = getRegional(d.disk.tenant);
    let remote = await genesis.disk.delete({ tenantId, diskId: d.disk.id });

    let disk = await db.sandboxDisk.update({
      where: { oid: d.disk.oid },
      data: { status: 'deleted', deletedAt: new Date() },
      include: sandboxDiskInclude
    });

    return { ...disk, remote };
  }

  mounts(d: { disk: SandboxDiskWithTenant }) {
    sandboxDiskInternalService.assertStandard(d.disk);

    let { genesis, tenantId } = getRegional(d.disk.tenant);

    return createRemotePaginator(
      page => genesis.disk.mounts({ tenantId, diskId: d.disk.id, ...page }),
      { defaultOrder: 'desc' }
    );
  }
}

export let sandboxDiskService = Service.create(
  'sandboxDiskService',
  () => new SandboxDiskServiceImpl()
).build();

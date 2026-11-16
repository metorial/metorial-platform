import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { AuditScope } from '@metorial/audit-scope';
import {
  db,
  type Instance,
  type Prisma,
  type SandboxDiskType,
  type SandboxResourceStatus
} from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import type { GenesisInternalClient } from '@metorial/genesis-client';
import {
  buildSearchFilter,
  isSearchEnabled,
  searchSandboxDiskIds
} from '@metorial/module-search';
import {
  sandboxDiskInclude,
  sandboxDiskInternalService,
  type SandboxDiskWithTenant
} from '../internal/diskInternal';
import { toAuditDisk } from '../lib/audit';
import { getRegional, hydrateByTenant } from '../lib/regional';
import { createRemotePaginator } from '../lib/remotePaginator';
import { indexSandboxDiskQueue } from '../queues/search';
import { sandboxRegionService } from './region';
import { sandboxTenantService } from './tenant';

type CreateDiskInput = Parameters<GenesisInternalClient['disk']['create']>[0];

let MACHINE_PAGE_SIZE = 500;

class SandboxDiskServiceImpl {
  private async hydrate(disks: SandboxDiskWithTenant[]) {
    let hydrated = await hydrateByTenant(disks, ({ genesis, tenantId, ids }) =>
      genesis.disk.getMany({ tenantId, ids })
    );

    let attached = hydrated.flatMap(disk =>
      disk.remote?.machine ? [{ id: disk.remote.machine.machineId, tenant: disk.tenant }] : []
    );
    let machines = await hydrateByTenant(attached, ({ genesis, tenantId, ids }) =>
      genesis.machine.getMany({ tenantId, ids: [...new Set(ids)] })
    );
    let names = new Map(machines.map(machine => [machine.id, machine.remote]));

    return hydrated.map(disk => {
      let attachedMachine = disk.remote?.machine
        ? names.get(disk.remote.machine.machineId)
        : null;

      return { ...disk, ...(attachedMachine ? { attachedMachine } : {}) };
    });
  }

  private async resolveMachineDiskIds(d: { instance: Instance; machineIds?: string[] }) {
    let diskIds = new Set<string>();
    let cursor: bigint | undefined;

    while (true) {
      let machines = await db.sandboxMachine.findMany({
        where: {
          instanceOid: d.instance.oid,
          ...(d.machineIds ? { id: { in: d.machineIds } } : { status: 'active' as const }),
          ...(cursor !== undefined ? { oid: { gt: cursor } } : {})
        },
        orderBy: { oid: 'asc' },
        take: MACHINE_PAGE_SIZE,
        include: sandboxDiskInclude
      });

      let hydrated = await hydrateByTenant(machines, ({ genesis, tenantId, ids }) =>
        genesis.machine.getMany({ tenantId, ids })
      );

      for (let machine of hydrated) {
        let remote = machine.remote;
        if (!remote) continue;

        for (let diskId of [
          remote.rootFs.current?.diskId,
          remote.rootFs.desired?.diskId,
          ...remote.disks.filter(disk => disk.state != 'released').map(disk => disk.diskId)
        ]) {
          if (diskId) diskIds.add(diskId);
        }
      }

      if (machines.length < MACHINE_PAGE_SIZE) break;
      cursor = machines[machines.length - 1]!.oid;
    }

    return [...diskIds];
  }

  private toIdFilter(d: {
    diskIds?: string[];
    machineDiskIds?: string[];
    attachedDiskIds?: string[];
    attached?: boolean;
  }) {
    let filter: { in?: string[]; notIn?: string[] } = {};

    if (d.diskIds) filter.in = d.diskIds;

    if (d.machineDiskIds) {
      let machineDisks = new Set(d.machineDiskIds);
      filter.in = filter.in ? filter.in.filter(id => machineDisks.has(id)) : d.machineDiskIds;
    }

    if (d.attachedDiskIds && d.attached) {
      let attached = new Set(d.attachedDiskIds);
      filter.in = filter.in ? filter.in.filter(id => attached.has(id)) : d.attachedDiskIds;
    }

    if (d.attachedDiskIds && d.attached === false) filter.notIn = d.attachedDiskIds;

    return Object.keys(filter).length ? { id: filter } : {};
  }

  async create(d: {
    instance: Instance;
    auditScope: AuditScope;
    regionIdentifier: string;
    input: {
      name?: CreateDiskInput['name'];
      metadata?: Record<string, any>;
      sizeBytes?: CreateDiskInput['sizeBytes'];
      idempotencyKey?: string;
    };
  }) {
    let region = await sandboxRegionService.getByIdentifier({
      identifier: d.regionIdentifier
    });
    let tenant = await sandboxTenantService.ensure({ instance: d.instance, region });
    let { genesis, tenantId } = getRegional(tenant);

    let { metadata, ...input } = d.input;
    let remote = await genesis.disk.create({ tenantId, ...input });

    let disk = await sandboxDiskInternalService.record({
      instance: d.instance,
      tenant,
      remote,
      metadata
    });
    await Fabric.fire('sandbox.disk.created:after', {
      auditScope: d.auditScope,
      disk: toAuditDisk(disk),
      sourceDiskId: null,
      sourceImageId: null
    });

    return disk;
  }

  async clone(d: {
    instance: Instance;
    auditScope: AuditScope;
    disk: SandboxDiskWithTenant;
    input: { name?: string; idempotencyKey?: string; metadata?: Record<string, any> };
  }) {
    sandboxDiskInternalService.assertStandard(d.disk);
    sandboxDiskInternalService.assertActive(d.disk);

    let { genesis, tenantId } = getRegional(d.disk.tenant);
    let { metadata, ...input } = d.input;
    let remote = await genesis.disk.clone({ tenantId, diskId: d.disk.id, ...input });

    let disk = await sandboxDiskInternalService.record({
      instance: d.instance,
      tenant: d.disk.tenant,
      metadata,
      remote
    });
    await Fabric.fire('sandbox.disk.created:after', {
      auditScope: d.auditScope,
      disk: toAuditDisk(disk),
      sourceDiskId: d.disk.id,
      sourceImageId: null
    });

    return disk;
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

  list(d: {
    instance: Instance;
    diskIds?: string[];
    types?: SandboxDiskType[];
    machineIds?: string[];
    regionIdentifiers?: string[];
    attached?: boolean;
    search?: string;
  }) {
    let machineDiskIds: Promise<string[]> | undefined;
    let attachedDiskIds: Promise<string[]> | undefined;
    let searchFilter: Promise<Prisma.SandboxDiskWhereInput | undefined> | undefined;

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        searchFilter ??= this.resolveSearchFilter({ instance: d.instance, search: d.search });

        if (d.machineIds) {
          machineDiskIds ??= this.resolveMachineDiskIds({
            instance: d.instance,
            machineIds: d.machineIds
          });
        }
        if (d.attached !== undefined) {
          attachedDiskIds ??= this.resolveMachineDiskIds({ instance: d.instance });
        }

        let search = await searchFilter;

        let idFilter = this.toIdFilter({
          diskIds: d.diskIds,
          machineDiskIds: await machineDiskIds,
          attachedDiskIds: await attachedDiskIds,
          attached: d.attached
        });

        return await db.sandboxDisk.findMany({
          ...opts,
          where: {
            instanceOid: d.instance.oid,
            status: 'active',
            ...(d.types ? { type: { in: d.types } } : {}),
            ...(d.regionIdentifiers
              ? { tenant: { region: { identifier: { in: d.regionIdentifiers } } } }
              : {}),
            ...search,
            ...idFilter
          },
          include: sandboxDiskInclude
        });
      })
    ).mapAll(disks => this.hydrate(disks));
  }

  private async resolveSearchFilter(d: {
    instance: Instance;
    search?: string;
  }): Promise<Prisma.SandboxDiskWhereInput | undefined> {
    if (!isSearchEnabled()) {
      let search = d.search?.trim();
      if (!search) return undefined;

      return {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { id: { contains: search, mode: 'insensitive' } }
        ]
      };
    }

    return await buildSearchFilter<Prisma.SandboxDiskWhereInput>({
      search: d.search,
      findIds: query => searchSandboxDiskIds({ instanceId: d.instance.id, query })
    });
  }

  async update(d: {
    disk: SandboxDiskWithTenant;
    auditScope: AuditScope;
    input: { name?: string | null; metadata?: Record<string, any> };
  }) {
    if (d.input.name !== undefined) sandboxDiskInternalService.assertStandard(d.disk);
    sandboxDiskInternalService.assertActive(d.disk);

    let disk = await db.sandboxDisk.update({
      where: { oid: d.disk.oid },
      data: { name: d.input.name, metadata: d.input.metadata },
      include: sandboxDiskInclude
    });

    if (disk.type == 'standard') {
      await indexSandboxDiskQueue.add({ diskOid: disk.oid.toString() });
    }

    let [hydrated] = await this.hydrate([disk]);
    await Fabric.fire('sandbox.disk.updated:after', {
      auditScope: d.auditScope,
      disk: toAuditDisk(disk),
      previousDisk: toAuditDisk(d.disk)
    });

    return hydrated!;
  }

  async delete(d: { disk: SandboxDiskWithTenant; auditScope: AuditScope }) {
    sandboxDiskInternalService.assertStandard(d.disk);
    sandboxDiskInternalService.assertActive(d.disk);

    let { genesis, tenantId } = getRegional(d.disk.tenant);
    let remote = await genesis.disk.delete({ tenantId, diskId: d.disk.id });

    let disk = await db.sandboxDisk.update({
      where: { oid: d.disk.oid },
      data: { status: 'deleted', deletedAt: new Date(), sizeBytes: BigInt(remote.sizeBytes) },
      include: sandboxDiskInclude
    });

    await indexSandboxDiskQueue.add({ diskOid: disk.oid.toString() });
    await Fabric.fire('sandbox.disk.deleted:after', {
      auditScope: d.auditScope,
      disk: toAuditDisk(d.disk)
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

import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  type Instance,
  type SandboxRegion,
  type SandboxResourceStatus
} from '@metorial/db';
import type { GenesisInternalClient } from '@metorial/genesis-client';
import {
  assertMachineActive,
  getRegional,
  hydrateByTenant,
  type SandboxMachineWithTenant,
  type SandboxTenantWithRegion
} from '../lib/regional';
import { isSearchEnabled, searchSandboxMachineIds } from '@metorial/module-search';
import { sandboxDiskInternalService } from '../internal/diskInternal';
import { createRemotePaginator } from '../lib/remotePaginator';
import { indexSandboxMachineQueue } from '../queues/search';
import { sandboxMachineEgressInternalService } from '../internal/machineEgressInternal';
import { sandboxRegionService } from './region';
import { sandboxSpecService } from './spec';
import { sandboxTenantService } from './tenant';

type CreateMachineInput = Parameters<GenesisInternalClient['machine']['create']>[0];
type UpdateMachineInput = Parameters<GenesisInternalClient['machine']['update']>[0];

export let sandboxMachineInclude = {
  tenant: { include: { region: true } },
  instance: true,
  firewallLinks: { orderBy: { position: 'asc' }, include: { firewall: true } }
} as const;

class SandboxMachineServiceImpl {
  private async hydrate<Machine extends SandboxMachineWithTenant>(machines: Machine[]) {
    return await hydrateByTenant(machines, ({ genesis, tenantId, ids }) =>
      genesis.machine.getMany({ tenantId, ids })
    );
  }

  private async resolveImage(d: {
    instance: Instance;
    region: SandboxRegion;
    imageId: string;
  }) {
    let regional = await db.sandboxMachineImageRegion.findFirst({
      where: {
        regionOid: d.region.oid,
        status: 'active',
        image: {
          id: d.imageId,
          status: 'active',
          OR: [{ instanceOid: null }, { instanceOid: d.instance.oid }]
        }
      }
    });
    if (!regional) {
      throw new ServiceError(
        badRequestError({
          message: `Image ${d.imageId} is not available in region ${d.region.identifier}`
        })
      );
    }

    return { imageId: regional.genesisId, imageOid: regional.imageOid };
  }

  private async assertMounts(d: {
    instance: Instance;
    tenant: SandboxTenantWithRegion;
    mounts: { diskId: string; mountPath: string }[];
  }) {
    let diskIds = [...new Set(d.mounts.map(mount => mount.diskId))];

    let count = await db.sandboxDisk.count({
      where: {
        id: { in: diskIds },
        tenantOid: d.tenant.oid,
        instanceOid: d.instance.oid,
        status: 'active'
      }
    });

    if (count != diskIds.length) {
      throw new ServiceError(
        badRequestError({
          message: `Every mounted disk must exist in region ${d.tenant.region.identifier}`
        })
      );
    }
  }

  async create(d: {
    instance: Instance;
    regionIdentifier: string;
    input: {
      name?: CreateMachineInput['name'];
      imageId: string;
      specId: string;
      lifecyclePolicy?: CreateMachineInput['lifecyclePolicy'];
      runtime?: CreateMachineInput['runtime'];
      lifecycleHooks?: CreateMachineInput['lifecycleHooks'];
      ignoreImageHooks?: CreateMachineInput['ignoreImageHooks'];
      entrypointWaitSeconds?: CreateMachineInput['entrypointWaitSeconds'];
      mounts?: { diskId: string; mountPath: string }[];
      firewallIds?: string[];
      publicPorts?: CreateMachineInput['publicPorts'];
      idempotencyKey?: string;
      start?: boolean;
    };
  }) {
    let region = await sandboxRegionService.getByIdentifier({
      identifier: d.regionIdentifier
    });
    let tenant = await sandboxTenantService.ensure({ instance: d.instance, region });

    let image = await this.resolveImage({
      instance: d.instance,
      region,
      imageId: d.input.imageId
    });
    let { spec } = await sandboxSpecService.resolve({ specId: d.input.specId, region });

    if (d.input.mounts) {
      await this.assertMounts({ instance: d.instance, tenant, mounts: d.input.mounts });
    }

    let firewallIds = [...new Set(d.input.firewallIds ?? [])];
    let egress = await sandboxMachineEgressInternalService.prepare({
      instance: d.instance,
      tenant,
      firewallIds
    });

    let { imageId: _imageId, specId: _specId, firewallIds: _firewallIds, ...rest } = d.input;
    let { imageOid, ...remoteImage } = image;
    let { genesis, tenantId } = getRegional(tenant);

    let remote = await genesis.machine.create({
      tenantId,
      ...rest,
      image: remoteImage,
      spec: { memoryMiB: spec.memoryMiB, vcpus: spec.vcpus },
      egressPolicyId: egress.region?.genesisId
    });

    try {
      let machine = await db.sandboxMachine.create({
        data: {
          id: remote.id,
          tenantOid: tenant.oid,
          organizationOid: tenant.organizationOid,
          projectOid: tenant.projectOid,
          instanceOid: d.instance.oid,
          imageOid
        },
        include: sandboxMachineInclude
      });
      await sandboxDiskInternalService.recordRootFs({ machine, remote });
      await sandboxMachineEgressInternalService.attach({
        machine,
        firewallIds,
        prepared: egress,
        applied: true
      });
      await indexSandboxMachineQueue.add({ machineOid: machine.oid.toString() });

      return { ...machine, remote };
    } catch (err) {
      await genesis.machine.terminate({ tenantId, machineId: remote.id });

      throw err;
    }
  }

  async get(d: { instance: Instance; machineId: string; statuses?: SandboxResourceStatus[] }) {
    let machine = await db.sandboxMachine.findFirst({
      where: {
        id: d.machineId,
        instanceOid: d.instance.oid,
        ...(d.statuses ? { status: { in: d.statuses } } : {})
      },
      include: sandboxMachineInclude
    });
    if (!machine) throw new ServiceError(notFoundError('sandbox_machine', d.machineId));

    let [hydrated] = await this.hydrate([machine]);

    return hydrated!;
  }

  async list(d: {
    instance: Instance;
    statuses?: SandboxResourceStatus[];
    imageIds?: string[];
    search?: string;
  }) {
    let searchIds: Promise<string[] | undefined> | undefined;

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        searchIds ??= this.resolveSearchIds({ instance: d.instance, search: d.search });
        let ids = await searchIds;

        return await db.sandboxMachine.findMany({
          ...opts,
          where: {
            instanceOid: d.instance.oid,
            status: d.statuses ? { in: d.statuses } : 'active',
            ...(d.imageIds ? { image: { id: { in: d.imageIds } } } : {}),
            ...(ids ? { id: { in: ids } } : {}),
            ...(d.search && !ids
              ? { id: { contains: d.search.trim(), mode: 'insensitive' as const } }
              : {})
          },
          include: sandboxMachineInclude
        });
      })
    ).mapAll(machines => this.hydrate(machines));
  }

  private async resolveSearchIds(d: {
    instance: Instance;
    search?: string;
  }): Promise<string[] | undefined> {
    let search = d.search?.trim();
    if (!search || !isSearchEnabled()) return undefined;

    return await searchSandboxMachineIds({ instanceId: d.instance.id, query: search });
  }

  async update<Machine extends SandboxMachineWithTenant & { instance: Instance }>(d: {
    machine: Machine;
    input: {
      name?: UpdateMachineInput['name'];
      imageId?: string;
      specId?: string;
      lifecyclePolicy?: UpdateMachineInput['lifecyclePolicy'];
      runtime?: UpdateMachineInput['runtime'];
      lifecycleHooks?: UpdateMachineInput['lifecycleHooks'];
      ignoreImageHooks?: UpdateMachineInput['ignoreImageHooks'];
      entrypointWaitSeconds?: UpdateMachineInput['entrypointWaitSeconds'];
      mounts?: { diskId: string; mountPath: string }[];
      firewallIds?: string[];
    };
  }) {
    assertMachineActive(d.machine);

    let { region } = d.machine.tenant;
    let { imageId, specId, firewallIds, ...rest } = d.input;

    let resolvedImage = imageId
      ? await this.resolveImage({ instance: d.machine.instance, region, imageId })
      : undefined;
    let image = resolvedImage ? { imageId: resolvedImage.imageId } : undefined;

    let spec = specId
      ? (await sandboxSpecService.resolve({ specId, region })).spec
      : undefined;

    if (d.input.mounts) {
      await this.assertMounts({
        instance: d.machine.instance,
        tenant: d.machine.tenant,
        mounts: d.input.mounts
      });
    }

    let { genesis, tenantId } = getRegional(d.machine.tenant);

    let remote = await genesis.machine.update({
      tenantId,
      machineId: d.machine.id,
      ...rest,
      image,
      spec: spec ? { memoryMiB: spec.memoryMiB, vcpus: spec.vcpus } : undefined
    });
    await sandboxDiskInternalService.recordRootFs({ machine: d.machine, remote });

    if (resolvedImage) {
      await db.sandboxMachine.update({
        where: { oid: d.machine.oid },
        data: { imageOid: resolvedImage.imageOid }
      });
    }

    if (firewallIds) {
      await sandboxMachineEgressInternalService.setFirewalls({
        machine: d.machine,
        firewallIds
      });
    }

    await indexSandboxMachineQueue.add({ machineOid: d.machine.oid.toString() });

    return { ...d.machine, remote };
  }

  private async act(d: {
    kind: 'start' | 'pause' | 'hibernate' | 'restart';
    machine: SandboxMachineWithTenant;
  }) {
    assertMachineActive(d.machine);

    let { genesis, tenantId } = getRegional(d.machine.tenant);
    let remote = await genesis.machine[d.kind]({ tenantId, machineId: d.machine.id });

    return { ...d.machine, remote };
  }

  async start(d: { machine: SandboxMachineWithTenant }) {
    return await this.act({ kind: 'start', machine: d.machine });
  }

  async pause(d: { machine: SandboxMachineWithTenant }) {
    return await this.act({ kind: 'pause', machine: d.machine });
  }

  async hibernate(d: { machine: SandboxMachineWithTenant }) {
    return await this.act({ kind: 'hibernate', machine: d.machine });
  }

  async restart(d: { machine: SandboxMachineWithTenant }) {
    return await this.act({ kind: 'restart', machine: d.machine });
  }

  async touch(d: { machine: SandboxMachineWithTenant }) {
    assertMachineActive(d.machine);

    let { genesis, tenantId } = getRegional(d.machine.tenant);
    let result = await genesis.machine.touch({ tenantId, machineId: d.machine.id });

    return {
      machine: { ...d.machine, remote: result.machine },
      pauseAt: result.pauseAt
    };
  }

  async terminate(d: { machine: SandboxMachineWithTenant }) {
    assertMachineActive(d.machine);

    let { genesis, tenantId } = getRegional(d.machine.tenant);
    let remote = await genesis.machine.terminate({ tenantId, machineId: d.machine.id });

    let machine = await db.sandboxMachine.update({
      where: { oid: d.machine.oid },
      data: { status: 'deleted', deletedAt: new Date() },
      include: sandboxMachineInclude
    });
    await db.sandboxDisk.updateMany({
      where: { machineOid: machine.oid, type: 'root_fs', status: 'active' },
      data: { status: 'deleted', deletedAt: machine.deletedAt }
    });
    await indexSandboxMachineQueue.add({ machineOid: machine.oid.toString() });

    return { ...machine, remote };
  }

  usage(d: { machine: SandboxMachineWithTenant; instanceIds?: string[] }) {
    let { genesis, tenantId } = getRegional(d.machine.tenant);

    return createRemotePaginator(
      page =>
        genesis.machine.usage({
          tenantId,
          machineId: d.machine.id,
          instanceIds: d.instanceIds,
          ...page
        }),
      { defaultOrder: 'desc' }
    );
  }
}

export let sandboxMachineService = Service.create(
  'sandboxMachineService',
  () => new SandboxMachineServiceImpl()
).build();

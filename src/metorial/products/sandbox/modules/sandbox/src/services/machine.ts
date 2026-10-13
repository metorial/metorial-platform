import { badRequestError, conflictError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  type Instance,
  type SandboxMachine,
  type SandboxRegion,
  type SandboxResourceStatus
} from '@metorial/db';
import type { GenesisInternalClient } from '@metorial/genesis-client';
import { getRegional, groupByTenant, type SandboxTenantWithRegion } from '../lib/regional';
import { sandboxRegionService } from './region';
import { sandboxSpecService } from './spec';
import { sandboxTenantService } from './tenant';

type CreateMachineInput = Parameters<GenesisInternalClient['machine']['create']>[0];
type UpdateMachineInput = Parameters<GenesisInternalClient['machine']['update']>[0];

type SandboxMachineWithTenant = SandboxMachine & { tenant: SandboxTenantWithRegion };

export let sandboxMachineInclude = {
  tenant: { include: { region: true } },
  instance: true
} as const;

class SandboxMachineServiceImpl {
  private assertActive(machine: SandboxMachine) {
    if (machine.status != 'active') {
      throw new ServiceError(
        conflictError({ message: 'Cannot perform this action on a terminated machine' })
      );
    }
  }

  private async hydrate(machines: SandboxMachineWithTenant[]) {
    let remotes = new Map<
      string,
      Awaited<ReturnType<GenesisInternalClient['machine']['get']>>
    >();

    await Promise.all(
      groupByTenant(machines).map(async group => {
        let { genesis, tenantId } = getRegional(group.tenant);
        let found = await genesis.machine.getMany({
          tenantId,
          ids: group.rows.map(machine => machine.id)
        });

        for (let remote of found) remotes.set(remote.id, remote);
      })
    );

    return machines.map(machine => ({ ...machine, remote: remotes.get(machine.id) ?? null }));
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

    return { imageId: regional.genesisId };
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

    let { imageId: _imageId, specId: _specId, ...rest } = d.input;
    let { genesis, tenantId } = getRegional(tenant);

    let remote = await genesis.machine.create({
      tenantId,
      ...rest,
      image,
      spec: { memoryMiB: spec.memoryMiB, vcpus: spec.vcpus }
    });

    try {
      let machine = await db.sandboxMachine.create({
        data: {
          id: remote.id,
          tenantOid: tenant.oid,
          organizationOid: tenant.organizationOid,
          projectOid: tenant.projectOid,
          instanceOid: d.instance.oid
        },
        include: sandboxMachineInclude
      });

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
        status: d.statuses ? { in: d.statuses } : 'active'
      },
      include: sandboxMachineInclude
    });
    if (!machine) throw new ServiceError(notFoundError('sandbox_machine', d.machineId));

    let [hydrated] = await this.hydrate([machine]);

    return hydrated!;
  }

  async list(d: { instance: Instance; statuses?: SandboxResourceStatus[] }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.sandboxMachine.findMany({
            ...opts,
            where: {
              instanceOid: d.instance.oid,
              status: d.statuses ? { in: d.statuses } : 'active'
            },
            include: sandboxMachineInclude
          })
      )
    ).mapAll(machines => this.hydrate(machines));
  }

  async update(d: {
    machine: SandboxMachineWithTenant & { instance: Instance };
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
    };
  }) {
    this.assertActive(d.machine);

    let { region } = d.machine.tenant;
    let { imageId, specId, ...rest } = d.input;

    let image = imageId
      ? await this.resolveImage({ instance: d.machine.instance, region, imageId })
      : undefined;

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

    return { ...d.machine, remote };
  }

  private async act(d: {
    kind: 'start' | 'pause' | 'hibernate' | 'restart';
    machine: SandboxMachineWithTenant;
  }) {
    this.assertActive(d.machine);

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
    this.assertActive(d.machine);

    let { genesis, tenantId } = getRegional(d.machine.tenant);
    let result = await genesis.machine.touch({ tenantId, machineId: d.machine.id });

    return {
      machine: { ...d.machine, remote: result.machine },
      pauseAt: result.pauseAt
    };
  }

  async terminate(d: { machine: SandboxMachineWithTenant }) {
    this.assertActive(d.machine);

    let { genesis, tenantId } = getRegional(d.machine.tenant);
    let remote = await genesis.machine.terminate({ tenantId, machineId: d.machine.id });

    let machine = await db.sandboxMachine.update({
      where: { oid: d.machine.oid },
      data: { status: 'deleted', deletedAt: new Date() },
      include: sandboxMachineInclude
    });

    return { ...machine, remote };
  }

  async resizeRootFs(d: {
    machine: SandboxMachineWithTenant;
    input: { sizeBytes: string; idempotencyKey: string };
  }) {
    this.assertActive(d.machine);

    let { genesis, tenantId } = getRegional(d.machine.tenant);

    return await genesis.machine.resizeRootFs({
      tenantId,
      machineId: d.machine.id,
      ...d.input
    });
  }
}

export let sandboxMachineService = Service.create(
  'sandboxMachineService',
  () => new SandboxMachineServiceImpl()
).build();

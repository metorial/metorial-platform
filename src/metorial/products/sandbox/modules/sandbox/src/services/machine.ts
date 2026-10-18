import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { AuditScope } from '@metorial/audit-scope';
import {
  db,
  type Instance,
  type Organization,
  type SandboxRegion,
  type SandboxResourceStatus
} from '@metorial/db';
import { Fabric } from '@metorial/fabric';
import type { GenesisInternalClient } from '@metorial/genesis-client';
import {
  assertMachineActive,
  getRegional,
  hydrateByTenant,
  sandboxTenantInclude,
  type SandboxMachineWithTenant,
  type SandboxTenantWithRegion
} from '../lib/regional';
import { isSearchEnabled, searchSandboxMachineIds } from '@metorial/module-search';
import { sandboxDiskInternalService } from '../internal/diskInternal';
import { toAuditMachine } from '../lib/audit';
import { createRemotePaginator } from '../lib/remotePaginator';
import { indexSandboxMachineQueue } from '../queues/search';
import { sandboxMachineEgressInternalService } from '../internal/machineEgressInternal';
import { sandboxRegionService } from './region';
import { sandboxSpecService, type SandboxSpecSelector } from './spec';
import { sandboxTenantService } from './tenant';

type CreateMachineInput = Parameters<GenesisInternalClient['machine']['create']>[0];
type UpdateMachineInput = Parameters<GenesisInternalClient['machine']['update']>[0];

export type SandboxMachineState = NonNullable<
  Parameters<GenesisInternalClient['machine']['list']>[0]['status']
>[number];

let STATE_PAGE_SIZE = 100;
let STATE_MAX_PAGES = 50;

export let sandboxMachineInclude = {
  tenant: { include: { region: true } },
  instance: true,
  image: { select: { id: true, name: true, identifier: true } },
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
    organization: Organization;
    auditScope: AuditScope;
    regionIdentifier: string;
    input: {
      name?: CreateMachineInput['name'];
      metadata?: Record<string, any>;
      imageId: string;
      spec: SandboxSpecSelector;
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
    let { spec } = await sandboxSpecService.resolve({
      selector: d.input.spec,
      region,
      organization: d.organization
    });

    if (d.input.mounts) {
      await this.assertMounts({ instance: d.instance, tenant, mounts: d.input.mounts });
    }

    let firewallIds = [...new Set(d.input.firewallIds ?? [])];
    let egress = await sandboxMachineEgressInternalService.prepare({
      instance: d.instance,
      tenant,
      firewallIds
    });

    let {
      imageId: _imageId,
      spec: _spec,
      firewallIds: _firewallIds,
      metadata,
      ...rest
    } = d.input;
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
          metadata: metadata ?? {},
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

      let created = { ...machine, remote };
      await Fabric.fire('sandbox.machine.created:after', {
        auditScope: d.auditScope,
        machine: toAuditMachine(created)
      });

      return created;
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
    machineIds?: string[];
    statuses?: SandboxResourceStatus[];
    states?: SandboxMachineState[];
    imageIds?: string[];
    regionIdentifiers?: string[];
    search?: string;
  }) {
    let searchIds: Promise<string[] | undefined> | undefined;
    let stateIds: Promise<string[]> | undefined;

    return Paginator.create(({ prisma }) =>
      prisma(async opts => {
        searchIds ??= this.resolveSearchIds({ instance: d.instance, search: d.search });
        if (d.states) {
          stateIds ??= this.resolveStateIds({
            instance: d.instance,
            states: d.states,
            regionIdentifiers: d.regionIdentifiers
          });
        }

        let ids = await searchIds;
        let idsInState = await stateIds;

        return await db.sandboxMachine.findMany({
          ...opts,
          where: {
            instanceOid: d.instance.oid,
            status: d.statuses ? { in: d.statuses } : 'active',
            ...(d.imageIds ? { image: { id: { in: d.imageIds } } } : {}),
            ...(d.regionIdentifiers
              ? { tenant: { region: { identifier: { in: d.regionIdentifiers } } } }
              : {}),
            ...(ids ? { id: { in: ids } } : {}),
            ...(d.search && !ids
              ? { id: { contains: d.search.trim(), mode: 'insensitive' as const } }
              : {}),
            ...(d.machineIds || idsInState
              ? {
                  AND: [
                    ...(d.machineIds ? [{ id: { in: d.machineIds } }] : []),
                    ...(idsInState ? [{ id: { in: idsInState } }] : [])
                  ]
                }
              : {})
          },
          include: sandboxMachineInclude
        });
      })
    ).mapAll(machines => this.hydrate(machines));
  }

  private async resolveStateIds(d: {
    instance: Instance;
    states: SandboxMachineState[];
    regionIdentifiers?: string[];
  }) {
    let tenants = await db.sandboxTenant.findMany({
      where: {
        machines: { some: { instanceOid: d.instance.oid } },
        ...(d.regionIdentifiers ? { region: { identifier: { in: d.regionIdentifiers } } } : {})
      },
      include: sandboxTenantInclude
    });

    let ids = await Promise.all(
      tenants.map(async tenant => {
        let { genesis, tenantId } = getRegional(tenant);
        let found: string[] = [];
        let after: string | undefined;

        for (let page = 0; page < STATE_MAX_PAGES; page++) {
          let result = await genesis.machine.list({
            tenantId,
            status: d.states,
            limit: STATE_PAGE_SIZE,
            after
          });
          found.push(...result.items.map(machine => machine.id));

          if (!result.pagination.hasMoreAfter || !result.items.length) break;
          after = result.items[result.items.length - 1]!.id;
        }

        return found;
      })
    );

    return ids.flat();
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
    organization: Organization;
    auditScope: AuditScope;
    input: {
      name?: UpdateMachineInput['name'];
      metadata?: Record<string, any>;
      spec?: SandboxSpecSelector;
      lifecyclePolicy?: UpdateMachineInput['lifecyclePolicy'];
      runtime?: UpdateMachineInput['runtime'];
      lifecycleHooks?: UpdateMachineInput['lifecycleHooks'];
      ignoreImageHooks?: UpdateMachineInput['ignoreImageHooks'];
      entrypointWaitSeconds?: UpdateMachineInput['entrypointWaitSeconds'];
      mounts?: { diskId: string; mountPath: string }[];
      firewallIds?: string[];
      publicPorts?: number[];
    };
  }) {
    assertMachineActive(d.machine);

    let { region } = d.machine.tenant;
    let { metadata, spec: specSelector, firewallIds, publicPorts, ...rest } = d.input;

    if (
      metadata !== undefined &&
      specSelector === undefined &&
      firewallIds === undefined &&
      publicPorts === undefined &&
      Object.values(rest).every(value => value === undefined)
    ) {
      let machine = await db.sandboxMachine.update({
        where: { oid: d.machine.oid },
        data: { metadata },
        include: sandboxMachineInclude
      });
      let [hydrated] = await this.hydrate([{ ...d.machine, ...machine }]);
      await this.fireUpdated(d, hydrated!);

      return hydrated!;
    }

    let spec = specSelector
      ? (
          await sandboxSpecService.resolve({
            selector: specSelector,
            region,
            organization: d.organization
          })
        ).spec
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
      spec: spec ? { memoryMiB: spec.memoryMiB, vcpus: spec.vcpus } : undefined
    });
    await sandboxDiskInternalService.recordRootFs({ machine: d.machine, remote });

    if (publicPorts) {
      remote = await genesis.machine.access.setPublicPorts({
        tenantId,
        machineId: d.machine.id,
        ports: publicPorts
      });
    }

    let machine =
      metadata !== undefined
        ? await db.sandboxMachine.update({
            where: { oid: d.machine.oid },
            data: { metadata },
            include: sandboxMachineInclude
          })
        : d.machine;

    if (firewallIds) {
      await sandboxMachineEgressInternalService.setFirewalls({
        machine: d.machine,
        firewallIds
      });
    }

    await indexSandboxMachineQueue.add({ machineOid: d.machine.oid.toString() });

    let updated = { ...machine, remote };
    await this.fireUpdated(d, updated);

    return updated;
  }

  private async fireUpdated(
    d: { machine: SandboxMachineWithTenant; auditScope: AuditScope },
    updated: SandboxMachineWithTenant & { remote?: any }
  ) {
    await Fabric.fire('sandbox.machine.updated:after', {
      auditScope: d.auditScope,
      machine: toAuditMachine({ ...d.machine, ...updated }),
      previousMachine: toAuditMachine(d.machine)
    });
  }

  private async act(d: {
    kind: 'start' | 'pause' | 'hibernate' | 'restart';
    machine: SandboxMachineWithTenant;
    auditScope: AuditScope;
  }) {
    assertMachineActive(d.machine);

    let { genesis, tenantId } = getRegional(d.machine.tenant);
    let remote = await genesis.machine[d.kind]({ tenantId, machineId: d.machine.id });

    let result = { ...d.machine, remote };
    await Fabric.fire('sandbox.machine.lifecycle:after', {
      auditScope: d.auditScope,
      machine: toAuditMachine({ ...d.machine, remote }),
      action: d.kind
    });

    return result;
  }

  async start(d: { machine: SandboxMachineWithTenant; auditScope: AuditScope }) {
    return await this.act({ kind: 'start', machine: d.machine, auditScope: d.auditScope });
  }

  async pause(d: { machine: SandboxMachineWithTenant; auditScope: AuditScope }) {
    return await this.act({ kind: 'pause', machine: d.machine, auditScope: d.auditScope });
  }

  async hibernate(d: { machine: SandboxMachineWithTenant; auditScope: AuditScope }) {
    return await this.act({ kind: 'hibernate', machine: d.machine, auditScope: d.auditScope });
  }

  async restart(d: { machine: SandboxMachineWithTenant; auditScope: AuditScope }) {
    return await this.act({ kind: 'restart', machine: d.machine, auditScope: d.auditScope });
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

  async terminate(d: { machine: SandboxMachineWithTenant; auditScope: AuditScope }) {
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

    let terminated = { ...machine, remote };
    await Fabric.fire('sandbox.machine.deleted:after', {
      auditScope: d.auditScope,
      machine: toAuditMachine({ ...d.machine, remote })
    });

    return terminated;
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

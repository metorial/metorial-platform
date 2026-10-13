import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  ID,
  withTransaction,
  type Instance,
  type SandboxMachineImage,
  type SandboxMachineImageBuildStatus
} from '@metorial/db';
import { resolveBuildRegion } from '../lib/buildRegion';
import { getRegional } from '../lib/regional';
import { getRegionClient } from '../lib/regions';
import { imageBuildRootQueue } from '../queues/imageBuild';
import { sandboxTenantService } from './tenant';

export let sandboxImageBuildInclude = {
  image: true,
  version: true,
  regions: { include: { region: true, tenant: true }, orderBy: { oid: 'asc' } }
} as const;

let ACTIVE_BUILD_STATUSES: SandboxMachineImageBuildStatus[] = [
  'preparing',
  'queued',
  'building',
  'processing',
  'replicating'
];

class SandboxImageBuildServiceImpl {
  async create(d: {
    instance: Instance;
    image: SandboxMachineImage;
    input: {
      dockerfilePath?: string;
      contextPath?: string;
      target?: string;
      buildArgs?: Record<string, string>;
      timeoutSeconds?: number;
      diskSizeBytes?: number;
      builderMemoryMiB?: number;
    };
  }) {
    if (d.image.instanceOid != d.instance.oid || d.image.status == 'deleted') {
      throw new ServiceError(notFoundError('sandbox_image', d.image.id));
    }

    let regions = await db.sandboxRegion.findMany({
      where: { status: 'active' },
      orderBy: { oid: 'asc' }
    });
    let buildRegion = resolveBuildRegion(regions);
    if (!buildRegion) {
      throw new ServiceError(badRequestError({ message: 'No sandbox regions are available' }));
    }

    let tenants = await Promise.all(
      regions.map(region => sandboxTenantService.ensure({ instance: d.instance, region }))
    );
    let builderTenant = tenants.find(tenant => tenant.regionOid == buildRegion.oid)!;
    let { genesis, tenantId } = getRegional(builderTenant);

    let buildId = await ID.generateId('sandboxMachineImageBuild');

    let genesisImage = await genesis.machineImage.create({
      tenantId,
      name: d.image.name ?? undefined,
      idempotencyKey: d.image.id
    });
    let remote = await genesis.machineImage.build.create({
      tenantId,
      imageId: genesisImage.id,
      options: d.input,
      idempotencyKey: buildId
    });

    try {
      let build = await withTransaction(async db => {
        let version = await db.sandboxMachineImageVersion.create({
          data: {
            id: await ID.generateId('sandboxMachineImageVersion'),
            releaseKey: `build:${buildId}`,
            imageOid: d.image.oid
          }
        });

        let created = await db.sandboxMachineImageBuild.create({
          data: {
            id: buildId,
            diskSizeBytes: BigInt(remote.options.diskSizeBytes),
            instanceOid: d.instance.oid,
            imageOid: d.image.oid,
            versionOid: version.oid
          }
        });

        for (let tenant of tenants) {
          let isBuilder = tenant.regionOid == buildRegion.oid;

          await db.sandboxMachineImageBuildRegion.create({
            data: {
              id: await ID.generateId('sandboxMachineImageBuildRegion'),
              kind: isBuilder ? 'builder' : 'replica',
              status: isBuilder ? 'preparing' : 'pending',
              attempt: isBuilder ? 1 : 0,
              genesisImageId: isBuilder ? genesisImage.id : null,
              genesisBuildId: isBuilder ? remote.id : null,
              logStreamId: isBuilder ? remote.logStreamId : null,
              buildOid: created.oid,
              regionOid: tenant.regionOid,
              tenantOid: tenant.oid
            }
          });
        }

        addAfterTransactionHook(() =>
          imageBuildRootQueue.add({ buildOid: created.oid.toString() })
        );

        return created;
      });

      return {
        build: await this.get({ instance: d.instance, buildId: build.id }),
        upload: remote.upload
      };
    } catch (err) {
      await genesis.machineImage.build
        .cancel({ tenantId, buildId: remote.id })
        .catch(() => undefined);

      throw err;
    }
  }

  async get(d: { instance: Instance; buildId: string }) {
    let build = await db.sandboxMachineImageBuild.findFirst({
      where: { id: d.buildId, instanceOid: d.instance.oid },
      include: sandboxImageBuildInclude
    });
    if (!build) throw new ServiceError(notFoundError('sandbox_image_build', d.buildId));

    return build;
  }

  async list(d: {
    instance: Instance;
    image?: SandboxMachineImage;
    statuses?: SandboxMachineImageBuildStatus[];
  }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.sandboxMachineImageBuild.findMany({
            ...opts,
            where: {
              instanceOid: d.instance.oid,
              ...(d.image ? { imageOid: d.image.oid } : {}),
              ...(d.statuses ? { status: { in: d.statuses } } : {})
            },
            include: sandboxImageBuildInclude
          })
      )
    );
  }

  async cancel(d: { instance: Instance; build: { id: string } }) {
    let build = await this.get({ instance: d.instance, buildId: d.build.id });
    if (!ACTIVE_BUILD_STATUSES.includes(build.status)) return build;

    for (let row of build.regions) {
      if (!row.genesisBuildId || ['succeeded', 'failed', 'cancelled'].includes(row.status)) {
        continue;
      }

      await getRegionClient(row.region.id)
        .machineImage.build.cancel({ tenantId: row.tenant.id, buildId: row.genesisBuildId })
        .catch(() => undefined);
    }

    let now = new Date();

    await db.sandboxMachineImageBuildRegion.updateMany({
      where: {
        buildOid: build.oid,
        status: { notIn: ['succeeded', 'failed', 'cancelled', 'timed_out'] }
      },
      data: { status: 'cancelled', endedAt: now }
    });

    await db.sandboxMachineImageBuild.updateMany({
      where: { oid: build.oid, status: { in: ACTIVE_BUILD_STATUSES } },
      data: {
        status: 'cancelled',
        failureCode: 'cancelled',
        failureMessage: 'The build was cancelled.',
        endedAt: now
      }
    });

    await db.sandboxMachineImageVersion.updateMany({
      where: { oid: build.versionOid, status: 'pending' },
      data: { status: 'deleted' }
    });

    return await this.get({ instance: d.instance, buildId: build.id });
  }
}

export let sandboxImageBuildService = Service.create(
  'sandboxImageBuildService',
  () => new SandboxImageBuildServiceImpl()
).build();

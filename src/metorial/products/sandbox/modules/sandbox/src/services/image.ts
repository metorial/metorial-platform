import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  addAfterTransactionHook,
  db,
  ID,
  type Instance,
  type Prisma,
  type SandboxMachineImage,
  type SandboxMachineImageStatus,
  withTransaction
} from '@metorial/db';
import { sandboxDiskInternalService } from '../internal/diskInternal';
import { terminalBuildStatuses } from '../lib/imageBuildEnd';
import { getRegional } from '../lib/regional';
import { imageRemoteRootQueue } from '../queues/imageRemote';
import { sandboxImageBuildService } from './imageBuild';
import { sandboxRegionService } from './region';
import { sandboxTenantService } from './tenant';

export type SandboxImageOwner = 'all' | 'own' | 'global';

export let sandboxImageInclude = {
  regions: { where: { status: 'active' }, include: { region: true } },
  versions: { where: { status: 'active' } }
} as const;

class SandboxImageServiceImpl {
  async create(d: { instance: Instance; input: { name?: string } }) {
    return await db.sandboxMachineImage.create({
      data: {
        id: await ID.generateId('sandboxMachineImage'),
        name: d.input.name ?? null,
        organizationOid: d.instance.organizationOid,
        projectOid: d.instance.projectOid,
        instanceOid: d.instance.oid
      },
      include: sandboxImageInclude
    });
  }

  async list(d: {
    instance: Instance;
    owner?: SandboxImageOwner;
    statuses?: SandboxMachineImageStatus[];
    search?: string;
  }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.sandboxMachineImage.findMany({
            ...opts,
            where: this.visibleTo({
              instance: d.instance,
              owner: d.owner,
              statuses: d.statuses,
              search: d.search
            }),
            include: sandboxImageInclude
          })
      )
    );
  }

  async get(d: {
    instance: Instance;
    imageId: string;
    statuses?: SandboxMachineImageStatus[];
  }) {
    let image = await db.sandboxMachineImage.findFirst({
      where: {
        id: d.imageId,
        OR: [{ instanceOid: null }, { instanceOid: d.instance.oid }],
        ...(d.statuses ? { status: { in: d.statuses } } : {})
      },
      include: sandboxImageInclude
    });
    if (!image) throw new ServiceError(notFoundError('sandbox_image', d.imageId));

    return image;
  }

  async createDisk(d: {
    instance: Instance;
    image: SandboxMachineImage;
    regionIdentifier: string;
    input: { versionId?: string; name?: string; idempotencyKey?: string };
  }) {
    if (
      d.image.status == 'deleted' ||
      (d.image.instanceOid !== null && d.image.instanceOid != d.instance.oid)
    ) {
      throw new ServiceError(notFoundError('sandbox_image', d.image.id));
    }

    let region = await sandboxRegionService.getByIdentifier({
      identifier: d.regionIdentifier
    });
    let tenant = await sandboxTenantService.ensure({ instance: d.instance, region });

    let regionalImage = await db.sandboxMachineImageRegion.findFirst({
      where: { imageOid: d.image.oid, regionOid: region.oid, status: 'active' }
    });
    if (!regionalImage) {
      throw new ServiceError(
        badRequestError({
          message: `Image ${d.image.id} is not available in region ${region.identifier}`
        })
      );
    }

    let versionId: string | undefined;
    if (d.input.versionId) {
      let regionalVersion = await db.sandboxMachineImageVersionRegion.findFirst({
        where: {
          regionOid: region.oid,
          status: 'active',
          version: { id: d.input.versionId, imageOid: d.image.oid }
        }
      });
      if (!regionalVersion) {
        throw new ServiceError(notFoundError('sandbox_image_version', d.input.versionId));
      }

      versionId = regionalVersion.genesisId;
    }

    let { genesis, tenantId } = getRegional(tenant);
    let remote = await genesis.machineImage.createDisk({
      tenantId,
      imageId: regionalImage.genesisId,
      versionId,
      name: d.input.name,
      idempotencyKey: d.input.idempotencyKey
    });

    return await sandboxDiskInternalService.record({ instance: d.instance, tenant, remote });
  }

  async update(d: {
    instance: Instance;
    image: SandboxMachineImage;
    input: { name?: string | null };
  }) {
    this.assertOwned(d);

    if (d.input.name !== undefined) {
      await db.sandboxMachineImage.update({
        where: { oid: d.image.oid },
        data: { name: d.input.name }
      });

      await imageRemoteRootQueue.add({ imageOid: d.image.oid.toString() });
    }

    return await this.get({ instance: d.instance, imageId: d.image.id });
  }

  async delete(d: { instance: Instance; image: SandboxMachineImage }) {
    this.assertOwned(d);

    let builds = await db.sandboxMachineImageBuild.findMany({
      where: { imageOid: d.image.oid, status: { notIn: terminalBuildStatuses } },
      select: { id: true }
    });
    for (let build of builds) {
      await sandboxImageBuildService.cancel({ instance: d.instance, build });
    }

    await withTransaction(async db => {
      await db.sandboxMachineImageRegion.updateMany({
        where: { imageOid: d.image.oid },
        data: { status: 'deleted' }
      });
      await db.sandboxMachineImageVersion.updateMany({
        where: { imageOid: d.image.oid },
        data: { status: 'deleted' }
      });
      await db.sandboxMachineImage.update({
        where: { oid: d.image.oid },
        data: { status: 'deleted', deletedAt: new Date() }
      });

      addAfterTransactionHook(() =>
        imageRemoteRootQueue.add({ imageOid: d.image.oid.toString() })
      );
    });

    return await this.get({ instance: d.instance, imageId: d.image.id });
  }

  private assertOwned(d: { instance: Instance; image: SandboxMachineImage }) {
    if (d.image.instanceOid != d.instance.oid || d.image.status == 'deleted') {
      throw new ServiceError(notFoundError('sandbox_image', d.image.id));
    }
  }

  private visibleTo(d: {
    instance: Instance;
    owner?: SandboxImageOwner;
    statuses?: SandboxMachineImageStatus[];
    search?: string;
  }) {
    let owner = d.owner ?? 'all';

    let global = { instanceOid: null, status: { in: d.statuses ?? ['active'] } };
    let own = {
      instanceOid: d.instance.oid,
      status: { in: d.statuses ?? ['active', 'pending'] }
    };

    return {
      AND: [
        { OR: owner == 'global' ? [global] : owner == 'own' ? [own] : [global, own] },
        ...(d.search
          ? [
              {
                OR: [
                  { name: { contains: d.search, mode: 'insensitive' as const } },
                  { identifier: { contains: d.search, mode: 'insensitive' as const } }
                ]
              }
            ]
          : [])
      ]
    } satisfies Prisma.SandboxMachineImageWhereInput;
  }
}

export let sandboxImageService = Service.create(
  'sandboxImageService',
  () => new SandboxImageServiceImpl()
).build();

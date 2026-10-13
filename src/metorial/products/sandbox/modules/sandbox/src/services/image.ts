import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import {
  db,
  ID,
  type Instance,
  type Prisma,
  type SandboxMachineImageStatus
} from '@metorial/db';

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

  async list(d: { instance: Instance; statuses?: SandboxMachineImageStatus[] }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.sandboxMachineImage.findMany({
            ...opts,
            where: this.visibleTo({ instance: d.instance, statuses: d.statuses }),
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
        ...this.visibleTo({ instance: d.instance, statuses: d.statuses })
      },
      include: sandboxImageInclude
    });
    if (!image) throw new ServiceError(notFoundError('sandbox_image', d.imageId));

    return image;
  }

  private visibleTo(d: { instance: Instance; statuses?: SandboxMachineImageStatus[] }) {
    return {
      OR: [
        { instanceOid: null, status: { in: d.statuses ?? ['active'] } },
        { instanceOid: d.instance.oid, status: { in: d.statuses ?? ['active', 'pending'] } }
      ]
    } satisfies Prisma.SandboxMachineImageWhereInput;
  }
}

export let sandboxImageService = Service.create(
  'sandboxImageService',
  () => new SandboxImageServiceImpl()
).build();

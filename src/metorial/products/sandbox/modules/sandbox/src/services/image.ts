import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { db, type Instance, type SandboxMachineImageStatus } from '@metorial/db';

export let sandboxImageInclude = {
  regions: { where: { status: 'active' }, include: { region: true } },
  versions: { where: { status: 'active' } }
} as const;

class SandboxImageServiceImpl {
  async list(d: { instance: Instance; statuses?: SandboxMachineImageStatus[] }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.sandboxMachineImage.findMany({
            ...opts,
            where: {
              status: { in: d.statuses ?? ['active'] },
              OR: [{ instanceOid: null }, { instanceOid: d.instance.oid }]
            },
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
        status: { in: d.statuses ?? ['active'] },
        OR: [{ instanceOid: null }, { instanceOid: d.instance.oid }]
      },
      include: sandboxImageInclude
    });
    if (!image) throw new ServiceError(notFoundError('sandbox_image', d.imageId));

    return image;
  }
}

export let sandboxImageService = Service.create(
  'sandboxImageService',
  () => new SandboxImageServiceImpl()
).build();

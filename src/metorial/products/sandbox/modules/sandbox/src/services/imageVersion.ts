import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { db, type SandboxMachineImage, type SandboxMachineImageStatus } from '@metorial/db';

export let sandboxImageVersionInclude = {
  regions: { where: { status: 'active' }, include: { region: true } }
} as const;

class SandboxImageVersionServiceImpl {
  async list(d: { image: SandboxMachineImage; statuses?: SandboxMachineImageStatus[] }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.sandboxMachineImageVersion.findMany({
            ...opts,
            where: {
              imageOid: d.image.oid,
              status: { in: this.statusesFor(d) }
            },
            include: sandboxImageVersionInclude
          })
      )
    );
  }

  async get(d: {
    image: SandboxMachineImage;
    versionId: string;
    statuses?: SandboxMachineImageStatus[];
  }) {
    let version = await db.sandboxMachineImageVersion.findFirst({
      where: {
        id: d.versionId,
        imageOid: d.image.oid,
        ...(d.statuses ? { status: { in: d.statuses } } : {})
      },
      include: sandboxImageVersionInclude
    });
    if (!version) {
      throw new ServiceError(notFoundError('sandbox_image_version', d.versionId));
    }

    return version;
  }

  private statusesFor(d: {
    image: SandboxMachineImage;
    statuses?: SandboxMachineImageStatus[];
  }) {
    if (d.statuses) return d.statuses;

    return d.image.instanceOid === null
      ? ['active' as const]
      : ['active' as const, 'pending' as const];
  }
}

export let sandboxImageVersionService = Service.create(
  'sandboxImageVersionService',
  () => new SandboxImageVersionServiceImpl()
).build();

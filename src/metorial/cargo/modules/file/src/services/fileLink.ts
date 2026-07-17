import {
  badRequestError,
  forbiddenError,
  notFoundError,
  ServiceError
} from '@lowerdeck/error';
import { generatePlainId } from '@lowerdeck/id';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { env } from '@metorial/cargo-config';
import { getId } from '@metorial/cargo-config/id';
import {
  type DateFilter,
  normalizeDateFilter,
  resolveFileLinks,
  resolveFiles,
  resolveResourceActors
} from '@metorial/cargo-list-utils';
import type { FileLink, Prisma } from '@metorial/db';
import { db, withTransaction } from '@metorial/db';
import { actorService } from './actor';
import type { CargoResourceScope } from './filePurpose';
import { fileReferenceService } from './fileReference';

let include = {
  file: {
    include: {
      document: {
        select: {
          id: true
        }
      },
      purpose: true
    }
  },
  resourceTenant: true,
  resourceGroup: true
} satisfies Prisma.FileLinkInclude;

class FileLinkServiceImpl {
  private getGeneratedKey() {
    return `${generatePlainId(30)}_${env.service.CARGO_REGION ?? 'ext'}`;
  }

  async createFileLink(
    d: CargoResourceScope & {
      file: {
        oid: bigint;
        id: string;
        purpose: {
          canHaveLinks: boolean;
        };
      };
      input: {
        id?: string;
        key?: string;
        expiresAt?: Date;
        actorId?: string;
      };
    }
  ) {
    if (!d.file.purpose.canHaveLinks) {
      throw new ServiceError(
        forbiddenError({
          message: 'File purpose does not allow creating links'
        })
      );
    }

    return await withTransaction(async db => {
      let actor = d.input.actorId
        ? await actorService.getActorById({
            resourceTenant: d.resourceTenant,
            actorId: d.input.actorId
          })
        : undefined;

      let existing = d.input.id
        ? await db.fileLink.findFirst({
            where: {
              resourceTenantOid: d.resourceTenant.oid,
              resourceGroupOid: d.resourceGroup.oid,
              OR: [{ id: d.input.id }, ...(d.input.key ? [{ key: d.input.key }] : [])]
            }
          })
        : d.input.key
          ? await db.fileLink.findFirst({
              where: {
                resourceTenantOid: d.resourceTenant.oid,
                resourceGroupOid: d.resourceGroup.oid,
                key: d.input.key
              }
            })
          : undefined;

      if (existing) {
        return await db.fileLink.update({
          where: {
            id: existing.id
          },
          data: {
            fileOid: d.file.oid,
            expiresAt: d.input.expiresAt,
            key: d.input.key ?? existing.key,
            createdByResourceActorOid: existing.createdByResourceActorOid ?? actor?.oid
          },
          include
        });
      }

      let generated = getId('fileLink');

      return await db.fileLink.create({
        data: {
          oid: generated.oid,
          id: d.input.id ?? generated.id,
          key: d.input.key ?? this.getGeneratedKey(),
          fileOid: d.file.oid,
          resourceTenantOid: d.resourceTenant.oid,
          resourceGroupOid: d.resourceGroup.oid,
          expiresAt: d.input.expiresAt,
          createdByResourceActorOid: actor?.oid
        },
        include
      });
    });
  }

  async deleteFileLink(d: { fileLink: FileLink }) {
    let hasRefs = await fileReferenceService.hasReferences({
      fileLink: d.fileLink
    });

    if (hasRefs) {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot delete link: it has active references'
        })
      );
    }

    return await db.fileLink.delete({
      where: {
        id: d.fileLink.id
      },
      include
    });
  }

  async listFileLinks(
    d: CargoResourceScope & {
      ids?: string[];
      fileId?: string[];
      fileIds?: string[];
      actorId?: string;
      actorIds?: string[];
      createdAt?: DateFilter;
      expiresAt?: DateFilter;
    }
  ) {
    let actor = d.actorId
      ? await actorService.getActorById({
          resourceTenant: d.resourceTenant,
          actorId: d.actorId
        })
      : undefined;
    let fileLinks = await resolveFileLinks(d, d.ids);
    let files = await resolveFiles(d, d.fileIds ?? d.fileId);
    let actors = await resolveResourceActors(d, d.actorIds);

    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.fileLink.findMany({
            ...opts,
            where: {
              oid: fileLinks ? fileLinks.in : undefined,
              resourceTenantOid: d.resourceTenant.oid,
              resourceGroupOid: d.resourceGroup.oid,
              createdByResourceActorOid: actors ? actors.in : actor?.oid,
              file: {
                status: 'active',
                oid: files ? files.in : undefined
              },
              AND: [
                d.createdAt ? { createdAt: normalizeDateFilter(d.createdAt) } : undefined!,
                d.expiresAt ? { expiresAt: normalizeDateFilter(d.expiresAt) } : undefined!
              ].filter(Boolean)
            },
            include
          })
      )
    );
  }

  async getFileLinkById(
    d: CargoResourceScope & {
      fileLinkId: string;
      actorId?: string;
    }
  ) {
    let actor = d.actorId
      ? await actorService.getActorById({
          resourceTenant: d.resourceTenant,
          actorId: d.actorId
        })
      : undefined;

    let fileLink = await db.fileLink.findFirst({
      where: {
        resourceTenantOid: d.resourceTenant.oid,
        resourceGroupOid: d.resourceGroup.oid,
        id: d.fileLinkId,
        createdByResourceActorOid: actor?.oid
      },
      include
    });

    if (!fileLink) throw new ServiceError(notFoundError('fileLink', d.fileLinkId));

    return fileLink;
  }

  async updateFileLinkExpiry(d: { fileLink: Pick<FileLink, 'id'>; expiresAt: Date }) {
    return await db.fileLink.update({
      where: {
        id: d.fileLink.id
      },
      data: {
        expiresAt: d.expiresAt
      },
      include
    });
  }

  async getFileLinkByKey(d: { fileId: string; key: string }) {
    let fileLink = await db.fileLink.findFirst({
      where: {
        key: d.key,
        file: {
          id: d.fileId,
          status: 'active'
        }
      },
      include
    });

    if (!fileLink) throw new ServiceError(notFoundError('fileLink', d.key));

    return {
      link: fileLink,
      file: fileLink.file
    };
  }
}

export let fileLinkService = Service.create(
  'cargoFileLinkService',
  () => new FileLinkServiceImpl()
).build();

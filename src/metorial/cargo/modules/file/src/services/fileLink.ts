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
  type CargoOwnerScope,
  cargoFileScope,
  cargoOwnerScopeProject,
  type DateFilter,
  normalizeDateFilter,
  resolveFileLinks,
  resolveFiles,
  resolveResourceActors
} from '@metorial/cargo-list-utils';
import type { FileLink, Instance, Prisma, Project, ResourceActor } from '@metorial/db';
import { db, withTransaction } from '@metorial/db';
import { assertResourceActorScope } from '@metorial/module-access';
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
  }
} satisfies Prisma.FileLinkInclude;

class FileLinkServiceImpl {
  private getGeneratedKey() {
    return `${generatePlainId(30)}_${env.service.METORIAL_REGION ?? 'ext'}`;
  }

  async createFileLink(
    d: CargoOwnerScope & {
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
        actor?: ResourceActor;
      };
    }
  ) {
    assertResourceActorScope({
      project: cargoOwnerScopeProject(d),
      resourceActor: d.input.actor
    });
    if (!d.file.purpose.canHaveLinks) {
      throw new ServiceError(
        forbiddenError({
          message: 'File purpose does not allow creating links'
        })
      );
    }

    return await withTransaction(async db => {
      let actor = d.input.actor;
      let ownedFile = { file: cargoFileScope(d) };

      let existing = d.input.id
        ? await db.fileLink.findFirst({
            where: {
              ...ownedFile,
              OR: [{ id: d.input.id }, ...(d.input.key ? [{ key: d.input.key }] : [])]
            }
          })
        : d.input.key
          ? await db.fileLink.findFirst({
              where: {
                ...ownedFile,
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
          projectOid: 'project' in d ? d.project.oid : null,
          instanceOid: 'instance' in d ? d.instance.oid : null,
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

  async listFileLinks(d: {
    project: Project;
    instance: Instance;
    ids?: string[];
    fileId?: string[];
    fileIds?: string[];
    actor?: ResourceActor;
    actorIds?: string[];
    createdAt?: DateFilter;
    expiresAt?: DateFilter;
  }) {
    assertResourceActorScope({
      project: d.project,
      resourceActor: d.actor
    });
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
              createdByResourceActorOid: actors ? actors.in : d.actor?.oid,
              file: {
                status: 'active',
                instanceOid: d.instance.oid,
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
    d: CargoOwnerScope & {
      fileLinkId: string;
      actor?: ResourceActor;
    }
  ) {
    assertResourceActorScope({
      project: cargoOwnerScopeProject(d),
      resourceActor: d.actor
    });
    let fileLink = await db.fileLink.findFirst({
      where: {
        file: cargoFileScope(d),
        id: d.fileLinkId,
        createdByResourceActorOid: d.actor?.oid
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

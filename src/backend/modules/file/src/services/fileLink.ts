import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { type CargoFile, type CargoFileLink, cargo } from '../cargo';
import { type CargoAccessActor, resolveCargoAccess } from './access';
import type { FileOwner } from './file';
import { fileReferenceService } from './fileReference';

class FileLinkServiceImpl {
  async createFileLink(d: {
    file: Pick<CargoFile, 'id'>;
    owner: FileOwner;
    accessActor?: CargoAccessActor;
    input: {
      expiresAt?: Date;
    };
  }) {
    let { scope, actorId } = await resolveCargoAccess({
      owner: d.owner,
      accessActor: d.accessActor
    });

    let fileLink = await cargo.fileLink.create({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      fileId: d.file.id,
      expiresAt: d.input.expiresAt,
      actorId
    });

    return fileLink;
  }

  async deleteFileLink(d: {
    fileLink: CargoFileLink;
    owner: FileOwner;
    accessActor?: CargoAccessActor;
  }) {
    let fileLink = d.accessActor
      ? await this.getFileLinkById({
          owner: d.owner,
          fileLinkId: d.fileLink.id,
          accessActor: d.accessActor
        })
      : d.fileLink;
    let { scope } = await resolveCargoAccess({
      owner: d.owner
    });

    let hasRefs = await fileReferenceService.hasReferences({
      fileLink,
      owner: d.owner
    });
    if (hasRefs) {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot delete file link: it has active references'
        })
      );
    }

    let deletedFileLink = await cargo.fileLink.delete({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      fileLinkId: fileLink.id
    });

    return deletedFileLink;
  }

  async listFileLinks(d: {
    owner: FileOwner;
    fileId?: string;
    accessActor?: CargoAccessActor;
  }) {
    let { scope, actorId } = await resolveCargoAccess({
      owner: d.owner,
      accessActor: d.accessActor
    });

    return Paginator.create(() => async input => {
      let result = await cargo.fileLink.list({
        tenantId: scope.tenantId,
        environmentId: scope.environmentId,
        fileIds: d.fileId ? [d.fileId] : undefined,
        actorId,
        ...input
      });

      return {
        items: result.items,
        pagination: {
          hasNextPage: result.pagination.has_more_after,
          hasPreviousPage: result.pagination.has_more_before
        }
      };
    });
  }

  async getFileLinkById(d: {
    fileLinkId: string;
    owner: FileOwner;
    accessActor?: CargoAccessActor;
  }) {
    let { scope, actorId } = await resolveCargoAccess({
      owner: d.owner,
      accessActor: d.accessActor
    });

    let fileLink = await cargo.fileLink.get({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      fileLinkId: d.fileLinkId,
      actorId
    });

    return fileLink;
  }

  async getFileLinkByKey(d: { fileId: string; key: string }) {
    return await cargo.fileLink.getByKey({
      fileId: d.fileId,
      key: d.key
    });
  }
}

export let fileLinkService = Service.create(
  'fileLink',
  () => new FileLinkServiceImpl()
).build();

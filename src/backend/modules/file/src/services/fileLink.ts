import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { Instance, Organization } from '@metorial/db';
import { type CargoFile, type CargoFileLink, cargo } from '../cargo';
import type { FileOwner } from './file';
import { fileReferenceService } from './fileReference';
import { resolveCargoScopeForOwner } from './scope';

class FileLinkServiceImpl {
  private async getScopeForOwner(owner: FileOwner) {
    return await resolveCargoScopeForOwner(owner);
  }

  async createFileLink(d: {
    file: CargoFile;
    owner: FileOwner;
    input: {
      expiresAt?: Date;
    };
  }) {
    let scope = await this.getScopeForOwner(d.owner);

    let fileLink = await cargo.fileLink.create({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      fileId: d.file.id,
      expiresAt: d.input.expiresAt
    });

    return fileLink;
  }

  async deleteFileLink(d: { fileLink: CargoFileLink; owner: FileOwner }) {
    let scope = await this.getScopeForOwner(d.owner);

    let hasRefs = await fileReferenceService.hasReferences({
      fileLink: d.fileLink,
      owner: d.owner
    });
    if (hasRefs) {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot delete file link: it has active references'
        })
      );
    }

    let fileLink = await cargo.fileLink.delete({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      fileLinkId: d.fileLink.id
    });

    return fileLink;
  }

  private async getScope(d: { organization: Organization; instance?: Instance }) {
    return await resolveCargoScopeForOwner(
      d.instance
        ? {
            type: 'instance',
            organization: d.organization,
            instance: d.instance
          }
        : {
            type: 'organization',
            organization: d.organization
          }
    );
  }

  async listFileLinksForOrganization(d: {
    organization: Organization;
    instance?: Instance;
    fileId?: string;
  }) {
    let scope = await this.getScope(d);

    return Paginator.create(() => async input => {
      let result = await cargo.fileLink.list({
        tenantId: scope.tenantId,
        environmentId: scope.environmentId,
        fileId: d.fileId,
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

  async getFileLinkByIdForOrganization(d: {
    fileLinkId: string;
    organization: Organization;
    instance?: Instance;
  }) {
    let scope = await this.getScope(d);

    let fileLink = await cargo.fileLink.get({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      fileLinkId: d.fileLinkId
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

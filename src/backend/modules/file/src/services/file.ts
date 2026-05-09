import { badRequestError, ServiceError } from '@lowerdeck/error';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { Instance, Organization, User } from '@metorial/db';
import { cargo, type CargoFile, reconcileCargoPurposes } from '../cargo';
import { purposes } from '../definitions';
import {
  resolveCargoAccess,
  type CargoAccessActor,
  type CargoStorePermission
} from './access';
import { fileReferenceService } from './fileReference';

export type FileOwner =
  | {
      type: 'user';
      user: User;
    }
  | {
      type: 'organization';
      organization: Organization;
    }
  | {
      type: 'instance';
      organization: Organization;
      instance: Instance;
    };

class FileServiceImpl {
  private validatePurposeOwner(d: { purpose: { ownerType: string }; owner: FileOwner }) {
    if (d.purpose.ownerType !== d.owner.type) {
      throw new ServiceError(
        badRequestError({
          message: 'Invalid file purpose for owner'
        })
      );
    }
  }

  async createFile(d: {
    owner: FileOwner;
    storeId: string;
    purpose: string;
    accessActor?: CargoAccessActor;
    defaultPermissions?: CargoStorePermission[];
    overridePermissions?: boolean;
    input: {
      name: string;
      mimeType: string;
      size: number;

      title?: string;
    };
  }) {
    let purpose = await purposes[d.purpose as keyof typeof purposes];
    if (!purpose) {
      throw new ServiceError(
        badRequestError({
          message: `Invalid file purpose: ${d.purpose}`
        })
      );
    }

    this.validatePurposeOwner({ purpose, owner: d.owner });

    await reconcileCargoPurposes();

    let { scope, actorId, defaultPermissions, overridePermissions } = await resolveCargoAccess(d);

    let file = await cargo.file.create({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      purpose: d.purpose,
      storeId: d.storeId,
      name: d.input.name,
      mimeType: d.input.mimeType,
      size: d.input.size,
      title: d.input.title,
      actorId,
      defaultPermissions,
      overridePermissions
    });

    return file;
  }

  async getFileById(d: {
    fileId: string;
    owner: FileOwner;
    accessActor?: CargoAccessActor;
    defaultPermissions?: CargoStorePermission[];
    overridePermissions?: boolean;
  }) {
    let { scope, actorId, defaultPermissions, overridePermissions } = await resolveCargoAccess(d);
    let file = await cargo.file.get({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      fileId: d.fileId,
      actorId,
      defaultPermissions,
      overridePermissions
    });

    return file;
  }

  async updateFile(d: {
    file: CargoFile;
    owner: FileOwner;
    input: {
      title?: string;
    };
  }) {
    let { scope } = await resolveCargoAccess({
      owner: d.owner
    });

    let file = await cargo.file.update({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      fileId: d.file.id,
      title: d.input.title
    });

    return file;
  }

  async deleteFile(d: { file: CargoFile; owner: FileOwner }) {
    let { scope } = await resolveCargoAccess({
      owner: d.owner
    });

    let hasRefs = await fileReferenceService.hasReferencesForFile({
      file: d.file,
      owner: d.owner
    });
    if (hasRefs) {
      throw new ServiceError(
        badRequestError({
          message: 'Cannot delete file: it has active references'
        })
      );
    }

    let file = await cargo.file.delete({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      fileId: d.file.id
    });

    return file;
  }

  async listFiles(d: {
    owner: FileOwner;
    purpose?: string;
    accessActor?: CargoAccessActor;
    defaultPermissions?: CargoStorePermission[];
    overridePermissions?: boolean;
  }) {
    let purpose = d.purpose ? await purposes[d.purpose as keyof typeof purposes] : undefined;
    if (purpose && purpose.ownerType !== d.owner.type) {
      this.validatePurposeOwner({ purpose, owner: d.owner });
    }

    let { scope, actorId, defaultPermissions, overridePermissions } = await resolveCargoAccess(d);

    return Paginator.create(() => async input => {
      let result = await cargo.file.list({
        tenantId: scope.tenantId,
        environmentId: scope.environmentId,
        purpose: d.purpose,
        actorId,
        defaultPermissions,
        overridePermissions,
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
}

export let fileService = Service.create('file', () => new FileServiceImpl()).build();

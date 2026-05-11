import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { cargo, type CargoDocument } from '../cargo';
import type { FileOwner } from './file';
import { resolveCargoAccess, type CargoAccessActor, type CargoStorePermission } from './access';

class DocumentServiceImpl {
  async createDocument(d: {
    owner: FileOwner;
    accessActor?: CargoAccessActor;
    defaultPermissions?: CargoStorePermission[];
    overridePermissions?: boolean;
    input: {
      id?: string;
      title: string;
      content: string;
    };
  }) {
    let { scope, actorId, defaultPermissions, overridePermissions } = await resolveCargoAccess(d);

    return await cargo.document.create({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      documentId: d.input.id,
      title: d.input.title,
      content: d.input.content,
      actorId,
      defaultPermissions,
      overridePermissions
    });
  }

  async listDocuments(d: {
    owner: FileOwner;
    accessActor?: CargoAccessActor;
    defaultPermissions?: CargoStorePermission[];
    overridePermissions?: boolean;
  }) {
    let { scope, actorId, defaultPermissions, overridePermissions } = await resolveCargoAccess(d);

    return Paginator.create(() => async input => {
      let result = await cargo.document.list({
        tenantId: scope.tenantId,
        environmentId: scope.environmentId,
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

  async getDocumentById(d: {
    owner: FileOwner;
    documentId: string;
    accessActor?: CargoAccessActor;
    defaultPermissions?: CargoStorePermission[];
    overridePermissions?: boolean;
  }) {
    let { scope, actorId, defaultPermissions, overridePermissions } = await resolveCargoAccess(d);

    return await cargo.document.get({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      documentId: d.documentId,
      actorId,
      defaultPermissions,
      overridePermissions
    });
  }

  async getDocumentPermissions(d: {
    owner: FileOwner;
    documentId: string;
    accessActor?: CargoAccessActor;
    defaultPermissions?: CargoStorePermission[];
    overridePermissions?: boolean;
  }) {
    let { scope, actorId, defaultPermissions, overridePermissions } = await resolveCargoAccess(d);

    return await cargo.document.getPermissions({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      documentId: d.documentId,
      actorId,
      defaultPermissions,
      overridePermissions
    });
  }

  async updateDocument(d: {
    owner: FileOwner;
    document: CargoDocument;
    accessActor?: CargoAccessActor;
    defaultPermissions?: CargoStorePermission[];
    overridePermissions?: boolean;
    input: {
      title?: string;
      content?: string;
    };
  }) {
    let { scope, actorId, defaultPermissions, overridePermissions } = await resolveCargoAccess(d);

    return await cargo.document.update({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      documentId: d.document.id,
      title: d.input.title,
      content: d.input.content,
      actorId,
      defaultPermissions,
      overridePermissions
    });
  }

  async deleteDocument(d: {
    owner: FileOwner;
    document: CargoDocument;
    accessActor?: CargoAccessActor;
    defaultPermissions?: CargoStorePermission[];
    overridePermissions?: boolean;
  }) {
    let { scope, actorId, defaultPermissions, overridePermissions } = await resolveCargoAccess(d);

    return await cargo.document.delete({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      documentId: d.document.id,
      actorId,
      defaultPermissions,
      overridePermissions
    });
  }

  async cloneDocument(d: {
    owner: FileOwner;
    document: CargoDocument;
    accessActor?: CargoAccessActor;
    defaultPermissions?: CargoStorePermission[];
    overridePermissions?: boolean;
    input: {
      id?: string;
      title?: string;
    };
  }) {
    let { scope, actorId, defaultPermissions, overridePermissions } = await resolveCargoAccess(d);

    return await cargo.document.clone({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      documentId: d.document.id,
      targetDocumentId: d.input.id,
      title: d.input.title,
      actorId,
      defaultPermissions,
      overridePermissions
    });
  }
}

export let documentService = Service.create(
  'fileDocument',
  () => new DocumentServiceImpl()
).build();

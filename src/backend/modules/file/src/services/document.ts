import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { cargo, type CargoActor, type CargoDocument } from '../cargo';
import {
  resolveCargoAccess,
  type CargoAccessActor,
  type CargoStorePermission
} from './access';
import {
  documentParticipantService,
  type EnrichedCargoDocumentActor
} from './documentParticipant';
import type { EnrichedCargoFile, FileOwner } from './file';

export type EnrichedCargoDocument = Omit<CargoDocument, 'createdBy' | 'file'> & {
  createdBy: EnrichedCargoDocumentActor | null;
  file: EnrichedCargoFile;
};

class DocumentServiceImpl {
  async enrichDocuments(d: {
    owner: FileOwner;
    documents: CargoDocument[];
  }): Promise<EnrichedCargoDocument[]> {
    let creators = d.documents
      .flatMap(document => [document.createdBy, document.file.createdBy])
      .filter((creator): creator is CargoActor => !!creator);

    let enrichedCreators = await documentParticipantService.enrichActors({
      owner: d.owner,
      actors: creators
    });

    let nextCreatorIndex = 0;
    return d.documents.map(document => {
      let createdBy = document.createdBy
        ? (enrichedCreators[nextCreatorIndex++] ?? null)
        : null;
      let fileCreatedBy = document.file.createdBy
        ? (enrichedCreators[nextCreatorIndex++] ?? null)
        : null;

      return {
        ...document,
        createdBy,
        file: {
          ...document.file,
          createdBy: fileCreatedBy
        }
      };
    });
  }

  async enrichDocument(d: {
    owner: FileOwner;
    document: CargoDocument;
  }): Promise<EnrichedCargoDocument> {
    let [document] = await this.enrichDocuments({
      owner: d.owner,
      documents: [d.document]
    });

    return document!;
  }

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
    let { scope, actorId, defaultPermissions, overridePermissions } =
      await resolveCargoAccess(d);

    let document = await cargo.document.create({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      documentId: d.input.id,
      title: d.input.title,
      content: d.input.content,
      actorId,
      defaultPermissions,
      overridePermissions
    });

    return await this.enrichDocument({ owner: d.owner, document });
  }

  async listDocuments(d: {
    owner: FileOwner;
    accessActor?: CargoAccessActor;
    defaultPermissions?: CargoStorePermission[];
    overridePermissions?: boolean;
  }) {
    let { scope, actorId, defaultPermissions, overridePermissions } =
      await resolveCargoAccess(d);

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
        items: await this.enrichDocuments({
          owner: d.owner,
          documents: result.items
        }),
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
    let { scope, actorId, defaultPermissions, overridePermissions } =
      await resolveCargoAccess(d);

    let document = await cargo.document.get({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      documentId: d.documentId,
      actorId,
      defaultPermissions,
      overridePermissions
    });

    return await this.enrichDocument({ owner: d.owner, document });
  }

  async getDocumentPermissions(d: {
    owner: FileOwner;
    documentId: string;
    accessActor?: CargoAccessActor;
    defaultPermissions?: CargoStorePermission[];
    overridePermissions?: boolean;
  }) {
    let { scope, actorId, defaultPermissions, overridePermissions } =
      await resolveCargoAccess(d);

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
    document: Pick<CargoDocument, 'id'>;
    accessActor?: CargoAccessActor;
    defaultPermissions?: CargoStorePermission[];
    overridePermissions?: boolean;
    input: {
      title?: string;
      content?: string;
    };
  }) {
    let { scope, actorId, defaultPermissions, overridePermissions } =
      await resolveCargoAccess(d);

    let document = await cargo.document.update({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      documentId: d.document.id,
      title: d.input.title,
      content: d.input.content,
      actorId,
      defaultPermissions,
      overridePermissions
    });

    return await this.enrichDocument({ owner: d.owner, document });
  }

  async deleteDocument(d: {
    owner: FileOwner;
    document: Pick<CargoDocument, 'id'>;
    accessActor?: CargoAccessActor;
    defaultPermissions?: CargoStorePermission[];
    overridePermissions?: boolean;
  }) {
    let { scope, actorId, defaultPermissions, overridePermissions } =
      await resolveCargoAccess(d);

    let document = await cargo.document.delete({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      documentId: d.document.id,
      actorId,
      defaultPermissions,
      overridePermissions
    });

    return await this.enrichDocument({ owner: d.owner, document });
  }

  async cloneDocument(d: {
    owner: FileOwner;
    document: Pick<CargoDocument, 'id'>;
    accessActor?: CargoAccessActor;
    defaultPermissions?: CargoStorePermission[];
    overridePermissions?: boolean;
    input: {
      id?: string;
      title?: string;
    };
  }) {
    let { scope, actorId, defaultPermissions, overridePermissions } =
      await resolveCargoAccess(d);

    let document = await cargo.document.clone({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      documentId: d.document.id,
      targetDocumentId: d.input.id,
      title: d.input.title,
      actorId,
      defaultPermissions,
      overridePermissions
    });

    return await this.enrichDocument({ owner: d.owner, document });
  }
}

export let documentService = Service.create(
  'fileDocument',
  () => new DocumentServiceImpl()
).build();

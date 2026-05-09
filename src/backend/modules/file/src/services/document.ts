import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import { cargo, type CargoDocument } from '../cargo';
import type { FileOwner } from './file';
import { resolveCargoScopeForOwner } from './scope';

export type CargoDocumentMemberActor = {
  organizationActorId: string;
  name: string;
  consumerProfileId?: string;
};

let getCargoMemberActorIdentifier = (organizationActorId: string) =>
  `organization_actor:${organizationActorId}`;

class DocumentServiceImpl {
  private async getScope(owner: FileOwner) {
    return await resolveCargoScopeForOwner(owner);
  }

  private async getScopeAndActorId(d: {
    owner: FileOwner;
    performedByMember?: CargoDocumentMemberActor;
  }) {
    let scope = await this.getScope(d.owner);
    if (!d.performedByMember) {
      return {
        scope,
        actorId: undefined
      };
    }

    let actor = await cargo.actor.upsert({
      tenantId: scope.tenantId,
      identifier: getCargoMemberActorIdentifier(d.performedByMember.organizationActorId),
      name: d.performedByMember.name,
      organizationActorId: d.performedByMember.organizationActorId,
      consumerProfileId: d.performedByMember.consumerProfileId
    });

    return {
      scope,
      actorId: actor.id
    };
  }

  async createDocument(d: {
    owner: FileOwner;
    performedByMember?: CargoDocumentMemberActor;
    input: {
      id?: string;
      title: string;
      content: string;
    };
  }) {
    let { scope, actorId } = await this.getScopeAndActorId(d);

    return await cargo.document.create({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      documentId: d.input.id,
      title: d.input.title,
      content: d.input.content,
      actorId
    });
  }

  async listDocuments(d: {
    owner: FileOwner;
  }) {
    let scope = await this.getScope(d.owner);

    return Paginator.create(() => async input => {
      let result = await cargo.document.list({
        tenantId: scope.tenantId,
        environmentId: scope.environmentId,
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
    performedByMember?: CargoDocumentMemberActor;
  }) {
    let { scope, actorId } = await this.getScopeAndActorId(d);

    return await cargo.document.get({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      documentId: d.documentId,
      actorId
    });
  }

  async updateDocument(d: {
    owner: FileOwner;
    document: CargoDocument;
    performedByMember?: CargoDocumentMemberActor;
    input: {
      title?: string;
      content?: string;
    };
  }) {
    let { scope, actorId } = await this.getScopeAndActorId(d);

    return await cargo.document.update({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      documentId: d.document.id,
      title: d.input.title,
      content: d.input.content,
      actorId
    });
  }

  async deleteDocument(d: {
    owner: FileOwner;
    document: CargoDocument;
  }) {
    let scope = await this.getScope(d.owner);

    return await cargo.document.delete({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      documentId: d.document.id
    });
  }

  async cloneDocument(d: {
    owner: FileOwner;
    document: CargoDocument;
    input: {
      id?: string;
      title?: string;
    };
  }) {
    let scope = await this.getScope(d.owner);

    return await cargo.document.clone({
      tenantId: scope.tenantId,
      environmentId: scope.environmentId,
      documentId: d.document.id,
      targetDocumentId: d.input.id,
      title: d.input.title
    });
  }
}

export let documentService = Service.create(
  'fileDocument',
  () => new DocumentServiceImpl()
).build();

import { badRequestError, forbiddenError, ServiceError } from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import type {
  Document,
  Instance,
  Project,
  ResourceActor,
  StoreParticipantPermissions
} from '@metorial/db';
import type { ResourceAuthorization } from '@metorial/module-access';
import {
  storeAccessService,
  storeReadPermission,
  storeWritePermission
} from '@metorial/module-store';

let maxCommentBodyLength = 10_000;

export type DocumentCommentAccessInput = {
  project: Project;
  instance: Instance;
  document: Document;
  authorization: ResourceAuthorization;
  defaultPermissions?: StoreParticipantPermissions[];
  overridePermissions?: boolean;
};

class InternalDocumentCommentAccessServiceImpl {
  async assertCanRead(d: DocumentCommentAccessInput) {
    return await storeAccessService.assertStoreAccessForDocument({
      project: d.project,
      instance: d.instance,
      document: d.document,
      authorization: d.authorization,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions,
      requiredPermission: storeReadPermission
    });
  }

  async assertCanComment(d: DocumentCommentAccessInput): Promise<ResourceActor> {
    let access = await this.assertCanRead(d);
    if (!access.actor) {
      throw new ServiceError(
        forbiddenError({ message: 'Commenting on documents requires an actor' })
      );
    }

    return access.actor;
  }

  async canWrite(d: DocumentCommentAccessInput) {
    let permissions = await storeAccessService.getDocumentPermissions(d);
    return permissions.hasFullAccess || permissions.permissions.includes(storeWritePermission);
  }

  normalizeBody(body: string) {
    let normalized = body.trim();
    if (!normalized) {
      throw new ServiceError(badRequestError({ message: 'Comment body must not be empty' }));
    }
    if (normalized.length > maxCommentBodyLength) {
      throw new ServiceError(
        badRequestError({
          message: `Comment body must be at most ${maxCommentBodyLength} characters`
        })
      );
    }

    return normalized;
  }
}

export let internalDocumentCommentAccessService = Service.create(
  'cargoInternalDocumentCommentAccessService',
  () => new InternalDocumentCommentAccessServiceImpl()
).build();

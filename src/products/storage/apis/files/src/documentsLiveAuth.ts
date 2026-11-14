import type { Context } from '@metorial/context';
import { forbiddenError, ServiceError } from '@lowerdeck/error';
import { documentEditTokenService, documentService } from '@metorial/module-documents';
import { resolveCargoAccess } from '@metorial/module-file';
import { db } from '@metorial/db';
import { createResourceAuthorization } from '@metorial/module-access';

export let resolveDocumentsLiveToken = async (d: {
  editToken: string;
  documentId: string;
  instanceId?: string | null;
  organizationId?: string | null;
  context: Context;
}) => {
  let token = await documentEditTokenService.verifyDocumentEditToken({
    token: d.editToken,
    documentId: d.documentId,
    instanceId: d.instanceId,
    organizationId: d.organizationId
  });
  let scope = {
    instance: token.owner.instance,
    project: token.owner.project,
    organization: token.owner.organization
  };

  let access = await resolveCargoAccess({
    scope,
    accessTags: token.accessTags,
    accessActor: token.accessActor,
    defaultPermissions: token.defaultPermissions,
    overridePermissions: token.overridePermissions
  });
  if (!access.actor || !access.actorId) {
    throw new ServiceError(forbiddenError({ message: 'Actor context is required' }));
  }

  let authorization = access.authorization;
  if (access.actor.consumerProfileOid != null) {
    let consumerProfile = await db.consumerProfile.findFirst({
      where: {
        oid: access.actor.consumerProfileOid,
        status: 'active',
        instanceOid: token.owner.instance.oid
      },
      select: {
        oid: true,
        instanceOid: true
      }
    });
    if (!consumerProfile) {
      throw new ServiceError(forbiddenError({ message: 'Invalid document edit token actor' }));
    }

    authorization = createResourceAuthorization({
      restricted: true,
      resourceActor: access.actor,
      accessTags: token.accessTags,
      project: scope.project,
      instance: token.owner.instance,
      consumerProfile
    });
  }

  let document = await documentService.getDocumentById({
    ...scope,
    documentId: token.documentId,
    authorization,
    defaultPermissions: token.defaultPermissions,
    overridePermissions: token.overridePermissions
  });
  let permissions = await documentService.getDocumentPermissions({
    ...scope,
    document,
    authorization,
    defaultPermissions: token.defaultPermissions,
    overridePermissions: token.overridePermissions
  });
  let hasCurrentPermission = (permission: 'content_read' | 'content_write') =>
    permissions.hasFullAccess || permissions.permissions.includes(permission);
  let effectivePermissions = token.permissions.filter(
    permission =>
      hasCurrentPermission(permission) &&
      !(permission == 'content_write' && document.isReadOnly)
  );
  if (!effectivePermissions.includes('content_read')) {
    throw new ServiceError(
      forbiddenError({ message: 'Document edit token does not grant read access' })
    );
  }

  return {
    documentId: token.documentId,
    instanceId: token.instanceId,
    organizationId: token.organizationId,
    actorId: access.actorId,
    context: d.context,
    authorization,
    defaultPermissions: token.defaultPermissions,
    overridePermissions: token.overridePermissions,
    permissions: effectivePermissions,
    expiresAt: token.expiresAt
  };
};

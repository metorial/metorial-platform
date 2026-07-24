import { documentEditTokenService } from '@metorial/cargo-module-doc';
import { resolveUploadTarget } from './uploadAccess';

let documentReadScopes = [
  'instance.file:read',
  'instance.file:write',
  'consumer#instance.document:read',
  'consumer#instance.document:write'
] as const;
let documentWriteScopes = ['instance.file:write', 'consumer#instance.document:write'] as const;

type AuthenticateRequest = (
  req: Request,
  url: URL
) => Promise<{
  auth: any;
}>;

export let resolveDocumentsLiveTarget = async (d: {
  req: Request;
  url: URL;
  documentId: string;
  instanceId?: string | null;
  organizationId?: string | null;
  editToken?: string | null;
  authenticateRequest: AuthenticateRequest;
}) => {
  if (d.editToken) {
    let { owner, accessTags, accessActor, defaultPermissions, overridePermissions } =
      await documentEditTokenService.verifyDocumentEditToken({
        token: d.editToken,
        documentId: d.documentId,
        instanceId: d.instanceId
      });

    return {
      owner,
      canWrite: true,
      cargoAccess: {
        accessTags,
        accessActor,
        defaultPermissions,
        overridePermissions
      }
    };
  }

  let { auth } = await d.authenticateRequest(d.req, d.url);
  return await resolveUploadTarget({
    auth,
    instanceId: d.instanceId,
    organizationId: d.organizationId,
    possibleScopes: [...documentReadScopes],
    writeScopes: [...documentWriteScopes]
  });
};

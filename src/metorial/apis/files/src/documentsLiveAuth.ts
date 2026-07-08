import { documentEditTokenService } from '@metorial/module-file';
import { resolveUploadTarget } from './uploadAccess';

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
    let { owner, accessActor, defaultPermissions, overridePermissions } =
      await documentEditTokenService.verifyDocumentEditToken({
        token: d.editToken,
        documentId: d.documentId,
        instanceId: d.instanceId
      });

    return {
      owner,
      cargoAccess: {
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
    organizationId: d.organizationId
  });
};

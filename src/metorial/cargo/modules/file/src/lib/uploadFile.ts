import { generatePlainId } from '@lowerdeck/id';
import type { StoreParticipantPermissions } from '@metorial/db';
import type { ResourceAuthorization } from '@metorial/module-access';
import { fileService } from '../services/file';
import type { ResourceScope } from '@metorial/module-resource-tenant';
import { getCargoFilesBucketName, getStorage } from '../storage';

export let uploadCargoFile = async (
  d: ResourceScope & {
    purpose: string;
    file: Blob;
    fileName: string;
    mimeType?: string;
    storeId?: string;
    title?: string;
    fileId?: string;
    authorization: ResourceAuthorization;
    defaultPermissions?: StoreParticipantPermissions[];
    overridePermissions?: boolean;
    store?: {
      id: string;
      path: string;
    };
  }
) => {
  let storeId = d.storeId ?? generatePlainId(20);
  let mimeType = d.mimeType || d.file.type || 'application/octet-stream';

  await getStorage().putObject(getCargoFilesBucketName(), storeId, d.file, mimeType);

  return await fileService.createFile({
    resourceTenant: d.resourceTenant,
    resourceGroup: d.resourceGroup,
    purpose: d.purpose,
    storeId,
    input: {
      id: d.fileId,
      name: d.fileName,
      mimeType,
      size: d.file.size,
      title: d.title,
      authorization: d.authorization,
      defaultPermissions: d.defaultPermissions,
      overridePermissions: d.overridePermissions,
      store: d.store
    }
  });
};

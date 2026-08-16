import { generatePlainId } from '@lowerdeck/id';
import type { StoreParticipantPermissions } from '@metorial/db';
import type { CargoOwnerScope } from '../internal/ownerScope';
import type { ResourceAuthorization } from '@metorial/module-access';
import { fileService } from '../services/file';
import { getCargoFilesBucketName, getStorage } from '../storage';

export let uploadCargoFile = async (
  d: CargoOwnerScope & {
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

  let { file, ...scope } = d;

  return await fileService.createFile({
    ...scope,
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

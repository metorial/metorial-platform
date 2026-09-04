import { badRequestError, ServiceError } from '@lowerdeck/error';
import { generatePlainId } from '@lowerdeck/id';
import type { AuditScope } from '@metorial/audit-scope';
import type { StoreParticipantPermissions } from '@metorial/db';
import type { CargoOwnerScope } from '../internal/ownerScope';
import type { ResourceAuthorization } from '@metorial/module-access';
import { fileService } from '../services/file';
import {
  getPendingFileContentFlushAfter,
  shouldBufferFileContent
} from './pendingFileContent';
import { getCargoFilesBucketName, getStorage } from '../storage';
import {
  describeInvalidUploadSize,
  isValidDirectUploadSize,
  maxDirectUploadSize,
  useUploadUrlHint
} from './uploadPolicy';

export let uploadCargoFile = async (
  d: CargoOwnerScope & {
    auditScope: AuditScope;
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
      replace?: boolean;
    };
  }
) => {
  if (!isValidDirectUploadSize(d.file.size)) {
    throw new ServiceError(
      badRequestError({
        message: describeInvalidUploadSize({ size: d.file.size, max: maxDirectUploadSize }),
        hint: useUploadUrlHint
      })
    );
  }

  let storeId = d.storeId ?? generatePlainId(20);
  let mimeType = d.mimeType || d.file.type || 'application/octet-stream';

  let bufferContent = shouldBufferFileContent({
    fileName: d.fileName,
    size: d.file.size
  });
  let contentPersistence: Parameters<typeof fileService.createFile>[0]['internal'] = {
    contentPersistence: bufferContent
      ? {
          type: 'database',
          content: new Uint8Array(await d.file.arrayBuffer()),
          flushAfter: getPendingFileContentFlushAfter()
        }
      : { type: 'object' }
  };

  if (!bufferContent) {
    await getStorage().putObject(getCargoFilesBucketName(), storeId, d.file, mimeType);
  }

  let { file, ...scope } = d;

  return await fileService.createFile({
    ...scope,
    storeId,
    internal: contentPersistence,
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

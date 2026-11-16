import { badRequestError, ServiceError } from '@lowerdeck/error';
import { hashBytes, type ContentHashes } from '@lowerdeck/hash/content';
import type { AuditScope } from '@metorial/audit-scope';
import type { StoreParticipantPermissions } from '@metorial/db';
import type { CargoOwnerScope } from '../internal/ownerScope';
import type { ResourceAuthorization } from '@metorial/module-access';
import { fileService } from '../services/file';
import { putCargoObject } from './cargoObjects';
import { writeContentAddressedFile } from './contentAddressedWrite';
import {
  getPendingFileContentFlushAfter,
  shouldBufferFileContent
} from './pendingFileContent';
import {
  describeInvalidUploadSize,
  isValidDirectUploadSize,
  maxDirectUploadSize,
  useUploadUrlHint
} from './uploadPolicy';

export let uploadCargoFile = async (
  d: CargoOwnerScope & {
    auditScope?: AuditScope;
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

  let mimeType = d.mimeType || d.file.type || 'application/octet-stream';
  let content = new Uint8Array(await d.file.arrayBuffer());
  let bufferContent = shouldBufferFileContent({
    fileName: d.fileName,
    size: content.byteLength
  });

  let { file, storeId: explicitStoreId, ...scope } = d;

  let create = async (target: { storeId: string; hashes: ContentHashes }) =>
    await fileService.createFile({
      ...scope,
      storeId: target.storeId,
      internal: {
        contentHashes: target.hashes,
        contentPersistence: bufferContent
          ? {
              type: 'database',
              content,
              flushAfter: getPendingFileContentFlushAfter()
            }
          : { type: 'object' }
      },
      input: {
        id: d.fileId,
        name: d.fileName,
        mimeType,
        size: content.byteLength,
        title: d.title,
        authorization: d.authorization,
        defaultPermissions: d.defaultPermissions,
        overridePermissions: d.overridePermissions,
        store: d.store
      }
    });

  if (!explicitStoreId) {
    return await writeContentAddressedFile({ content, buffered: bufferContent, create });
  }

  if (!bufferContent) {
    await putCargoObject({ key: explicitStoreId, content, contentType: mimeType });
  }

  return await create({ storeId: explicitStoreId, hashes: hashBytes(content) });
};

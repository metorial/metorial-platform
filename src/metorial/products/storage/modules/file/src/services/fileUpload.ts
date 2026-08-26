import { badRequestError, notFoundError, ServiceError } from '@lowerdeck/error';
import { generatePlainId } from '@lowerdeck/id';
import { Service } from '@lowerdeck/service';
import type { Prisma, StoreParticipantPermissions } from '@metorial/db';
import { db, ID, withTransaction } from '@metorial/db';
import type { ResourceAuthorization } from '@metorial/module-access';
import { storeAccessService, storeWritePermission } from '@metorial/module-store';
import { ObjectStorageError, PublicUrlPurpose } from 'object-storage-client';
import { cargoFileScope, type CargoOwnerScope } from '../internal/ownerScope';
import { env } from '../env';
import { requireInstanceScope } from '../lib/instanceScope';
import { getCloudFrontUploadUrl } from '../lib/signedUploadUrl';
import {
  describeInvalidUploadSize,
  doesUploadedObjectMatch,
  getPendingUploadExpiresAt,
  getUploadUrlExpiresAt,
  isValidUploadSize,
  maxUploadSize,
  uploadUrlExpirationSecs
} from '../lib/uploadPolicy';
import { fileUploadCleanupSingleQueue } from '../queues/fileUploadCleanup';
import { getCargoFilesBucketName, getStorage } from '../storage';
import { fileService } from './file';
import { documentFilePurposeSlug, filePurposeService } from './filePurpose';

let include = {
  purpose: true,
  file: {
    select: {
      id: true
    }
  }
} satisfies Prisma.FileUploadInclude;

export type FileUploadRecord = Prisma.FileUploadGetPayload<{
  include: typeof include;
}>;

type FileUploadAccessInput = {
  authorization: ResourceAuthorization;
  defaultPermissions?: StoreParticipantPermissions[];
  overridePermissions?: boolean;
};

let isObjectMissingError = (error: unknown) =>
  error instanceof ObjectStorageError && error.statusCode === 404;

class FileUploadServiceImpl {
  private assertPending(upload: FileUploadRecord) {
    if (upload.status !== 'pending') {
      throw new ServiceError(
        badRequestError({
          message: `File upload ${upload.id} is ${upload.status} and can no longer be used`
        })
      );
    }

    if (upload.expiresAt <= new Date()) {
      throw new ServiceError(
        badRequestError({
          message: `File upload ${upload.id} has expired`
        })
      );
    }
  }

  private async createSignedUploadUrl(d: {
    uploadId: string;
    storeId: string;
    size: number;
    contentType: string;
    expiresAt: Date;
  }) {
    let host = env.service.UPLOAD_HOST;
    if (host) {
      let secret = env.service.SIGNED_UPLOAD_URL_TOKEN_SECRET;
      if (!secret) {
        throw new ServiceError(
          badRequestError({
            message: 'SIGNED_UPLOAD_URL_TOKEN_SECRET is required when UPLOAD_HOST is set'
          })
        );
      }

      return getCloudFrontUploadUrl({
        host,
        secret,
        uploadId: d.uploadId,
        storeId: d.storeId,
        size: d.size,
        contentType: d.contentType,
        expiresAt: d.expiresAt
      });
    }

    try {
      let res = await getStorage().getPublicURL(
        getCargoFilesBucketName(),
        d.storeId,
        uploadUrlExpirationSecs,
        PublicUrlPurpose.Upload
      );

      return res.url;
    } catch (error) {
      if (error instanceof ObjectStorageError) {
        throw new ServiceError(
          badRequestError({
            message: 'Signed upload URLs are not available for the configured object storage'
          })
        );
      }

      throw error;
    }
  }

  private async headUploadedObject(upload: Pick<FileUploadRecord, 'id' | 'storeId'>) {
    try {
      return await getStorage().headObject(getCargoFilesBucketName(), upload.storeId);
    } catch (error) {
      if (isObjectMissingError(error)) {
        throw new ServiceError(
          badRequestError({
            message: `No content has been uploaded for file upload ${upload.id}`
          })
        );
      }

      throw error;
    }
  }

  private async discardUploadedObject(upload: Pick<FileUploadRecord, 'storeId'>) {
    try {
      await getStorage().deleteObject(getCargoFilesBucketName(), upload.storeId);
    } catch (error) {
      if (!isObjectMissingError(error)) throw error;
    }
  }

  async createPendingUpload(
    d: CargoOwnerScope & {
      purpose: string;
      input: {
        name: string;
        size: number;
        mimeType?: string;
        title?: string;
        store?: {
          id: string;
          path: string;
          replace?: boolean;
        };
      };
    } & FileUploadAccessInput
  ) {
    let fileName = d.input.name?.trim();
    if (!fileName) {
      throw new ServiceError(
        badRequestError({
          message: 'File name is required'
        })
      );
    }

    if (!isValidUploadSize(d.input.size)) {
      throw new ServiceError(
        badRequestError({
          message: describeInvalidUploadSize({ size: d.input.size, max: maxUploadSize })
        })
      );
    }

    let purpose = await filePurposeService.getFilePurposeById({ id: d.purpose });
    if (purpose.slug === documentFilePurposeSlug) {
      throw new ServiceError(
        badRequestError({
          message: 'Document purpose cannot be used for normal file creation'
        })
      );
    }

    if (d.input.store) {
      let scope = requireInstanceScope(d, 'Attaching a file to a store');
      let store = await storeAccessService.getStoreById({
        ...scope,
        storeId: d.input.store.id
      });

      await storeAccessService.assertStoreAccessForStore({
        ...scope,
        store,
        authorization: d.authorization,
        defaultPermissions: d.defaultPermissions,
        overridePermissions: d.overridePermissions,
        requiredPermission: storeWritePermission
      });
    }

    let storeId = generatePlainId(20);
    let uploadId = await ID.generateId('fileUpload');
    let fileType = d.input.mimeType?.trim() || 'application/octet-stream';
    let uploadUrlExpiresAt = getUploadUrlExpiresAt();
    let uploadUrl = await this.createSignedUploadUrl({
      uploadId,
      storeId,
      size: d.input.size,
      contentType: fileType,
      expiresAt: uploadUrlExpiresAt
    });

    let upload = await db.fileUpload.create({
      data: {
        id: uploadId,
        ...cargoFileScope(d),
        purposeOid: purpose.oid,
        storeId,
        fileName,
        fileSize: d.input.size,
        fileType,
        title: d.input.title,
        attachStoreId: d.input.store?.id,
        attachPath: d.input.store?.path,
        attachReplace: d.input.store?.replace ?? false,
        createdByResourceActorOid: d.authorization.resourceActor?.oid,
        uploadUrlExpiresAt,
        expiresAt: getPendingUploadExpiresAt()
      },
      include
    });

    return { upload, uploadUrl };
  }

  async getPendingUploadById(
    d: CargoOwnerScope & {
      uploadId: string;
    }
  ) {
    let upload = await db.fileUpload.findFirst({
      where: {
        ...cargoFileScope(d),
        id: d.uploadId
      },
      include
    });

    if (!upload) throw new ServiceError(notFoundError('fileUpload', d.uploadId));

    return upload;
  }

  async completePendingUpload(
    d: CargoOwnerScope & {
      uploadId: string;
    } & FileUploadAccessInput
  ) {
    let { uploadId, authorization, defaultPermissions, overridePermissions, ...scope } = d;
    let access = { authorization, defaultPermissions, overridePermissions };

    let upload = await this.getPendingUploadById({ ...scope, uploadId });

    if (upload.status === 'completed' && upload.file) {
      return await fileService.getFileById({
        ...scope,
        ...access,
        fileId: upload.file.id
      });
    }

    this.assertPending(upload);

    let object = await this.headUploadedObject(upload);

    if (!doesUploadedObjectMatch({ declaredSize: upload.fileSize, actualSize: object.size })) {
      await this.discardUploadedObject(upload);

      throw new ServiceError(
        badRequestError({
          message: `Uploaded content is ${object.size} bytes but ${upload.fileSize} bytes were declared`
        })
      );
    }

    return await withTransaction(async tdb => {
      let claimed = await tdb.fileUpload.updateMany({
        where: {
          oid: upload.oid,
          status: 'pending'
        },
        data: {
          status: 'completed'
        }
      });

      if (claimed.count === 0) {
        let current = await tdb.fileUpload.findUnique({
          where: { oid: upload.oid },
          include
        });

        if (current?.status === 'completed' && current.file) {
          return await fileService.getFileById({
            ...scope,
            ...access,
            fileId: current.file.id
          });
        }

        throw new ServiceError(
          badRequestError({
            message: `File upload ${upload.id} can no longer be completed`
          })
        );
      }

      let file = await fileService.createFile({
        ...scope,
        purpose: upload.purpose.id,
        storeId: upload.storeId,
        internal: {
          contentPersistence: { type: 'object' }
        },
        input: {
          name: upload.fileName,
          mimeType: upload.fileType,
          size: upload.fileSize,
          title: upload.title ?? undefined,
          authorization,
          defaultPermissions,
          overridePermissions,
          store:
            upload.attachStoreId && upload.attachPath
              ? {
                  id: upload.attachStoreId,
                  path: upload.attachPath,
                  replace: upload.attachReplace
                }
              : undefined
        }
      });

      await tdb.fileUpload.update({
        where: { oid: upload.oid },
        data: { fileOid: file.oid }
      });

      return file;
    });
  }

  async cancelPendingUpload(
    d: CargoOwnerScope & {
      uploadId: string;
    }
  ) {
    let upload = await this.getPendingUploadById(d);

    this.assertPending(upload);

    let canceled = await db.fileUpload.updateMany({
      where: {
        oid: upload.oid,
        status: 'pending'
      },
      data: {
        status: 'canceled'
      }
    });

    if (canceled.count === 0) {
      throw new ServiceError(
        badRequestError({
          message: `File upload ${upload.id} can no longer be canceled`
        })
      );
    }

    await fileUploadCleanupSingleQueue.add(
      { fileUploadId: upload.id },
      { id: `file-upload-cleanup:${upload.id}` }
    );

    return await db.fileUpload.findUniqueOrThrow({
      where: { oid: upload.oid },
      include
    });
  }
}

export let fileUploadService = Service.create(
  'cargoFileUploadService',
  () => new FileUploadServiceImpl()
).build();

import { badRequestError, conflictError, notFoundError, ServiceError } from '@lowerdeck/error';
import { generatePlainId } from '@lowerdeck/id';
import { Service } from '@lowerdeck/service';
import type { Prisma, StoreParticipantPermissions } from '@metorial/db';
import { db, ID, withTransaction } from '@metorial/db';
import type { AuditScope } from '@metorial/audit-scope';
import { Fabric } from '@metorial/fabric';
import type { ResourceAuthorization } from '@metorial/module-access';
import { storeAccessService, storeWritePermission } from '@metorial/module-store';
import { createHash } from 'node:crypto';
import { ObjectStorageError, PublicUrlPurpose } from 'object-storage-client';
import { fileFabricOwnerFromScope } from '../internal/fabric';
import { cargoFileScope, type CargoOwnerScope } from '../internal/ownerScope';
import { env } from '../env';
import { deleteCargoObjectIfUnreferenced } from '../lib/cargoObjects';
import { requireInstanceScope } from '../lib/instanceScope';
import {
  getFirstMultipartPartNumbers,
  getMultipartManifests,
  selectMultipartPartSize,
  supportsFileMultipartUpload,
  withMultipartUploadLock
} from '../lib/multipartUpload';
import { getCloudFrontUploadUrl } from '../lib/signedUploadUrl';
import {
  describeInvalidUploadSize,
  doesUploadedObjectMatch,
  getPendingUploadExpiresAt,
  getPurposeUploadSizeError,
  getUploadUrlExpiresAt,
  isValidUploadSize,
  maxOnPremMultipartUploadSize,
  maxUploadSize,
  uploadUrlExpirationSecs,
  useUploadUrlHint
} from '../lib/uploadPolicy';
import { fileUploadCleanupSingleQueue } from '../queues/fileUploadCleanup';
import { getCargoFilesBucketName, getStorage } from '../storage';
import { fileService } from './file';
import { documentFilePurposeSlug, filePurposeService } from './filePurpose';

let singleMediaTypePattern =
  /^[a-z0-9][a-z0-9!#$&^_.+-]*\/[a-z0-9][a-z0-9!#$&^_.+-]*\s*(;[\x20-\x2b\x2d-\x7e]*)?$/i;

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

type PreparedUpload =
  | { kind: 'single'; url: string; headers: Record<string, string> }
  | {
      kind: 'multipart';
      partSize: number;
      partCount: number;
      parts: Awaited<ReturnType<typeof getMultipartManifests>>;
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

      return {
        url: getCloudFrontUploadUrl({
          host,
          secret,
          uploadId: d.uploadId,
          storeId: d.storeId,
          size: d.size,
          contentType: d.contentType,
          expiresAt: d.expiresAt
        }),
        headers: {} as Record<string, string>
      };
    }

    try {
      let res = await getStorage().getPublicURL(
        getCargoFilesBucketName(),
        d.storeId,
        uploadUrlExpirationSecs,
        PublicUrlPurpose.Upload
      );

      return { url: res.url, headers: res.headers };
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
      await deleteCargoObjectIfUnreferenced({
        bucket: getCargoFilesBucketName(),
        key: upload.storeId
      });
    } catch (error) {
      if (!isObjectMissingError(error)) throw error;
    }
  }

  async createPendingUpload(
    d: CargoOwnerScope & {
      auditScope?: AuditScope;
      purpose: string;
      acceptMultipart?: boolean;
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

    let multipartEnabled = supportsFileMultipartUpload();
    let acceptsMultipart = multipartEnabled && d.acceptMultipart;
    let sizeLimit = acceptsMultipart ? maxOnPremMultipartUploadSize : maxUploadSize;
    if (!isValidUploadSize(d.input.size, sizeLimit)) {
      throw new ServiceError(
        badRequestError({
          message: describeInvalidUploadSize({ size: d.input.size, max: sizeLimit }),
          hint:
            multipartEnabled &&
            !acceptsMultipart &&
            isValidUploadSize(d.input.size, maxOnPremMultipartUploadSize)
              ? useUploadUrlHint
              : undefined
        })
      );
    }

    let fileType = d.input.mimeType?.trim() || 'application/octet-stream';
    if (!singleMediaTypePattern.test(fileType)) {
      throw new ServiceError(
        badRequestError({
          message: 'File type must be a single media type, for example image/png'
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

    let purposeSizeError = getPurposeUploadSizeError({
      purposeSlug: purpose.slug,
      size: d.input.size
    });
    if (purposeSizeError) {
      throw new ServiceError(badRequestError({ message: purposeSizeError }));
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
    let uploadUrlExpiresAt = getUploadUrlExpiresAt();
    let fabricOwner = {
      ...fileFabricOwnerFromScope(d, d.input.size),
      auditScope: d.auditScope
    };

    await Fabric.fire('file.upload.created:before', fabricOwner);

    let expiresAt = getPendingUploadExpiresAt();
    let partSize = acceptsMultipart ? selectMultipartPartSize(d.input.size) : null;
    let multipartUploadId: string | null = null;
    try {
      let target: PreparedUpload;
      if (partSize) {
        multipartUploadId = await getStorage().startMultipartUpload(
          getCargoFilesBucketName(),
          storeId,
          fileType
        );

        let partCount = Math.ceil(d.input.size / partSize);
        let parts = await getMultipartManifests({
          storeId,
          uploadId: multipartUploadId,
          fileSize: d.input.size,
          partSize,
          expiresAt,
          numbers: getFirstMultipartPartNumbers(partCount)
        });
        target = { kind: 'multipart', partSize, partCount, parts };
      } else {
        let signed = await this.createSignedUploadUrl({
          uploadId,
          storeId,
          size: d.input.size,
          contentType: fileType,
          expiresAt: uploadUrlExpiresAt
        });
        target = { kind: 'single', ...signed };
      }

      let upload = await withTransaction(async db => {
        let created = await db.fileUpload.create({
          data: {
            id: uploadId,
            ...cargoFileScope(d),
            purposeOid: purpose.oid,
            storeId,
            multipartUploadId,
            multipartPartSize: partSize,
            fileName,
            fileSize: BigInt(d.input.size),
            fileType,
            title: d.input.title,
            attachStoreId: d.input.store?.id,
            attachPath: d.input.store?.path,
            attachReplace: d.input.store?.replace ?? false,
            createdByResourceActorOid: d.authorization.resourceActor?.oid,
            uploadUrlExpiresAt,
            expiresAt
          },
          include
        });

        await Fabric.fire('file.upload.created:after', {
          ...fabricOwner,
          fileUpload: created
        });

        return created;
      });

      return target.kind === 'single'
        ? { upload, uploadUrl: target.url, uploadHeaders: target.headers, multipart: null }
        : { upload, uploadUrl: null, uploadHeaders: {}, multipart: target };
    } catch (error) {
      if (multipartUploadId) {
        await getStorage()
          .abortMultipartUpload(getCargoFilesBucketName(), storeId, multipartUploadId)
          .catch(abortError => console.error('Could not abort the file upload', abortError));
      }
      throw error;
    }
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
      auditScope?: AuditScope;
      uploadId: string;
      receipts?: string[];
    } & FileUploadAccessInput
  ) {
    let upload = await this.getPendingUploadById(d);
    if (upload.multipartUploadId) {
      this.assertMultipartUploadEnabled();
      this.assertMultipartOwner(upload, d.authorization);
      return await withMultipartUploadLock(upload.id, async () => {
        let current = await this.getPendingUploadById(d);
        return await this.finishPendingUpload(d, current);
      });
    }
    return await this.finishPendingUpload(d, upload);
  }

  private async finishPendingUpload(
    d: CargoOwnerScope & {
      auditScope?: AuditScope;
      uploadId: string;
      receipts?: string[];
    } & FileUploadAccessInput,
    upload: FileUploadRecord
  ) {
    let {
      uploadId,
      receipts,
      authorization,
      defaultPermissions,
      overridePermissions,
      ...scope
    } = d;
    let access = { authorization, defaultPermissions, overridePermissions };

    if (upload.status === 'completed' && upload.file) {
      return await fileService.getFileById({
        ...scope,
        ...access,
        fileId: upload.file.id
      });
    }

    this.assertPending(upload);

    if (upload.multipartUploadId && upload.multipartPartSize) {
      await this.commitMultipartObject(
        upload,
        upload.multipartUploadId,
        upload.multipartPartSize,
        receipts
      );
    } else if (receipts !== undefined) {
      throw new ServiceError(
        badRequestError({ message: 'This upload does not accept part receipts' })
      );
    }

    let object = await this.headUploadedObject(upload);

    if (
      !doesUploadedObjectMatch({
        declaredSize: Number(upload.fileSize),
        actualSize: object.size
      })
    ) {
      await this.discardUploadedObject(upload);

      throw new ServiceError(
        badRequestError({
          message: `Uploaded content is ${object.size} bytes but ${upload.fileSize} bytes were declared`
        })
      );
    }

    let fabricOwner = {
      ...fileFabricOwnerFromScope(scope, Number(upload.fileSize)),
      auditScope: d.auditScope
    };

    await Fabric.fire('file.upload.completed:before', {
      ...fabricOwner,
      fileUpload: upload
    });

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
            message: `File upload ${uploadId} can no longer be completed`
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
          size: Number(upload.fileSize),
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
      await fileService.requestContentHashes({ file });

      await Fabric.fire('file.upload.completed:after', {
        ...fabricOwner,
        fileUpload: upload,
        file
      });

      return file;
    });
  }

  private assertMultipartUploadEnabled() {
    if (!supportsFileMultipartUpload()) {
      throw new ServiceError(
        badRequestError({ message: 'Multipart file uploads require the on-prem edition' })
      );
    }
  }

  private assertMultipartOwner(
    upload: FileUploadRecord,
    authorization: ResourceAuthorization
  ) {
    if (
      upload.createdByResourceActorOid &&
      upload.createdByResourceActorOid !== authorization.resourceActor?.oid
    ) {
      throw new ServiceError(notFoundError('fileUpload', upload.id));
    }
  }

  async getPendingPartManifests(
    d: CargoOwnerScope & {
      uploadId: string;
      numbers: number[];
      authorization: ResourceAuthorization;
    }
  ) {
    this.assertMultipartUploadEnabled();
    let upload = await this.getPendingUploadById(d);
    this.assertMultipartOwner(upload, d.authorization);
    this.assertPending(upload);
    if (
      !upload.multipartUploadId ||
      !upload.multipartPartSize ||
      upload.multipartCompletionDigest
    ) {
      throw new ServiceError(
        badRequestError({ message: 'This upload cannot issue part manifests' })
      );
    }

    return await getMultipartManifests({
      storeId: upload.storeId,
      uploadId: upload.multipartUploadId,
      fileSize: Number(upload.fileSize),
      partSize: upload.multipartPartSize,
      expiresAt: upload.expiresAt,
      numbers: d.numbers
    });
  }

  private async commitMultipartObject(
    upload: FileUploadRecord,
    multipartId: string,
    partSize: number,
    receipts?: string[]
  ) {
    if (receipts?.length !== Math.ceil(Number(upload.fileSize) / partSize)) {
      throw new ServiceError(
        badRequestError({ message: 'Expected one receipt for every part' })
      );
    }

    let digest = createHash('sha256').update(JSON.stringify(receipts)).digest('hex');
    if (upload.multipartCompletionDigest && upload.multipartCompletionDigest !== digest) {
      throw new ServiceError(
        conflictError({ message: 'This upload is already completing with different receipts' })
      );
    }
    if (!upload.multipartCompletionDigest) {
      await db.fileUpload.update({
        where: { oid: upload.oid },
        data: { multipartCompletionDigest: digest }
      });
    }

    try {
      await getStorage().completePublicMultipartUpload(
        getCargoFilesBucketName(),
        upload.storeId,
        multipartId,
        Number(upload.fileSize),
        partSize,
        receipts
      );
    } catch (error) {
      if (error instanceof ObjectStorageError && error.statusCode === 400) {
        await db.fileUpload.update({
          where: { oid: upload.oid },
          data: { multipartCompletionDigest: null }
        });
        throw new ServiceError(
          badRequestError({ message: 'The object store rejected the multipart receipts' })
        );
      }
      throw error;
    }
  }

  async cancelPendingUpload(
    d: CargoOwnerScope & {
      uploadId: string;
      multipartOnly?: boolean;
      authorization?: ResourceAuthorization;
    }
  ) {
    let upload = await this.getPendingUploadById(d);
    if (d.multipartOnly) {
      this.assertMultipartUploadEnabled();
      if (!upload.multipartUploadId || !d.authorization) {
        throw new ServiceError(
          badRequestError({ message: 'This file upload is not multipart' })
        );
      }
      this.assertMultipartOwner(upload, d.authorization);
    }

    if (upload.multipartUploadId) {
      return await withMultipartUploadLock(upload.id, async () => {
        return await this.cancelUpload(await this.getPendingUploadById(d));
      });
    }
    return await this.cancelUpload(upload);
  }

  private async cancelUpload(upload: FileUploadRecord) {
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

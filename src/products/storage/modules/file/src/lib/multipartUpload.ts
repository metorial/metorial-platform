import { badRequestError, ServiceError } from '@lowerdeck/error';
import { checkEdition } from '@metorial/editions';
import { createLock } from '@metorial/lock';
import { env } from '../env';
import { getCargoFilesBucketName, getStorage } from '../storage';
import { uploadUrlExpirationSecs } from './uploadPolicy';

let multipartThreshold = 75 * 1024 ** 2;
let multipartPartSize = 75 * 1024 ** 2;
let maxManifestBatch = 8;

let lock: ReturnType<typeof createLock> | undefined;

export let withMultipartUploadLock = async <T>(uploadId: string, run: () => Promise<T>) => {
  lock ??= createLock({ name: 'cargo/fileUpload/multipart' });
  return await lock.usingLock(uploadId, run, { acquisitionTimeoutMs: 15_000 });
};

export let supportsFileMultipartUpload = () => checkEdition('on-prem');

export let selectMultipartPartSize = (size: number) =>
  supportsFileMultipartUpload() &&
  size > (env.service.FILE_MULTIPART_THRESHOLD_BYTES ?? multipartThreshold)
    ? (env.service.FILE_MULTIPART_PART_BYTES ?? multipartPartSize)
    : null;

export let getMultipartManifests = async (d: {
  storeId: string;
  uploadId: string;
  fileSize: number;
  partSize: number;
  expiresAt: Date;
  numbers: number[];
}) => {
  let count = Math.ceil(d.fileSize / d.partSize);
  if (
    !d.numbers.length ||
    d.numbers.length > maxManifestBatch ||
    new Set(d.numbers).size !== d.numbers.length ||
    d.numbers.some(number => !Number.isInteger(number) || number < 1 || number > count)
  ) {
    throw new ServiceError(badRequestError({ message: 'Invalid multipart part numbers' }));
  }

  let expiresIn = Math.min(
    uploadUrlExpirationSecs,
    Math.floor((+d.expiresAt - Date.now()) / 1000)
  );
  if (expiresIn < 1) {
    throw new ServiceError(badRequestError({ message: 'File upload has expired' }));
  }

  return await getStorage().getPartManifests(
    getCargoFilesBucketName(),
    d.storeId,
    d.uploadId,
    expiresIn,
    d.numbers.map(number => ({
      number,
      size: Math.min(d.partSize, d.fileSize - (number - 1) * d.partSize)
    }))
  );
};

export let getFirstMultipartPartNumbers = (count: number) =>
  Array.from({ length: Math.min(count, maxManifestBatch) }, (_, index) => index + 1);

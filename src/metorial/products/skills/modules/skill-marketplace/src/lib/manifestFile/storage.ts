import { getCargoFilesBucketName, getObjectStream, getStorage } from '@metorial/module-file';
import { openManifestFile, readManifestFile } from './reader';
import type { WrittenManifestFile } from './writer';

export let manifestObjectKeyPrefix = 'skill-sync/manifests/';
export let manifestContentType = 'application/gzip';

export type ManifestObjectRef = {
  bucket: string;
  key: string;
  sha256: string;
  entryCount: number;
};

export let getManifestObjectKey = (d: { destinationId: string; sha256: string }) =>
  `${manifestObjectKeyPrefix}${d.destinationId}/${d.sha256}.ndjson`;

// The key is content-addressed, so re-uploading the same manifest rewrites identical bytes.
export let uploadManifestFile = async (d: {
  destinationId: string;
  manifest: WrittenManifestFile;
}): Promise<ManifestObjectRef> => {
  let bucket = getCargoFilesBucketName();
  let key = getManifestObjectKey({
    destinationId: d.destinationId,
    sha256: d.manifest.sha256
  });

  await getStorage().putObject(bucket, key, d.manifest.body, manifestContentType);

  return { bucket, key, sha256: d.manifest.sha256, entryCount: d.manifest.entryCount };
};

let openObject = async (ref: { bucket?: string; key: string }) => {
  let object = await getObjectStream(ref.bucket ?? getCargoFilesBucketName(), ref.key);
  return object.stream;
};

export let openStoredManifestFile = async (ref: {
  bucket?: string;
  key: string;
  sha256: string;
  entryCount?: number;
}) =>
  await openManifestFile(await openObject(ref), {
    expectedSha256: ref.sha256,
    expectedEntryCount: ref.entryCount
  });

export let readStoredManifestFile = async (ref: {
  bucket?: string;
  key: string;
  sha256: string;
  entryCount?: number;
}) =>
  await readManifestFile(await openObject(ref), {
    expectedSha256: ref.sha256,
    expectedEntryCount: ref.entryCount
  });

import { env } from '@metorial/cargo-config';
import { fileService } from '@metorial/cargo-module-file';
import { createCodeBucketClient } from '@metorial/code-bucket-service-generated';
import type { File, SkillImportFileFormat } from '@metorial/db';
import { getOriginTenant, origin } from '../internal/skillDestination';
import { extractSkillArchive, normalizeUploadedSkillFile } from './archive';
import {
  fetchRepositoryArchive,
  getPublicRepositoryArchiveUrl,
  parsePublicRepositoryUrl
} from './publicRepository';

let codeBucketClient = createCodeBucketClient({
  address: env.origin.CODE_BUCKET_SERVICE_URL
});
let maxCodeBucketMessageBytes = 3 * 1024 * 1024;

export * from './publicRepository';

export let createImportCodeBucketFromFiles = async (d: {
  resourceTenant: { oid: bigint; id: string };
  files: { path: string; content: Uint8Array }[];
}) => {
  if (d.files.some(file => file.content.byteLength > maxCodeBucketMessageBytes)) {
    throw new Error('Skill import contains a file that is too large');
  }
  let originTenant = await getOriginTenant(d.resourceTenant);
  let bucket = await origin.codeBucket.create({
    tenantId: originTenant.id,
    purpose: 'cargo.skill.import',
    isReadOnly: false
  });

  let batch: typeof d.files = [];
  let batchBytes = 0;
  let flushBatch = async () => {
    if (batch.length === 0) return;
    await codeBucketClient.setBucketFiles({
      bucketId: bucket.id,
      files: batch.map(file => ({
        path: file.path,
        content: Buffer.from(file.content)
      }))
    });
    batch = [];
    batchBytes = 0;
  };

  for (let file of d.files) {
    if (batchBytes + file.content.byteLength > maxCodeBucketMessageBytes) await flushBatch();
    batch.push(file);
    batchBytes += file.content.byteLength;
  }
  await flushBatch();

  return bucket;
};

export let acquirePublicRepository = async (d: {
  resourceTenant: { oid: bigint; id: string };
  repositoryUrl: string;
  ref?: string | null;
}) => {
  let repository = parsePublicRepositoryUrl(d.repositoryUrl);
  let archive = await fetchRepositoryArchive(
    getPublicRepositoryArchiveUrl(repository, d.ref ?? 'HEAD')
  );
  let files = await extractSkillArchive(archive);
  let bucket = await createImportCodeBucketFromFiles({
    resourceTenant: d.resourceTenant,
    files
  });

  return { codeBucketId: bucket.id, repository };
};

export let acquireUploadedSkillFile = async (d: {
  resourceTenant: { oid: bigint; id: string };
  file: Pick<File, 'status' | 'storeId'>;
  format: SkillImportFileFormat;
}) => {
  let content = await fileService.downloadFileContent({ file: d.file });
  let files = await normalizeUploadedSkillFile({
    format: d.format,
    content: new Uint8Array(content)
  });
  let bucket = await createImportCodeBucketFromFiles({
    resourceTenant: d.resourceTenant,
    files
  });
  return { codeBucketId: bucket.id };
};

export let acquireOriginRepository = async (d: {
  resourceTenant: { oid: bigint; id: string };
  repositoryId: string;
  ref?: string | null;
  path?: string | null;
}) => {
  let originTenant = await getOriginTenant(d.resourceTenant);
  return await origin.codeBucket.createFromRepo({
    tenantId: originTenant.id,
    scmRepoId: d.repositoryId,
    purpose: 'cargo.skill.import',
    ref: d.ref ?? undefined,
    path: d.path ?? undefined,
    isReadOnly: true,
    isSynced: false
  });
};

export let getImportCodeBucket = async (d: {
  resourceTenant: { oid: bigint; id: string };
  codeBucketId: string;
}) => {
  let originTenant = await getOriginTenant(d.resourceTenant);
  return await origin.codeBucket.get({
    tenantId: originTenant.id,
    codeBucketId: d.codeBucketId
  });
};

let fileSizeToNumber = (size: number | { toNumber(): number }) =>
  typeof size === 'number' ? size : size.toNumber();

export let listCodeBucketFiles = async (d: { codeBucketId: string; prefix?: string }) => {
  let response = await codeBucketClient.getBucketFiles({
    bucketId: d.codeBucketId,
    prefix: d.prefix ?? ''
  });

  return response.files.map(file => ({
    path: file.path,
    contentType: file.contentType,
    size: fileSizeToNumber(file.size)
  }));
};

export let getCodeBucketFiles = async (d: {
  codeBucketId: string;
  prefix?: string;
  maxFiles?: number;
  maxTotalBytes?: number;
  include?: (file: { path: string; contentType: string; size: number }) => boolean;
  onProgress?: () => void | Promise<void>;
}) => {
  await d.onProgress?.();
  let files = (await listCodeBucketFiles(d)).filter(file => d.include?.(file) ?? true);
  if (files.length > (d.maxFiles ?? 5000)) {
    throw new Error('Repository contains too many files to import');
  }
  let totalBytes = files.reduce((total, file) => total + file.size, 0);
  if (totalBytes > (d.maxTotalBytes ?? 100 * 1024 * 1024)) {
    throw new Error('Repository content is too large to import');
  }
  let oversized = files.find(file => file.size > maxCodeBucketMessageBytes);
  if (oversized) throw new Error(`Repository file is too large to import: ${oversized.path}`);

  let filesWithContent = [];
  for (let file of files) {
    await d.onProgress?.();
    let response = await codeBucketClient.getBucketFile({
      bucketId: d.codeBucketId,
      path: file.path
    });
    if (!response.content?.fileInfo) continue;
    filesWithContent.push({
      path: response.content.fileInfo.path,
      contentType: response.content.fileInfo.contentType,
      size: fileSizeToNumber(response.content.fileInfo.size),
      content: Buffer.from(response.content.content)
    });
    await d.onProgress?.();
  }
  return filesWithContent;
};

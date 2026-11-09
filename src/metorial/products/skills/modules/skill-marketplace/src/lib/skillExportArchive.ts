import type { SkillDestinationManifest } from '@metorial/db';
import { getCargoFilesBucketName, getStorage } from '@metorial/module-file';
import { env } from '../env';
import { openStoredManifestFile } from './manifestFile/storage';

export let skillExportZipJobWaitSeconds = 20;
export let skillExportZipJobPollDelayMs = 10 * 1000;
export let skillExportZipJobTimeoutMs = 2 * 60 * 60 * 1000;
export let skillExportZipJobMaxAttempts = 3;

let retryableZipErrorCodes = new Set([
  'lease_expired',
  'interrupted',
  'internal',
  'backend_error'
]);

type ObjectStorage = ReturnType<typeof getStorage>;

export type SkillExportZipJob = Awaited<ReturnType<ObjectStorage['getZipJob']>>;

export type SkillExportZipJobSpec = Parameters<ObjectStorage['createZipJob']>[1];

export type SkillExportZipJobOutcome =
  | { type: 'wait' }
  | { type: 'completed'; result: NonNullable<SkillExportZipJob['result']> }
  | { type: 'resubmit' }
  | { type: 'recover' }
  | { type: 'fail'; reason: string };

// Zip job ids may only contain A-Z, a-z, 0-9, '.', '_' and '-'.
export let getSkillExportZipJobId = (d: {
  skillExportId: string;
  isRecoveryRetry?: boolean;
}) =>
  d.isRecoveryRetry
    ? `skill-export-${d.skillExportId}-retry`
    : `skill-export-${d.skillExportId}`;

export let isSkillExportRecoveryJobId = (jobId: string) => jobId.endsWith('-retry');

export let getSkillExportArchiveKey = (skillExportId: string) =>
  `skill-exports/${skillExportId}.zip`;

// The object-storage client only accepts the spec as an object, so the entries are collected
// in memory (~250 bytes each) rather than streamed into the request body.
export let buildSkillExportZipSpec = async (d: {
  skillExportId: string;
  manifest: Pick<SkillDestinationManifest, 'objectKey' | 'sha256' | 'entryCount'>;
}): Promise<SkillExportZipJobSpec> => {
  let bucket = getCargoFilesBucketName();
  let manifest = await openStoredManifestFile({
    bucket,
    key: d.manifest.objectKey,
    sha256: d.manifest.sha256,
    entryCount: d.manifest.entryCount
  });

  let entries: SkillExportZipJobSpec['entries'] = [];
  for await (let entry of manifest.entries) {
    entries.push({
      path: entry.path,
      source: { bucket, key: entry.key },
      size: entry.size,
      crc32: entry.crc32,
      compression: 'auto'
    });
  }

  return {
    destination: {
      bucket,
      key: getSkillExportArchiveKey(d.skillExportId),
      contentType: 'application/zip'
    },
    entries,
    maxArchiveBytes: env.skillSync.SKILL_EXPORT_MAX_ARCHIVE_BYTES
  };
};

export let getSkillExportZipJobOutcome = (d: {
  job: SkillExportZipJob;
  attempts: number;
  canRecover: boolean;
}): SkillExportZipJobOutcome => {
  if (d.job.state === 'queued' || d.job.state === 'running') return { type: 'wait' };

  if (d.job.state === 'completed') {
    if (!d.job.result) return { type: 'fail', reason: 'Zip job completed without a result' };
    return { type: 'completed', result: d.job.result };
  }

  if (d.job.state === 'canceled') return { type: 'fail', reason: 'Zip job was canceled' };

  let error = d.job.error;
  let reason = error ? `${error.code}: ${error.message}` : 'Zip job failed';

  if (error && (error.retryable || retryableZipErrorCodes.has(error.code))) {
    return d.attempts < skillExportZipJobMaxAttempts
      ? { type: 'resubmit' }
      : { type: 'fail', reason };
  }

  if (error?.code === 'source_not_found' && d.canRecover) return { type: 'recover' };

  return { type: 'fail', reason };
};

export let getObjectStorageErrorStatus = (error: unknown) => {
  let status = (error as { statusCode?: unknown } | null)?.statusCode;
  return typeof status == 'number' ? status : undefined;
};

// The zip service names the missing object in its message but has no structured field for it.
export let findMissingSkillExportSources = (d: {
  message: string;
  spec: Pick<SkillExportZipJobSpec, 'entries'>;
}) => [
  ...new Set(
    d.spec.entries.map(entry => entry.source.key).filter(key => d.message.includes(key))
  )
];

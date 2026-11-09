import type { SkillDestinationManifest } from '@metorial/db';
import {
  createZipJobFromSpecFile,
  getCargoFilesBucketName,
  getStorage
} from '@metorial/module-file';
import { createWriteStream } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { env } from '../env';
import { openStoredManifestFile } from './manifestFile/storage';
import { spoolAboveManifestEntries } from './manifestFile/writer';

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

export type SkillExportZipJobSpec = Exclude<
  Parameters<ObjectStorage['createZipJob']>[1],
  Blob
>;

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

type SkillExportManifestRef = Pick<
  SkillDestinationManifest,
  'objectKey' | 'sha256' | 'entryCount'
>;

export type PreparedSkillExportZipSpec =
  { spec: SkillExportZipJobSpec } | { path: string; dispose: () => Promise<void> };

let specChunkBytes = 64 * 1024;

let openSkillExportManifest = async (manifest: SkillExportManifestRef) =>
  await openStoredManifestFile({
    bucket: getCargoFilesBucketName(),
    key: manifest.objectKey,
    sha256: manifest.sha256,
    entryCount: manifest.entryCount
  });

async function* zipSpecEntries(manifest: SkillExportManifestRef) {
  let bucket = getCargoFilesBucketName();
  let opened = await openSkillExportManifest(manifest);

  for await (let entry of opened.entries) {
    let zipEntry: SkillExportZipJobSpec['entries'][number] = {
      path: entry.path,
      source: { bucket, key: entry.key },
      size: entry.size,
      crc32: entry.crc32
    };
    yield zipEntry;
  }
}

async function* zipSpecJsonChunks(
  header: Omit<SkillExportZipJobSpec, 'entries'>,
  entries: AsyncIterable<SkillExportZipJobSpec['entries'][number]>
) {
  let chunk = `${JSON.stringify(header).slice(0, -1)},"entries":[`;
  let separator = '';

  for await (let entry of entries) {
    chunk += separator + JSON.stringify(entry);
    separator = ',';
    if (chunk.length >= specChunkBytes) {
      yield chunk;
      chunk = '';
    }
  }

  yield `${chunk}]}`;
}

// A spec held in memory costs ~230 bytes per entry, so large specs are streamed from the manifest
// into a temporary file and sent from disk.
export let prepareSkillExportZipSpec = async (d: {
  skillExportId: string;
  manifest: SkillExportManifestRef;
}): Promise<PreparedSkillExportZipSpec> => {
  let header: Omit<SkillExportZipJobSpec, 'entries'> = {
    destination: {
      bucket: getCargoFilesBucketName(),
      key: getSkillExportArchiveKey(d.skillExportId),
      contentType: 'application/zip'
    },
    maxArchiveBytes: env.skillSync.SKILL_EXPORT_MAX_ARCHIVE_BYTES
  };

  if (d.manifest.entryCount <= spoolAboveManifestEntries) {
    let entries: SkillExportZipJobSpec['entries'] = [];
    for await (let entry of zipSpecEntries(d.manifest)) entries.push(entry);
    return { spec: { ...header, entries } };
  }

  let directory = await mkdtemp(join(tmpdir(), 'skill-export-spec-'));
  let path = join(directory, 'spec.json');
  let dispose = () => rm(directory, { recursive: true, force: true });

  try {
    await pipeline(
      Readable.from(zipSpecJsonChunks(header, zipSpecEntries(d.manifest))),
      createWriteStream(path)
    );
    return { path, dispose };
  } catch (error) {
    await dispose();
    throw error;
  }
};

export let createSkillExportZipJob = async (
  jobId: string,
  prepared: PreparedSkillExportZipSpec,
  options: { waitSeconds?: number } = {}
): Promise<SkillExportZipJob> =>
  'spec' in prepared
    ? await getStorage().createZipJob(jobId, prepared.spec, options)
    : await createZipJobFromSpecFile({ jobId, path: prepared.path, ...options });

export let disposeSkillExportZipSpec = async (prepared: PreparedSkillExportZipSpec) => {
  if ('dispose' in prepared) await prepared.dispose();
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

// Axios errors come from the storage client; TypeError (connection) and TimeoutError from the
// native fetch that sends spooled specs.
export let isZipJobConnectionError = (error: unknown) =>
  (error as { isAxiosError?: boolean } | null)?.isAxiosError === true ||
  error instanceof TypeError ||
  (error instanceof Error && error.name === 'TimeoutError');

export let getObjectStorageErrorStatus = (error: unknown) => {
  let status = (error as { statusCode?: unknown } | null)?.statusCode;
  return typeof status == 'number' ? status : undefined;
};

// The zip service names the missing object in its message but has no structured field for it.
export let findMissingSkillExportSources = async (d: {
  message: string;
  manifest: SkillExportManifestRef;
}) => {
  let keys = new Set<string>();
  let opened = await openSkillExportManifest(d.manifest);

  for await (let entry of opened.entries) {
    if (d.message.includes(entry.key)) keys.add(entry.key);
  }

  return [...keys];
};

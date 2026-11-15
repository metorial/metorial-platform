import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let { getObjectStream, createZipJob, createZipJobFromSpecFile } = vi.hoisted(() => ({
  getObjectStream: vi.fn(),
  createZipJob: vi.fn(),
  createZipJobFromSpecFile: vi.fn()
}));

vi.mock('@metorial/module-file', () => ({
  getCargoFilesBucketName: () => 'cargo-files',
  getObjectStream,
  getStorage: () => ({ createZipJob }),
  createZipJobFromSpecFile
}));
vi.mock('../env', () => ({
  env: { skillSync: { SKILL_EXPORT_MAX_ARCHIVE_BYTES: 20 * 1024 ** 3 } }
}));

import type { ManifestEntry } from './manifestFile/format';
import { writeManifestFile } from './manifestFile/writer';
import {
  createSkillExportZipJob,
  disposeSkillExportZipSpec,
  findMissingSkillExportSources,
  getSkillExportZipJobId,
  getSkillExportZipJobOutcome,
  isSkillExportRecoveryJobId,
  prepareSkillExportZipSpec,
  type SkillExportZipJob,
  type SkillExportZipJobSpec
} from './skillExportArchive';

let entry = (path: string, size: number, crc32: number): ManifestEntry => {
  let sha256 = createHash('sha256').update(path).digest('hex');

  return {
    path,
    gitBlobSha: createHash('sha1').update(path).digest('hex'),
    sha256,
    size,
    crc32,
    key: `skill-sync/blobs/sha256/${sha256}`
  };
};

let storeManifest = async (entries: ManifestEntry[]) => {
  let written = await writeManifestFile({
    destinationId: 'sdst_1',
    sourceBucket: 'cargo-files',
    scope: { dirs: ['plugins'], files: ['.claude-plugin/marketplace.json'], globs: [] },
    entries
  });
  getObjectStream.mockImplementation(async () => ({ stream: written.body }));

  return {
    objectKey: `skill-sync/manifests/sdst_1/${written.sha256}.ndjson`,
    sha256: written.sha256,
    entryCount: written.entryCount
  };
};

let zipJob = (overrides: Partial<SkillExportZipJob>): SkillExportZipJob => ({
  id: 'skill-export-ske_1',
  state: 'running',
  attempt: 1,
  specHash: 'spec',
  owner: 'instance',
  progress: {
    entriesTotal: 0,
    entriesDone: 0,
    bytesRead: 0,
    bytesWritten: 0,
    bytesEstimate: 0
  },
  result: null,
  error: null,
  leaseExpiresAt: null,
  createdAt: '2026-11-08T00:00:00Z',
  updatedAt: '2026-11-08T00:00:00Z',
  startedAt: null,
  finishedAt: null,
  ...overrides
});

let failedJob = (code: string, retryable: boolean, message = code) =>
  zipJob({ state: 'failed', error: { code: code as any, message, retryable } });

let largeManifestEntries = () =>
  Array.from({ length: 10_001 }, (_, i) =>
    entry(`plugins/p${String(i).padStart(5, '0')}/SKILL.md`, i, i)
  );

let destination = {
  bucket: 'cargo-files',
  key: 'skill-exports/ske_1.zip',
  contentType: 'application/zip'
};

describe('prepareSkillExportZipSpec', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('streams a small manifest into an in-memory spec', async () => {
    let manifest = await storeManifest([
      entry('plugins/acme/skills/qa/SKILL.md', 1834, 4_000_000_000),
      entry('.claude-plugin/marketplace.json', 0, 0),
      entry('plugins/acme/assets/logo.png', 2 * 1024 ** 3, 2_771_534_123)
    ]);

    let prepared = await prepareSkillExportZipSpec({ skillExportId: 'ske_1', manifest });

    expect(getObjectStream).toHaveBeenCalledWith('cargo-files', manifest.objectKey);
    expect(prepared).toEqual({
      spec: {
        destination,
        maxArchiveBytes: 20 * 1024 ** 3,
        entries: [
          {
            path: '.claude-plugin/marketplace.json',
            source: {
              bucket: 'cargo-files',
              key: entry('.claude-plugin/marketplace.json', 0, 0).key
            },
            size: 0,
            crc32: 0
          },
          {
            path: 'plugins/acme/assets/logo.png',
            source: {
              bucket: 'cargo-files',
              key: entry('plugins/acme/assets/logo.png', 0, 0).key
            },
            size: 2 * 1024 ** 3,
            crc32: 2_771_534_123
          },
          {
            path: 'plugins/acme/skills/qa/SKILL.md',
            source: {
              bucket: 'cargo-files',
              key: entry('plugins/acme/skills/qa/SKILL.md', 0, 0).key
            },
            size: 1834,
            crc32: 4_000_000_000
          }
        ]
      }
    });
  });

  it('spools a large manifest into a JSON spec file', async () => {
    let entries = largeManifestEntries();
    let manifest = await storeManifest(entries);

    let prepared = await prepareSkillExportZipSpec({ skillExportId: 'ske_1', manifest });
    if (!('path' in prepared)) throw new Error('expected a spooled spec');

    let spec: SkillExportZipJobSpec = JSON.parse(await readFile(prepared.path, 'utf8'));
    expect(spec.destination).toEqual(destination);
    expect(spec.maxArchiveBytes).toBe(20 * 1024 ** 3);
    expect(spec.entries).toHaveLength(10_001);
    expect(spec.entries[10_000]).toEqual({
      path: entries[10_000]!.path,
      source: { bucket: 'cargo-files', key: entries[10_000]!.key },
      size: 10_000,
      crc32: 10_000
    });

    await disposeSkillExportZipSpec(prepared);
    expect(existsSync(prepared.path)).toBe(false);
  });

  it('refuses a manifest whose bytes do not match its sha256', async () => {
    let manifest = await storeManifest([entry('plugins/a/SKILL.md', 1, 1)]);

    await expect(
      prepareSkillExportZipSpec({
        skillExportId: 'ske_1',
        manifest: { ...manifest, sha256: '0'.repeat(64) }
      })
    ).rejects.toMatchObject({ code: 'manifest_invalid' });
  });

  it('refuses a large manifest whose bytes do not match its sha256', async () => {
    let manifest = await storeManifest(largeManifestEntries());

    await expect(
      prepareSkillExportZipSpec({
        skillExportId: 'ske_1',
        manifest: { ...manifest, sha256: '0'.repeat(64) }
      })
    ).rejects.toMatchObject({ code: 'manifest_invalid' });
  });
});

describe('createSkillExportZipJob', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('sends an in-memory spec through the storage client', async () => {
    let spec = { destination, entries: [] };
    createZipJob.mockResolvedValue(zipJob({}));

    await createSkillExportZipJob('skill-export-ske_1', { spec }, { waitSeconds: 20 });

    expect(createZipJob).toHaveBeenCalledWith('skill-export-ske_1', spec, { waitSeconds: 20 });
    expect(createZipJobFromSpecFile).not.toHaveBeenCalled();
  });

  it('sends a spooled spec from its file', async () => {
    createZipJobFromSpecFile.mockResolvedValue(zipJob({}));

    await createSkillExportZipJob(
      'skill-export-ske_1',
      { path: '/tmp/spec.json', dispose: async () => {} },
      { waitSeconds: 20 }
    );

    expect(createZipJobFromSpecFile).toHaveBeenCalledWith({
      jobId: 'skill-export-ske_1',
      path: '/tmp/spec.json',
      waitSeconds: 20
    });
    expect(createZipJob).not.toHaveBeenCalled();
  });
});

describe('getSkillExportZipJobOutcome', () => {
  it('waits while the job is queued or running', () => {
    for (let state of ['queued', 'running'] as const) {
      expect(
        getSkillExportZipJobOutcome({ job: zipJob({ state }), attempts: 1, canRecover: true })
      ).toEqual({ type: 'wait' });
    }
  });

  it('returns the result of a completed job', () => {
    let result = {
      size: 10,
      sha256: 'a'.repeat(64),
      etag: 'etag',
      renamedEntries: [{ path: 'docs/what?.md', archivePath: 'docs/what_.md' }]
    };

    expect(
      getSkillExportZipJobOutcome({
        job: zipJob({ state: 'completed', result }),
        attempts: 1,
        canRecover: true
      })
    ).toEqual({ type: 'completed', result });
  });

  it.each(['lease_expired', 'interrupted', 'internal', 'backend_error'])(
    'resubmits %s until the third attempt',
    code => {
      expect(
        getSkillExportZipJobOutcome({
          job: failedJob(code, true),
          attempts: 2,
          canRecover: true
        })
      ).toEqual({ type: 'resubmit' });
      expect(
        getSkillExportZipJobOutcome({
          job: failedJob(code, true),
          attempts: 3,
          canRecover: true
        })
      ).toMatchObject({ type: 'fail' });
    }
  );

  it('recovers missing sources once', () => {
    expect(
      getSkillExportZipJobOutcome({
        job: failedJob('source_not_found', false),
        attempts: 1,
        canRecover: true
      })
    ).toEqual({ type: 'recover' });
    expect(
      getSkillExportZipJobOutcome({
        job: failedJob('source_not_found', false),
        attempts: 1,
        canRecover: false
      })
    ).toMatchObject({ type: 'fail' });
  });

  it('fails on canceled jobs and permanent errors', () => {
    expect(
      getSkillExportZipJobOutcome({
        job: zipJob({ state: 'canceled' }),
        attempts: 1,
        canRecover: true
      })
    ).toMatchObject({ type: 'fail' });
    expect(
      getSkillExportZipJobOutcome({
        job: failedJob('crc_mismatch', false, 'bad crc'),
        attempts: 1,
        canRecover: true
      })
    ).toEqual({ type: 'fail', reason: 'crc_mismatch: bad crc' });
  });
});

describe('zip job ids', () => {
  it('derives one id per export and a separate id for the recovery retry', () => {
    let first = getSkillExportZipJobId({ skillExportId: 'ske_1' });
    let retry = getSkillExportZipJobId({ skillExportId: 'ske_1', isRecoveryRetry: true });

    expect(first).toBe('skill-export-ske_1');
    expect(retry).not.toBe(first);
    expect(first).toMatch(/^[A-Za-z0-9._-]+$/);
    expect(retry).toMatch(/^[A-Za-z0-9._-]+$/);
    expect(isSkillExportRecoveryJobId(first)).toBe(false);
    expect(isSkillExportRecoveryJobId(retry)).toBe(true);
  });
});

describe('missing source recovery', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('finds the manifest keys named in the zip error', async () => {
    let missing = entry('plugins/b/SKILL.md', 2, 2);
    let manifest = await storeManifest([
      entry('plugins/a/SKILL.md', 1, 1),
      missing,
      entry('plugins/c/SKILL.md', 3, 3)
    ]);

    expect(
      await findMissingSkillExportSources({
        message: `${missing.key} was deleted while it was being archived`,
        manifest
      })
    ).toEqual([missing.key]);
  });
});

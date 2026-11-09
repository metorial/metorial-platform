import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let { getObjectStream } = vi.hoisted(() => ({ getObjectStream: vi.fn() }));

vi.mock('@metorial/module-file', () => ({
  getCargoFilesBucketName: () => 'cargo-files',
  getObjectStream,
  getStorage: vi.fn()
}));
vi.mock('../env', () => ({
  env: { skillSync: { SKILL_EXPORT_MAX_ARCHIVE_BYTES: 20 * 1024 ** 3 } }
}));

import type { ManifestEntry } from './manifestFile/format';
import { writeManifestFile } from './manifestFile/writer';
import {
  buildSkillExportZipSpec,
  findMissingSkillExportSources,
  getSkillExportZipJobId,
  getSkillExportZipJobOutcome,
  isSkillExportRecoveryJobId,
  type SkillExportZipJob
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
  getObjectStream.mockResolvedValue({ stream: written.body });

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

describe('buildSkillExportZipSpec', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('streams the manifest into entries with the size and crc32 passed through', async () => {
    let manifest = await storeManifest([
      entry('plugins/acme/skills/qa/SKILL.md', 1834, 4_000_000_000),
      entry('.claude-plugin/marketplace.json', 0, 0),
      entry('plugins/acme/assets/logo.png', 2 * 1024 ** 3, 2_771_534_123)
    ]);

    let spec = await buildSkillExportZipSpec({ skillExportId: 'ske_1', manifest });

    expect(getObjectStream).toHaveBeenCalledWith('cargo-files', manifest.objectKey);
    expect(spec.destination).toEqual({
      bucket: 'cargo-files',
      key: 'skill-exports/ske_1.zip',
      contentType: 'application/zip'
    });
    expect(spec.maxArchiveBytes).toBe(20 * 1024 ** 3);
    expect(spec.entries).toEqual([
      {
        path: '.claude-plugin/marketplace.json',
        source: {
          bucket: 'cargo-files',
          key: entry('.claude-plugin/marketplace.json', 0, 0).key
        },
        size: 0,
        crc32: 0,
        compression: 'auto'
      },
      {
        path: 'plugins/acme/assets/logo.png',
        source: {
          bucket: 'cargo-files',
          key: entry('plugins/acme/assets/logo.png', 0, 0).key
        },
        size: 2 * 1024 ** 3,
        crc32: 2_771_534_123,
        compression: 'auto'
      },
      {
        path: 'plugins/acme/skills/qa/SKILL.md',
        source: {
          bucket: 'cargo-files',
          key: entry('plugins/acme/skills/qa/SKILL.md', 0, 0).key
        },
        size: 1834,
        crc32: 4_000_000_000,
        compression: 'auto'
      }
    ]);
  });

  it('refuses a manifest whose bytes do not match its sha256', async () => {
    let manifest = await storeManifest([entry('plugins/a/SKILL.md', 1, 1)]);

    await expect(
      buildSkillExportZipSpec({
        skillExportId: 'ske_1',
        manifest: { ...manifest, sha256: '0'.repeat(64) }
      })
    ).rejects.toMatchObject({ code: 'manifest_invalid' });
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

  it('finds the keys named in the zip error', () => {
    let spec = {
      entries: [
        { path: 'a', source: { bucket: 'cargo-files', key: 'skill-sync/blobs/sha256/aa' } },
        { path: 'b', source: { bucket: 'cargo-files', key: 'sha256/bb' } },
        { path: 'c', source: { bucket: 'cargo-files', key: 'sha256/bb' } }
      ]
    };

    expect(
      findMissingSkillExportSources({
        message: 'sha256/bb was deleted while it was being archived',
        spec
      })
    ).toEqual(['sha256/bb']);
  });
});

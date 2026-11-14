import { beforeEach, describe, expect, it, vi } from 'vitest';

let mocks = vi.hoisted(() => ({
  db: {
    skillExport: {
      findFirst: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn()
    },
    skillExportRef: { update: vi.fn() },
    skillDestination: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn() },
    skillDestinationSync: { findFirst: vi.fn() },
    skillDestinationFile: { count: vi.fn() },
    skillDestinationManifest: { findUnique: vi.fn() },
    skillMarketplace: { findFirst: vi.fn() }
  },
  storage: {
    createZipJob: vi.fn(),
    getZipJob: vi.fn(),
    cancelZipJob: vi.fn()
  },
  codeBucketClient: { exportBucketFilesAsZipToUpload: vi.fn() },
  fileService: {
    createPendingUploadForStream: vi.fn(),
    completePendingUploadForStream: vi.fn(),
    updateFileExpiry: vi.fn()
  },
  fileLinkService: { createFileLink: vi.fn(), updateFileLinkExpiry: vi.fn() },
  fileReferenceService: { upsertFileReference: vi.fn() },
  filePurposeService: { upsertFilePurpose: vi.fn() },
  forceSkillDestinationSync: vi.fn(),
  enqueueSkillExport: vi.fn(),
  prepareSkillExportZipSpec: vi.fn(),
  findMissingSkillExportSources: vi.fn(),
  createZipJobFromSpecFile: vi.fn(),
  recoverMissingManifestSources: vi.fn(),
  deleteCargoObjectIfUnreferenced: vi.fn()
}));

vi.mock('@metorial/db', () => ({
  db: mocks.db,
  ID: { generateId: vi.fn() },
  withTransaction: async (run: (client: typeof mocks.db) => unknown) => await run(mocks.db)
}));
vi.mock('@metorial/module-file', () => ({
  fileService: mocks.fileService,
  fileLinkService: mocks.fileLinkService,
  fileReferenceService: mocks.fileReferenceService,
  filePurposeService: mocks.filePurposeService,
  getStorage: () => mocks.storage,
  createZipJobFromSpecFile: mocks.createZipJobFromSpecFile,
  getCargoFilesBucketName: () => 'cargo-files',
  deleteCargoObjectIfUnreferenced: mocks.deleteCargoObjectIfUnreferenced,
  isObjectMissingError: (error: any) => error?.statusCode === 404
}));
vi.mock('@mtsrc/scm-code-bucket-client-internal', () => ({
  createCodeBucketClient: () => mocks.codeBucketClient
}));
vi.mock('@metorial/module-access', () => ({ assertResourceActorScope: vi.fn() }));
vi.mock('@metorial/module-resource-actor', () => ({ resourceActorPresentationInclude: {} }));
vi.mock('@metorial/audit-scope', () => ({ createSystemAuditScope: vi.fn() }));
vi.mock('@metorial/skills-scm-utils', () => ({
  getSkillDestinationCodeBucketId: (destination: { codeBucketId: string }) =>
    destination.codeBucketId
}));
vi.mock('../env', () => ({
  env: {
    origin: { CODE_BUCKET_SERVICE_URL: 'http://code-bucket' },
    skillSync: { SKILL_EXPORT_MAX_ARCHIVE_BYTES: 20 * 1024 ** 3 }
  }
}));
vi.mock('../lib/destinationSync', () => ({
  forceSkillDestinationSync: mocks.forceSkillDestinationSync
}));
vi.mock('../queues/export', () => ({ enqueueSkillExport: mocks.enqueueSkillExport }));
vi.mock('./managedSkillPlugin', () => ({ managedSkillPluginService: {} }));
vi.mock('../lib/skillExportArchive', async importOriginal => ({
  ...(await importOriginal<typeof import('../lib/skillExportArchive')>()),
  prepareSkillExportZipSpec: mocks.prepareSkillExportZipSpec,
  findMissingSkillExportSources: mocks.findMissingSkillExportSources
}));
vi.mock('../queues/sync/manifest/recovery', () => ({
  recoverMissingManifestSources: mocks.recoverMissingManifestSources
}));

import { skillExportService } from './skillExport';

let { db, storage } = mocks;

let manifest = {
  oid: 7n,
  id: 'skdm_1',
  objectKey: 'skill-sync/manifests/sdst_1/abc.ndjson',
  sha256: 'abc',
  entryCount: 2,
  destinationOid: 1n
};

let spec = {
  destination: { bucket: 'cargo-files', key: 'skill-exports/ske_1.zip' },
  entries: [{ path: 'a', source: { bucket: 'cargo-files', key: 'sha256/aa' } }]
};

let state: { skillExport: any; destination: any };

let marketplace = { id: 'skmkt_1', oid: 5n, slug: 'acme', destinationOid: 1n };

let createRef = (overrides: Record<string, unknown> = {}) => ({
  oid: 10n,
  hash: 'ref-hash',
  skill: null,
  managedSkillPlugin: null,
  skillPlugin: null,
  skillMarketplace: marketplace,
  file: null,
  fileLink: null,
  fileReference: null,
  fileDestinationTag: null,
  fileManifestOid: null,
  ...overrides
});

let reusableFile = {
  file: { oid: 30n, status: 'active', expiresAt: null },
  fileLink: { oid: 31n, expiresAt: null },
  fileReference: { oid: 32n }
};

let zipJob = (overrides: Record<string, unknown>) => ({
  id: 'skill-export-ske_1',
  state: 'running',
  result: null,
  error: null,
  ...overrides
});

let completedJob = (renamedEntries: { path: string; archivePath: string }[] = []) =>
  zipJob({
    state: 'completed',
    result: { size: 100, sha256: 'f'.repeat(64), etag: 'etag', renamedEntries }
  });

let failedJob = (code: string, retryable: boolean, message = code) =>
  zipJob({ state: 'failed', error: { code, message, retryable } });

let applyData = (data: Record<string, any>) => {
  for (let [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    state.skillExport[key] =
      value && typeof value == 'object' && 'increment' in value
        ? state.skillExport[key] + value.increment
        : value;
  }
};

let run = (job: Record<string, unknown> = {}) =>
  skillExportService.processSkillExport({
    project: { oid: 2n } as any,
    instance: { oid: 3n, organizationOid: 4n } as any,
    skillExportId: 'ske_1',
    ...job
  });

describe('processSkillExport', () => {
  beforeEach(() => {
    vi.resetAllMocks();

    state = {
      skillExport: {
        id: 'ske_1',
        oid: 1n,
        status: 'pending',
        target: 'marketplace',
        createdAt: new Date(),
        startedAt: null,
        zipJobId: null,
        zipJobAttempts: 0,
        renamedEntries: null,
        exportRefOid: 10n,
        exportRef: createRef()
      },
      destination: {
        oid: 1n,
        id: 'sdst_1',
        storageMode: 'manifest',
        isDirty: false,
        tag: 3,
        codeBucketId: null,
        currentManifestOid: manifest.oid,
        currentManifest: manifest
      }
    };

    db.skillExport.findFirst.mockImplementation(async () => state.skillExport);
    db.skillExport.findUniqueOrThrow.mockImplementation(async () => state.skillExport);
    db.skillExport.update.mockImplementation(async ({ data }: any) => {
      applyData(data);
      return state.skillExport;
    });
    db.skillExport.updateMany.mockImplementation(async ({ where, data }: any) => {
      if (where.status && where.status !== state.skillExport.status) return { count: 0 };
      if (where.startedAt === null && state.skillExport.startedAt) return { count: 0 };
      applyData(data);
      return { count: 1 };
    });
    db.skillDestination.findUnique.mockImplementation(async () => state.destination);
    db.skillDestination.findUniqueOrThrow.mockImplementation(async () => state.destination);
    db.skillDestinationManifest.findUnique.mockResolvedValue(manifest);
    db.skillMarketplace.findFirst.mockImplementation(async () => ({
      ...marketplace,
      skillConfigurationOid: null,
      destination: state.destination
    }));

    mocks.prepareSkillExportZipSpec.mockResolvedValue({ spec });
    mocks.findMissingSkillExportSources.mockImplementation(async ({ message }: any) =>
      spec.entries.map(entry => entry.source.key).filter(key => message.includes(key))
    );
    db.skillDestinationFile.count.mockResolvedValue(5000);
    mocks.filePurposeService.upsertFilePurpose.mockResolvedValue({ slug: 'skill_export' });
    mocks.fileService.completePendingUploadForStream.mockResolvedValue({ oid: 40n });
    mocks.fileLinkService.createFileLink.mockResolvedValue({ oid: 41n });
    mocks.fileReferenceService.upsertFileReference.mockResolvedValue({ oid: 42n });
    mocks.fileService.updateFileExpiry.mockImplementation(async ({ file }: any) => file);
    mocks.fileLinkService.updateFileLinkExpiry.mockImplementation(
      async ({ fileLink }: any) => fileLink
    );
    mocks.forceSkillDestinationSync.mockResolvedValue({ id: 'skds_forced' });
    mocks.deleteCargoObjectIfUnreferenced.mockResolvedValue(true);
  });

  describe('manifest destinations', () => {
    it('reuses the existing file when the manifest is unchanged', async () => {
      state.skillExport.exportRef = createRef({
        ...reusableFile,
        fileManifestOid: manifest.oid
      });

      await run();

      expect(state.skillExport).toMatchObject({ status: 'completed', fileOid: 30n });
      expect(storage.createZipJob).not.toHaveBeenCalled();
      expect(mocks.forceSkillDestinationSync).not.toHaveBeenCalled();
    });

    it('ignores the legacy tag when deciding about reuse', async () => {
      state.skillExport.exportRef = createRef({
        ...reusableFile,
        fileDestinationTag: state.destination.tag,
        fileManifestOid: 99n
      });
      storage.createZipJob.mockResolvedValue(completedJob());

      await run();

      expect(storage.createZipJob).toHaveBeenCalled();
      expect(state.skillExport.fileOid).toBe(40n);
    });

    it('builds the archive with a per-export job id and records the file and manifest', async () => {
      let renamedEntries = [{ path: 'docs/what?.md', archivePath: 'docs/what_.md' }];
      storage.createZipJob.mockResolvedValue(completedJob(renamedEntries));

      await run();

      expect(mocks.prepareSkillExportZipSpec).toHaveBeenCalledWith({
        skillExportId: 'ske_1',
        manifest: expect.objectContaining({ oid: manifest.oid })
      });
      expect(storage.createZipJob).toHaveBeenCalledWith('skill-export-ske_1', spec, {
        waitSeconds: 20
      });
      expect(mocks.fileService.completePendingUploadForStream).toHaveBeenCalledWith(
        expect.objectContaining({
          storeId: 'skill-exports/ske_1.zip',
          input: expect.objectContaining({ name: 'acme.zip', mimeType: 'application/zip' })
        })
      );
      expect(mocks.codeBucketClient.exportBucketFilesAsZipToUpload).not.toHaveBeenCalled();
      expect(mocks.fileService.createPendingUploadForStream).not.toHaveBeenCalled();
      expect(state.skillExport).toMatchObject({
        status: 'completed',
        zipJobId: 'skill-export-ske_1',
        zipJobAttempts: 1,
        fileOid: 40n,
        fileLinkOid: 41n,
        fileReferenceOid: 42n,
        renamedEntries
      });
      expect(db.skillExportRef.update).toHaveBeenCalledWith({
        where: { oid: 10n },
        data: {
          fileOid: 40n,
          fileReferenceOid: 42n,
          fileLinkOid: 41n,
          fileDestinationTag: null,
          fileManifestOid: manifest.oid
        }
      });
    });

    it('forces a sync when the destination is dirty or has no manifest yet', async () => {
      for (let destination of [
        { isDirty: true },
        { currentManifestOid: null, currentManifest: null }
      ]) {
        Object.assign(state.destination, destination);
        mocks.enqueueSkillExport.mockClear();

        await run();

        expect(mocks.enqueueSkillExport).toHaveBeenCalledWith(
          { skillExportId: 'ske_1', skillDestinationSyncId: 'skds_forced', syncWaits: 1 },
          { delay: 5000 }
        );
      }

      expect(storage.createZipJob).not.toHaveBeenCalled();
    });

    it('waits for the content stage and ignores the repository stage', async () => {
      db.skillDestinationSync.findFirst.mockResolvedValueOnce({
        id: 'skds_1',
        oid: 1n,
        status: 'processing',
        manifest: null
      });

      await run({ skillDestinationSyncId: 'skds_1' });

      expect(mocks.enqueueSkillExport).toHaveBeenCalledWith(
        { skillExportId: 'ske_1', skillDestinationSyncId: 'skds_1', syncWaits: 1 },
        { delay: 5000 }
      );
      expect(storage.createZipJob).not.toHaveBeenCalled();

      db.skillDestinationSync.findFirst.mockResolvedValueOnce({
        id: 'skds_1',
        oid: 1n,
        status: 'waiting_for_review',
        manifest: { ...manifest, oid: 8n, id: 'skdm_2' }
      });
      storage.createZipJob.mockResolvedValue(completedJob());

      await run({ skillDestinationSyncId: 'skds_1' });

      expect(mocks.prepareSkillExportZipSpec).toHaveBeenCalledWith(
        expect.objectContaining({ manifest: expect.objectContaining({ oid: 8n }) })
      );
      expect(state.skillExport.status).toBe('completed');
      expect(mocks.forceSkillDestinationSync).not.toHaveBeenCalled();
    });

    it('follows a canceled sync to the newest sync of the destination', async () => {
      db.skillDestinationSync.findFirst
        .mockResolvedValueOnce({
          id: 'skds_1',
          oid: 1n,
          destinationOid: 1n,
          status: 'canceled',
          manifest: null
        })
        .mockResolvedValueOnce({ id: 'skds_2', oid: 2n });

      await run({ skillDestinationSyncId: 'skds_1' });

      expect(db.skillDestinationSync.findFirst).toHaveBeenLastCalledWith({
        where: { destinationOid: 1n, oid: { gt: 1n } },
        orderBy: { oid: 'desc' }
      });
      expect(mocks.enqueueSkillExport).toHaveBeenCalledWith(
        { skillExportId: 'ske_1', skillDestinationSyncId: 'skds_2', syncWaits: 1 },
        { delay: 5000 }
      );
      expect(state.skillExport.status).toBe('pending');
    });

    it('re-checks a small destination every second for the first ten waits', async () => {
      db.skillDestinationFile.count.mockResolvedValue(1000);
      db.skillDestinationSync.findFirst.mockResolvedValue({
        id: 'skds_1',
        oid: 1n,
        status: 'processing',
        manifest: null
      });

      await run({ skillDestinationSyncId: 'skds_1' });
      await run({ skillDestinationSyncId: 'skds_1', syncWaits: 9 });
      await run({ skillDestinationSyncId: 'skds_1', syncWaits: 10 });

      expect(db.skillDestinationFile.count).toHaveBeenCalledWith({
        where: { destinationOid: 1n },
        take: 1001
      });
      expect(mocks.enqueueSkillExport.mock.calls).toEqual([
        [
          { skillExportId: 'ske_1', skillDestinationSyncId: 'skds_1', syncWaits: 1 },
          { delay: 1000 }
        ],
        [
          { skillExportId: 'ske_1', skillDestinationSyncId: 'skds_1', syncWaits: 10 },
          { delay: 1000 }
        ],
        [
          { skillExportId: 'ske_1', skillDestinationSyncId: 'skds_1', syncWaits: 11 },
          { delay: 5000 }
        ]
      ]);
    });

    it('re-checks a destination with more than 1,000 files every five seconds', async () => {
      db.skillDestinationFile.count.mockResolvedValue(1001);
      db.skillDestinationSync.findFirst.mockResolvedValue({
        id: 'skds_1',
        oid: 1n,
        status: 'pending',
        manifest: null
      });

      await run({ skillDestinationSyncId: 'skds_1' });

      expect(mocks.enqueueSkillExport).toHaveBeenCalledWith(
        { skillExportId: 'ske_1', skillDestinationSyncId: 'skds_1', syncWaits: 1 },
        { delay: 5000 }
      );
    });

    it('sends a spooled spec from its file and disposes it after the request', async () => {
      let dispose = vi.fn(async () => {});
      mocks.prepareSkillExportZipSpec.mockResolvedValue({ path: '/tmp/spec.json', dispose });
      mocks.createZipJobFromSpecFile.mockResolvedValue(completedJob());

      await run();

      expect(mocks.createZipJobFromSpecFile).toHaveBeenCalledWith({
        jobId: 'skill-export-ske_1',
        path: '/tmp/spec.json',
        waitSeconds: 20
      });
      expect(storage.createZipJob).not.toHaveBeenCalled();
      expect(dispose).toHaveBeenCalledTimes(1);
      expect(state.skillExport.status).toBe('completed');
    });

    it('disposes a spooled spec when the request fails', async () => {
      let dispose = vi.fn(async () => {});
      mocks.prepareSkillExportZipSpec.mockResolvedValue({ path: '/tmp/spec.json', dispose });
      mocks.createZipJobFromSpecFile.mockRejectedValue(
        Object.assign(new Error('conflict'), { statusCode: 409 })
      );

      await expect(run()).rejects.toThrow('conflict');
      expect(dispose).toHaveBeenCalledTimes(1);
    });

    it('keeps polling when the spooled spec request cannot reach the zip service', async () => {
      mocks.prepareSkillExportZipSpec.mockResolvedValue({
        path: '/tmp/spec.json',
        dispose: async () => {}
      });
      mocks.createZipJobFromSpecFile.mockRejectedValue(new TypeError('fetch failed'));

      await run();

      expect(state.skillExport.status).toBe('pending');
      expect(mocks.enqueueSkillExport).toHaveBeenCalledWith(
        expect.objectContaining({ manifestId: 'skdm_1' }),
        { delay: 5000 }
      );
    });

    it('fails when the sync ended without content', async () => {
      db.skillDestinationSync.findFirst.mockResolvedValue({
        id: 'skds_1',
        oid: 1n,
        status: 'failed',
        manifest: null
      });

      await run({ skillDestinationSyncId: 'skds_1' });

      expect(state.skillExport.status).toBe('failed');
    });

    it('polls an unfinished job by re-enqueueing instead of holding the worker', async () => {
      storage.createZipJob.mockResolvedValue(zipJob({ state: 'running' }));

      await run();

      expect(mocks.enqueueSkillExport).toHaveBeenCalledWith(
        {
          skillExportId: 'ske_1',
          manifestId: 'skdm_1',
          zipStartedAt: expect.any(Number),
          zipPolls: 1
        },
        { delay: 5000 }
      );
      let zipStartedAt = mocks.enqueueSkillExport.mock.calls[0]![0].zipStartedAt;

      storage.getZipJob.mockResolvedValue(zipJob({ state: 'queued' }));
      mocks.enqueueSkillExport.mockClear();

      await run({ manifestId: 'skdm_1', zipStartedAt, zipPolls: 1 });

      expect(storage.getZipJob).toHaveBeenCalledWith('skill-export-ske_1');
      expect(storage.createZipJob).toHaveBeenCalledTimes(1);
      expect(mocks.enqueueSkillExport).toHaveBeenCalledWith(
        { skillExportId: 'ske_1', manifestId: 'skdm_1', zipStartedAt, zipPolls: 2 },
        { delay: 5000 }
      );

      storage.getZipJob.mockResolvedValue(completedJob());

      await run({ manifestId: 'skdm_1', zipStartedAt, zipPolls: 2 });

      expect(state.skillExport.status).toBe('completed');
      expect(db.skillExportRef.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ fileManifestOid: manifest.oid })
        })
      );
    });

    it('slows zip job polling down after the first ten polls', async () => {
      storage.getZipJob.mockResolvedValue(zipJob({ state: 'running' }));
      Object.assign(state.skillExport, { zipJobId: 'skill-export-ske_1', zipJobAttempts: 1 });
      let zipStartedAt = Date.now();

      await run({ manifestId: 'skdm_1', zipStartedAt, zipPolls: 9 });
      await run({ manifestId: 'skdm_1', zipStartedAt, zipPolls: 10 });

      expect(mocks.enqueueSkillExport.mock.calls).toEqual([
        [expect.objectContaining({ zipPolls: 10 }), { delay: 5000 }],
        [expect.objectContaining({ zipPolls: 11 }), { delay: 10_000 }]
      ]);
    });

    it('re-submits retryable failures with the same spec up to three attempts', async () => {
      Object.assign(state.skillExport, { zipJobId: 'skill-export-ske_1', zipJobAttempts: 1 });
      storage.getZipJob.mockResolvedValue(failedJob('lease_expired', true));
      storage.createZipJob.mockResolvedValue(failedJob('lease_expired', true));
      let poll = { manifestId: 'skdm_1', zipStartedAt: Date.now() };

      await run(poll);

      expect(storage.createZipJob).toHaveBeenCalledTimes(1);
      expect(storage.createZipJob).toHaveBeenCalledWith('skill-export-ske_1', spec, {
        waitSeconds: 20
      });
      expect(state.skillExport).toMatchObject({ status: 'pending', zipJobAttempts: 2 });
      expect(mocks.enqueueSkillExport).toHaveBeenCalledWith(
        { skillExportId: 'ske_1', ...poll, zipPolls: 1 },
        { delay: 5000 }
      );

      await run(poll);

      expect(storage.createZipJob).toHaveBeenCalledTimes(2);
      expect(state.skillExport).toMatchObject({ status: 'failed', zipJobAttempts: 3 });
    });

    it('fails a retryable job that already used all attempts', async () => {
      Object.assign(state.skillExport, { zipJobId: 'skill-export-ske_1', zipJobAttempts: 3 });
      storage.getZipJob.mockResolvedValue(failedJob('interrupted', true));

      await run({ manifestId: 'skdm_1', zipStartedAt: Date.now() });

      expect(storage.createZipJob).not.toHaveBeenCalled();
      expect(state.skillExport.status).toBe('failed');
    });

    it('re-submits when the zip service no longer knows the job', async () => {
      Object.assign(state.skillExport, { zipJobId: 'skill-export-ske_1', zipJobAttempts: 1 });
      storage.getZipJob.mockRejectedValue(
        Object.assign(new Error('gone'), { statusCode: 404 })
      );
      storage.createZipJob.mockResolvedValue(completedJob());

      await run({ manifestId: 'skdm_1', zipStartedAt: Date.now() });

      expect(storage.createZipJob).toHaveBeenCalledWith('skill-export-ske_1', spec, {
        waitSeconds: 20
      });
      expect(state.skillExport).toMatchObject({ status: 'completed', zipJobAttempts: 2 });
    });

    it('keeps polling through transient request errors', async () => {
      Object.assign(state.skillExport, { zipJobId: 'skill-export-ske_1', zipJobAttempts: 1 });
      storage.getZipJob.mockRejectedValue(
        Object.assign(new Error('unavailable'), { statusCode: 503 })
      );

      await run({ manifestId: 'skdm_1', zipStartedAt: Date.now() });

      expect(state.skillExport.status).toBe('pending');
      expect(mocks.enqueueSkillExport).toHaveBeenCalledWith(
        expect.objectContaining({ manifestId: 'skdm_1' }),
        { delay: 5000 }
      );
    });

    it('fails on a spec conflict', async () => {
      storage.createZipJob.mockRejectedValue(
        Object.assign(new Error('conflict'), { statusCode: 409 })
      );

      await expect(run()).rejects.toThrow('conflict');
      expect(state.skillExport.status).toBe('failed');
    });

    it('fails on permanent zip errors', async () => {
      storage.createZipJob.mockResolvedValue(failedJob('crc_mismatch', false));

      await run();

      expect(state.skillExport.status).toBe('failed');
      expect(mocks.enqueueSkillExport).not.toHaveBeenCalled();
    });

    it('cancels and fails a job that runs past the polling cap', async () => {
      Object.assign(state.skillExport, { zipJobId: 'skill-export-ske_1', zipJobAttempts: 1 });
      storage.cancelZipJob.mockResolvedValue(zipJob({ state: 'canceled' }));

      await run({ manifestId: 'skdm_1', zipStartedAt: Date.now() - 2 * 60 * 60 * 1000 - 1 });

      expect(storage.cancelZipJob).toHaveBeenCalledWith('skill-export-ske_1');
      expect(storage.getZipJob).not.toHaveBeenCalled();
      expect(state.skillExport.status).toBe('failed');
    });

    it('recovers missing sources once with a fresh job id', async () => {
      storage.createZipJob.mockResolvedValue(
        failedJob(
          'source_not_found',
          false,
          'sha256/aa was deleted while it was being archived'
        )
      );
      db.skillDestinationSync.findFirst.mockResolvedValueOnce({ oid: 6n });
      mocks.recoverMissingManifestSources.mockResolvedValue({
        status: 'started',
        sync: { id: 'skds_recovery', oid: 9n }
      });

      await run();

      expect(db.skillDestinationSync.findFirst).toHaveBeenCalledWith({
        where: { manifestOid: 7n },
        orderBy: { oid: 'desc' },
        select: { oid: true }
      });
      expect(mocks.findMissingSkillExportSources).toHaveBeenCalledWith({
        message: 'sha256/aa was deleted while it was being archived',
        manifest: expect.objectContaining({ oid: manifest.oid })
      });
      expect(mocks.recoverMissingManifestSources).toHaveBeenCalledWith({
        destinationOid: 1n,
        afterSyncOid: 6n,
        keys: ['sha256/aa']
      });
      expect(state.skillExport).toMatchObject({
        status: 'pending',
        zipJobId: 'skill-export-ske_1-retry',
        zipJobAttempts: 0
      });
      expect(mocks.enqueueSkillExport).toHaveBeenCalledWith(
        { skillExportId: 'ske_1', skillDestinationSyncId: 'skds_recovery', syncWaits: 1 },
        { delay: 5000 }
      );

      db.skillDestinationSync.findFirst.mockResolvedValue({
        id: 'skds_recovery',
        oid: 2n,
        status: 'processing',
        manifest: { ...manifest, oid: 8n, id: 'skdm_2' }
      });

      await run({ skillDestinationSyncId: 'skds_recovery' });

      expect(storage.createZipJob).toHaveBeenLastCalledWith('skill-export-ske_1-retry', spec, {
        waitSeconds: 20
      });
      expect(mocks.recoverMissingManifestSources).toHaveBeenCalledTimes(1);
      expect(state.skillExport.status).toBe('failed');
    });

    it('waits for a recovery another caller already started', async () => {
      storage.createZipJob.mockResolvedValue(failedJob('source_not_found', false, 'gone'));
      mocks.recoverMissingManifestSources.mockResolvedValue({
        status: 'already_started',
        sync: { id: 'skds_other', oid: 9n }
      });

      await run();

      expect(mocks.recoverMissingManifestSources).toHaveBeenCalledWith(
        expect.objectContaining({ keys: undefined })
      );
      expect(mocks.enqueueSkillExport).toHaveBeenCalledWith(
        { skillExportId: 'ske_1', skillDestinationSyncId: 'skds_other', syncWaits: 1 },
        { delay: 5000 }
      );
      expect(state.skillExport.status).toBe('pending');
    });

    it('fails once the shared recovery limit is reached', async () => {
      storage.createZipJob.mockResolvedValue(
        failedJob('source_not_found', false, 'sha256/aa is missing')
      );
      mocks.recoverMissingManifestSources.mockResolvedValue({ status: 'limit_reached' });

      await run();

      expect(state.skillExport.status).toBe('failed');
      expect(mocks.enqueueSkillExport).not.toHaveBeenCalled();
    });

    it('deletes the unreferenced archive of an export that fails after its zip job', async () => {
      storage.createZipJob.mockResolvedValue(failedJob('archive_too_large', false));

      await run();

      expect(state.skillExport.status).toBe('failed');
      expect(mocks.deleteCargoObjectIfUnreferenced).toHaveBeenCalledWith({
        bucket: 'cargo-files',
        key: 'skill-exports/ske_1.zip'
      });
    });

    it('deletes the archive when recording the completed archive fails', async () => {
      storage.createZipJob.mockResolvedValue(completedJob());
      mocks.fileService.completePendingUploadForStream.mockRejectedValue(new Error('db down'));

      await expect(run()).rejects.toThrow('db down');

      expect(state.skillExport.status).toBe('failed');
      expect(mocks.deleteCargoObjectIfUnreferenced).toHaveBeenCalledWith({
        bucket: 'cargo-files',
        key: 'skill-exports/ske_1.zip'
      });
    });

    it('still fails the export when the archive cannot be deleted', async () => {
      let warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      storage.createZipJob.mockResolvedValue(failedJob('archive_too_large', false));
      mocks.deleteCargoObjectIfUnreferenced.mockRejectedValue(new Error('storage down'));

      await run();

      expect(state.skillExport.status).toBe('failed');
      warn.mockRestore();
    });

    it('does not touch archives of exports that never submitted a zip job', async () => {
      state.destination.isDirty = true;
      db.skillDestinationSync.findFirst.mockResolvedValue({
        id: 'skds_1',
        oid: 2n,
        status: 'failed',
        manifest: null
      });

      await run({ skillDestinationSyncId: 'skds_1' });

      expect(state.skillExport.status).toBe('failed');
      expect(mocks.deleteCargoObjectIfUnreferenced).not.toHaveBeenCalled();
    });
  });

  describe('code-bucket destinations', () => {
    beforeEach(() => {
      Object.assign(state.destination, {
        storageMode: 'code_bucket',
        codeBucketId: 'ocb_1',
        currentManifestOid: null,
        currentManifest: null
      });
    });

    it('exports the code bucket through a pending upload', async () => {
      mocks.fileService.createPendingUploadForStream.mockResolvedValue({
        storeId: 'store_1',
        destination: { type: 'internal', bucket: 'cargo-files', key: 'store_1' }
      });

      await run();

      expect(mocks.codeBucketClient.exportBucketFilesAsZipToUpload).toHaveBeenCalledWith({
        bucketId: 'ocb_1',
        prefix: '',
        uploadUrl: '',
        uploadHeaders: {},
        uploadBucket: 'cargo-files',
        uploadKey: 'store_1',
        contentType: 'application/zip'
      });
      expect(mocks.fileService.completePendingUploadForStream).toHaveBeenCalledWith(
        expect.objectContaining({ storeId: 'store_1' })
      );
      expect(db.skillExportRef.update).toHaveBeenCalledWith({
        where: { oid: 10n },
        data: { fileOid: 40n, fileReferenceOid: 42n, fileLinkOid: 41n, fileDestinationTag: 3 }
      });
      expect(storage.createZipJob).not.toHaveBeenCalled();
      expect(state.skillExport).toMatchObject({ status: 'completed', zipJobId: null });
    });

    it('reuses by destination tag', async () => {
      state.skillExport.exportRef = createRef({ ...reusableFile, fileDestinationTag: 3 });

      await run();

      expect(state.skillExport).toMatchObject({ status: 'completed', fileOid: 30n });
      expect(mocks.codeBucketClient.exportBucketFilesAsZipToUpload).not.toHaveBeenCalled();
    });

    it('still requires the forced sync to complete', async () => {
      db.skillDestinationSync.findFirst.mockResolvedValue({
        id: 'skds_1',
        status: 'waiting_for_review'
      });

      await run({ skillDestinationSyncId: 'skds_1' });

      expect(state.skillExport.status).toBe('failed');
      expect(mocks.codeBucketClient.exportBucketFilesAsZipToUpload).not.toHaveBeenCalled();
    });
  });
});

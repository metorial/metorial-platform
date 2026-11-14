import { gunzipSync } from 'node:zlib';
import { cleanDatabase, testDb } from '@mtsrc/agent-tracking-db/test/setup';
import { SUMMARY_VERSION } from '@mtsrc/agent-tracking-layers';
import { createTestScope } from '@mtsrc/agent-tracking-module-scope/test/scope';
import { getStore, type SessionDocument } from '@mtsrc/agent-tracking-store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { reconcileExports } from '../src/cron/exportReconcile';
import { setExportStore } from '../src/lib/exportStore';
import { type ExportRunOptions, runExportChunk } from '../src/lib/exportRun';
import { exportChunkQueue } from '../src/queues/exportChunk';
import { queryExportService } from '../src/services/queryExport';
import { createMemoryExportStore } from './memoryStore';

let day = 24 * 60 * 60_000;

let base = new Date(Date.now() - 6 * 60 * 60_000);

let range = {
  from: new Date(base.getTime() - 60 * 60_000).toISOString(),
  to: new Date(base.getTime() + 3 * 60 * 60_000).toISOString()
};

let rowsQuery = (query: Record<string, unknown> = {}) => ({
  atq: '0',
  dataset: 'sessions',
  mode: 'rows',
  range,
  select: ['session', 'startedAt', 'client.family'],
  ...query
});

let setup = async (sessionCount: number) => {
  let scope = await createTestScope();
  let store = getStore();
  await store.ready();

  let keys: string[] = [];
  let documents = Array.from({ length: sessionCount }, (_, index) => {
    let key = crypto.randomUUID().replace(/-/g, '');
    let startedAt = new Date(base.getTime() + Math.floor(index / 2) * 60_000);
    keys.push(key);

    return {
      _id: key,
      organizationId: scope.organization.id,
      projectId: scope.project.id,
      instanceId: scope.instance.id,
      origin: 'native',
      versions: { summary: SUMMARY_VERSION, attribution: 0, facts: 0 },
      client: { family: index % 2 ? 'cursor' : 'claude-code' },
      rootSessionKey: key,
      lastActivityAt: startedAt,
      lastObservedAt: startedAt,
      state: 'ended',
      expiresAt: new Date(startedAt.getTime() + 400 * day),
      startedAt,
      observed: { clientUserIds: [], clientInstallationIds: [] },
      context: { workspaceIds: [], repoIds: [], ticketRefs: [], tags: [], pathStored: false }
    } satisfies SessionDocument;
  });
  if (documents.length) await store.collections().sessions.insertMany(documents);

  return { ...scope, keys };
};

let createExport = (
  organization: Awaited<ReturnType<typeof setup>>['organization'],
  query: Record<string, unknown> = {},
  format: 'csv' | 'ndjson' = 'csv'
) => queryExportService.createQueryExport({ organization, query: rowsQuery(query), format });

let runToEnd = async (options: ExportRunOptions) => {
  let outcomes: string[] = [];

  for (let run = 0; run < 100; run++) {
    let outcome = await runExportChunk(options);
    outcomes.push(outcome);
    if (outcome != 'yield') return outcomes;
  }

  throw new Error('The export never finished.');
};

let csvLines = (object: Buffer) =>
  gunzipSync(object)
    .toString('utf8')
    .split('\r\n')
    .filter(line => line.length);

let errorOf = async (run: Promise<unknown>) => {
  try {
    await run;
  } catch (error) {
    return (error as { data: { code: string; status: number } }).data;
  }
  throw new Error('Expected the call to fail.');
};

describe('query exports', () => {
  let memory: ReturnType<typeof createMemoryExportStore>;
  let enqueued: string[];

  beforeEach(async () => {
    await cleanDatabase();
    vi.restoreAllMocks();

    memory = createMemoryExportStore();
    setExportStore(memory.store);

    enqueued = [];
    vi.spyOn(exportChunkQueue, 'add').mockImplementation((async (job: {
      exportId: string;
    }) => {
      enqueued.push(job.exportId);
    }) as never);
    vi.spyOn(exportChunkQueue, 'addMany').mockImplementation((async (
      jobs: { exportId: string }[]
    ) => {
      enqueued.push(...jobs.map(job => job.exportId));
    }) as never);
  });

  afterEach(() => {
    setExportStore(undefined);
  });

  it('writes every row exactly once across many parts and yields', async () => {
    let { organization, keys } = await setup(23);
    let created = await createExport(organization);

    expect(created.status).toBe('queued');
    expect(enqueued).toEqual([created.id]);

    let outcomes = await runToEnd({
      exportId: created.id,
      store: memory.store,
      pageSize: 4,
      partBytes: 1,
      yieldMs: 0
    });

    expect(outcomes.at(-1)).toBe('completed');
    expect(outcomes.filter(outcome => outcome == 'yield').length).toBeGreaterThan(3);

    let record = await testDb.queryExport.findUniqueOrThrow({ where: { id: created.id } });
    expect(record.status).toBe('completed');
    expect(record.uploadId).toBeNull();
    expect(Number(record.rows)).toBe(23);
    expect(record.parts.length).toBe(6);
    expect(record.expiresAt!.getTime()).toBeGreaterThan(Date.now() + 6 * day);

    let lines = csvLines(memory.objects.get(record.objectKey)!);
    expect(lines[0]).toBe('session,startedAt,client.family');
    expect(lines.filter(line => line.startsWith('session,')).length).toBe(1);

    let sessions = lines.slice(1).map(line => line.split(',')[0]);
    expect(sessions.length).toBe(23);
    expect(new Set(sessions)).toEqual(new Set(keys));

    let startedAts = lines.slice(1).map(line => line.split(',')[1]!);
    expect([...startedAts].sort()).toEqual(startedAts);

    let fetched = await queryExportService.getQueryExport({
      organization,
      exportId: created.id
    });
    expect(fetched.download?.url).toContain(record.objectKey);
    expect(fetched.rows).toBe(23);
    expect(memory.uploads.size).toBe(0);
  });

  it('writes newline-delimited JSON', async () => {
    let { organization, keys } = await setup(5);
    let created = await createExport(organization, {}, 'ndjson');

    await runToEnd({
      exportId: created.id,
      store: memory.store,
      pageSize: 2,
      partBytes: 1,
      yieldMs: 0
    });

    let record = await testDb.queryExport.findUniqueOrThrow({ where: { id: created.id } });
    expect(record.objectKey).toMatch(/\.ndjson\.gz$/);

    let rows = gunzipSync(memory.objects.get(record.objectKey)!)
      .toString('utf8')
      .trim()
      .split('\n')
      .map(line => JSON.parse(line));
    expect(rows.map(row => row.session).sort()).toEqual([...keys].sort());
    expect(rows[0]).toHaveProperty(['client.family']);
  });

  it('completes an export without rows', async () => {
    let { organization } = await setup(0);
    let created = await createExport(organization);

    expect(await runToEnd({ exportId: created.id, store: memory.store })).toEqual([
      'completed'
    ]);

    let record = await testDb.queryExport.findUniqueOrThrow({ where: { id: created.id } });
    expect(csvLines(memory.objects.get(record.objectKey)!)).toEqual([
      'session,startedAt,client.family'
    ]);
  });

  it('resumes after a worker dies between uploading a part and recording it', async () => {
    let { organization, keys } = await setup(12);
    let created = await createExport(organization);
    let crashed = false;

    let options: ExportRunOptions = {
      exportId: created.id,
      store: memory.store,
      pageSize: 3,
      partBytes: 1,
      yieldMs: 60_000,
      onStep: (step, d) => {
        if (step == 'partUploaded' && d.part == 2 && !crashed) {
          crashed = true;
          throw new Error('worker died');
        }
      }
    };

    await expect(runExportChunk(options)).rejects.toThrow('worker died');

    let interrupted = await testDb.queryExport.findUniqueOrThrow({
      where: { id: created.id }
    });
    expect(interrupted.parts.length).toBe(1);
    expect(interrupted.leaseOwner).toBeNull();

    expect(await runToEnd(options)).toEqual(['completed']);

    let record = await testDb.queryExport.findUniqueOrThrow({ where: { id: created.id } });
    let sessions = csvLines(memory.objects.get(record.objectKey)!)
      .slice(1)
      .map(line => line.split(',')[0]);
    expect(sessions.length).toBe(12);
    expect(new Set(sessions)).toEqual(new Set(keys));
  });

  it('aborts the upload a worker started but never recorded', async () => {
    let { organization } = await setup(4);
    let created = await createExport(organization);
    let crashed = false;

    let options: ExportRunOptions = {
      exportId: created.id,
      store: memory.store,
      onStep: step => {
        if (step == 'uploadStarted' && !crashed) {
          crashed = true;
          throw new Error('worker died');
        }
      }
    };

    await expect(runExportChunk(options)).rejects.toThrow('worker died');
    expect(await runToEnd(options)).toEqual(['completed']);
    expect(memory.uploads.size).toBe(1);

    let soon = await reconcileExports(memory.store, new Date(Date.now() + 60 * 60_000));
    expect(soon.orphans).toBe(0);

    let later = await reconcileExports(memory.store, new Date(Date.now() + 25 * 60 * 60_000));
    expect(later.orphans).toBe(1);
    expect(memory.uploads.size).toBe(0);
  });

  it('stops writing when another worker took over the lease', async () => {
    let { organization } = await setup(6);
    let created = await createExport(organization);

    let outcome = await runExportChunk({
      exportId: created.id,
      store: memory.store,
      pageSize: 2,
      partBytes: 1,
      onStep: async step => {
        if (step != 'partUploaded') return;
        await testDb.queryExport.update({
          where: { id: created.id },
          data: { leaseOwner: 'other', leaseExpiresAt: new Date(Date.now() + 60_000) }
        });
      }
    });
    expect(outcome).toBe('lost');

    let record = await testDb.queryExport.findUniqueOrThrow({ where: { id: created.id } });
    expect(record.parts.length).toBe(0);
    expect(Number(record.rows)).toBe(0);

    expect(await runExportChunk({ exportId: created.id, store: memory.store })).toBe('busy');
  });

  it('cancels a running export and cleans up its upload', async () => {
    let { organization } = await setup(10);
    let created = await createExport(organization);

    expect(
      await runExportChunk({
        exportId: created.id,
        store: memory.store,
        pageSize: 2,
        partBytes: 1,
        yieldMs: 0
      })
    ).toBe('yield');
    expect(memory.uploads.size).toBe(1);

    let cancelled = await queryExportService.cancelQueryExport({
      organization,
      exportId: created.id
    });
    expect(cancelled.status).toBe('cancelled');
    expect(await runExportChunk({ exportId: created.id, store: memory.store })).toBe('busy');

    let reconciled = await reconcileExports(memory.store);
    expect(reconciled.cleaned).toBe(1);
    expect(memory.uploads.size).toBe(0);

    let record = await testDb.queryExport.findUniqueOrThrow({ where: { id: created.id } });
    expect(record.uploadId).toBeNull();
    expect(record.status).toBe('cancelled');
  });

  it('fails exports over the row limit and drops their upload', async () => {
    let { organization } = await setup(10);
    let created = await createExport(organization);

    expect(
      await runToEnd({
        exportId: created.id,
        store: memory.store,
        pageSize: 2,
        partBytes: 1,
        yieldMs: 0,
        maxRows: 5
      })
    ).toContain('failed');

    let record = await testDb.queryExport.findUniqueOrThrow({ where: { id: created.id } });
    expect(record.status).toBe('failed');
    expect(record.error).toContain('limit');
    expect(record.uploadId).toBeNull();
    expect(memory.uploads.size).toBe(0);
    expect(memory.aborted.length).toBe(1);
  });

  it('fails exports that keep crashing without progress', async () => {
    let { organization } = await setup(2);
    let created = await createExport(organization);
    await testDb.queryExport.update({ where: { id: created.id }, data: { attempts: 5 } });

    expect(await runExportChunk({ exportId: created.id, store: memory.store })).toBe('failed');

    let record = await testDb.queryExport.findUniqueOrThrow({ where: { id: created.id } });
    expect(record.status).toBe('failed');
    expect(record.error).toContain('no progress');
  });

  it('requeues exports whose worker went away', async () => {
    let { organization } = await setup(2);
    let created = await createExport(organization);
    await testDb.queryExport.update({
      where: { id: created.id },
      data: {
        status: 'running',
        leaseOwner: 'gone',
        leaseExpiresAt: new Date(Date.now() - 1000)
      }
    });
    enqueued = [];

    let reconciled = await reconcileExports(memory.store);
    expect(reconciled.requeued).toBeGreaterThanOrEqual(1);
    expect(enqueued).toContain(created.id);

    expect(await runToEnd({ exportId: created.id, store: memory.store })).toEqual([
      'completed'
    ]);
  });

  it('expires and deletes completed exports after their retention', async () => {
    let { organization } = await setup(2);
    let created = await createExport(organization);
    await runToEnd({ exportId: created.id, store: memory.store });

    let record = await testDb.queryExport.findUniqueOrThrow({ where: { id: created.id } });
    expect(memory.objects.has(record.objectKey)).toBe(true);

    let reconciled = await reconcileExports(memory.store, new Date(Date.now() + 8 * day));
    expect(reconciled.expired).toBe(1);
    expect(memory.objects.has(record.objectKey)).toBe(false);

    let fetched = await queryExportService.getQueryExport({
      organization,
      exportId: created.id
    });
    expect(fetched.status).toBe('expired');
    expect(fetched.download).toBeNull();
  });

  it('expires only the exports that selected personal fields when a user is erased', async () => {
    let { organization } = await setup(3);
    let personal = await createExport(organization);
    let anonymous = await createExport(organization, {
      select: ['startedAt', 'client.family']
    });
    let running = await createExport(organization);

    await runToEnd({ exportId: personal.id, store: memory.store });
    await runToEnd({ exportId: anonymous.id, store: memory.store });

    await queryExportService.expirePersonalExports({ organizationId: organization.id });
    await reconcileExports(memory.store, new Date(Date.now() + 1000));

    let records = new Map(
      (
        await testDb.queryExport.findMany({
          where: { id: { in: [personal.id, anonymous.id, running.id] } }
        })
      ).map(record => [record.id, record])
    );
    expect(records.get(personal.id)!.status).toBe('expired');
    expect(records.get(anonymous.id)!.status).toBe('completed');
    expect(records.get(running.id)!.status).toBe('cancelled');
    expect(memory.objects.has(records.get(personal.id)!.objectKey)).toBe(false);
    expect(memory.objects.has(records.get(anonymous.id)!.objectKey)).toBe(true);
  });

  describe('validation', () => {
    it('only exports rows-mode queries without a sort or cursor', async () => {
      let { organization } = await setup(0);

      let aggregate = await errorOf(
        queryExportService.createQueryExport({
          organization,
          query: { atq: '0', dataset: 'usage', range, measures: ['cost.usd'] },
          format: 'csv'
        })
      );
      expect(aggregate.code).toBe('invalid_query');

      let sorted = await errorOf(
        createExport(organization, { orderBy: [{ field: 'startedAt', direction: 'desc' }] })
      );
      expect(sorted.code).toBe('invalid_query');
    });

    it('refuses exports when the organization hides individuals', async () => {
      let { organization } = await setup(0);
      let hidden = await testDb.organization.update({
        where: { oid: organization.oid },
        data: {
          settings: {
            ...(organization.settings as object),
            privacy: { hideIndividuals: true }
          } as never
        }
      });

      expect((await errorOf(createExport(hidden))).code).toBe('invalid_query');
    });

    it('refuses exports without object storage', async () => {
      let { organization } = await setup(0);
      setExportStore(null);

      expect((await errorOf(createExport(organization))).code).toBe('exports_unavailable');
    });

    it('limits how many exports run at once', async () => {
      let { organization } = await setup(0);
      for (let index = 0; index < 3; index++) await createExport(organization);

      expect((await errorOf(createExport(organization))).status).toBe(429);
    });

    it('keeps exports inside their organization', async () => {
      let first = await setup(1);
      let second = await setup(1);
      let created = await createExport(first.organization);

      let lookup = { organization: second.organization, exportId: created.id };
      expect((await errorOf(queryExportService.getQueryExport(lookup))).code).toBe(
        'not_found'
      );
      expect((await errorOf(queryExportService.cancelQueryExport(lookup))).code).toBe(
        'not_found'
      );

      let listed = await queryExportService.listQueryExports({
        organization: second.organization
      });
      expect(listed.items).toEqual([]);

      await runToEnd({ exportId: created.id, store: memory.store });
      let record = await testDb.queryExport.findUniqueOrThrow({ where: { id: created.id } });
      let sessions = csvLines(memory.objects.get(record.objectKey)!).slice(1);
      expect(sessions.map(line => line.split(',')[0])).toEqual(first.keys);
      expect(record.objectKey).toContain(first.organization.id);
    });
  });
});

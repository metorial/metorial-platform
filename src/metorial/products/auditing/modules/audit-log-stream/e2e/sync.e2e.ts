import { db, ID } from '@metorial/db';
import { eventually, expectServiceError, uniqueId, useOrganization } from '@metorial/e2e';
import { loadOrganizationFixture } from '@metorial/e2e/db';
import { afterAll, describe, expect, it } from 'vitest';
import {
  auditLogStreamService,
  markAuditLogOrganizationDirty,
  scavengeDirtyAuditLogOrganizationsQueue
} from '../src';
import {
  AUDIT_LOG_STREAM_MAX_CONSECUTIVE_ERRORS,
  auditLogStreamSyncService
} from '../src/internal/auditLogStreamSync';
import {
  createAuditLogRow,
  createUnvalidatedSplunkStream,
  listStreamEvents,
  triggerCron,
  useRecordingServer
} from './_fixtures';

let DAY_MS = 24 * 60 * 60 * 1000;

let syncOnce = async (auditLogStreamId: string, runId?: string) => {
  let id = runId ?? (await ID.generateId('auditLogStreamRun'));
  let result = await auditLogStreamSyncService.syncBatch({
    auditLogStreamId,
    runId: id,
    batchIdentifier: await ID.generateId('auditLogStreamBatch'),
    batchNumber: 1,
    successfulBatchCount: 0
  });

  return { runId: id, result };
};

describe('module-audit-log-stream sync', () => {
  let org = useOrganization();
  let recorder = useRecordingServer();
  let streamIds: string[] = [];

  let createLoopbackStream = async (status: 'active' | 'inactive' = 'active') => {
    await db.auditLogStream.updateMany({
      where: { id: { in: streamIds } },
      data: { status: 'inactive' }
    });

    let fixture = await loadOrganizationFixture(org.ids);
    let token = uniqueId('splunk-token');
    let stream = await createUnvalidatedSplunkStream(fixture, {
      endpoint: recorder.url,
      token,
      status
    });
    streamIds.push(stream.id);

    await createAuditLogRow(fixture);

    return { fixture, stream, token };
  };

  afterAll(async () => {
    await db.auditLogStream.deleteMany({ where: { id: { in: streamIds } } });
  });

  it('never delivers to a loopback destination, even when stored data skipped validation', async () => {
    let { stream, token } = await createLoopbackStream();

    let { runId, result } = await syncOnce(stream.id);

    expect(result).toEqual({
      status: 'error',
      recordsSynced: 0,
      successfulBatchCount: 0,
      shouldContinue: false
    });
    expect(recorder.requests).toEqual([]);

    let run = await db.auditLogStreamRun.findUniqueOrThrow({ where: { id: runId } });
    expect(run).toMatchObject({ status: 'error', recordsSynced: 0, batchNumber: 1 });
    expect(run.errorMessage).toContain('Private or internal IP blocked');
    expect(run.completedAt).not.toBeNull();

    let row = await db.auditLogStream.findUniqueOrThrow({ where: { id: stream.id } });
    expect(row).toMatchObject({
      accessStatus: 'error',
      isStarted: true,
      isPausedDueToError: false
    });
    expect(row.consecutiveErrorCount).toBeGreaterThanOrEqual(1);
    expect(row.errorMessage).toContain('Private or internal IP blocked');

    let events = await listStreamEvents(stream.oid);
    expect(events.filter(event => event.type == 'started')).toHaveLength(1);
    let errorEvent = events.find(event => event.type == 'error');
    expect(errorEvent?.message).toContain('Private or internal IP blocked');
    expect(errorEvent?.errorDetails).toMatchObject({
      provider: 'splunk',
      code: 'unknown_error',
      errorName: 'SsrfBlockedError',
      httpStatusCode: null,
      responseBody: null,
      batchNumber: 1
    });
    expect((errorEvent?.errorDetails as any).eventCount).toBeGreaterThanOrEqual(1);

    let recorded = JSON.stringify(
      { run, events, errorMessage: row.errorMessage },
      (_, value) => (typeof value == 'bigint' ? value.toString() : value)
    );
    expect(recorded).not.toContain(token);
  });

  it('blocks the loopback destination in the worker too when a dirty organization syncs', async () => {
    let { fixture, stream } = await createLoopbackStream();

    await markAuditLogOrganizationDirty(fixture.organization.oid);
    await scavengeDirtyAuditLogOrganizationsQueue.add(
      {},
      { id: uniqueId('e2e-audit-stream-scavenge') }
    );

    let run = await eventually(
      async () => {
        let run = await db.auditLogStreamRun.findFirst({
          where: { auditLogStreamOid: stream.oid, status: 'error' }
        });
        expect(run).not.toBeNull();
        return run!;
      },
      { timeoutMs: 60_000, intervalMs: 1_000 }
    );

    expect(run.errorMessage).toContain('Private or internal IP blocked');
    expect(recorder.requests).toEqual([]);
  }, 90_000);

  it('recovers after a failed batch and replays finished runs without side effects', async () => {
    let { stream } = await createLoopbackStream();

    let failed = await syncOnce(stream.id);
    expect(failed.result.status).toBe('error');

    await db.auditLogStream.update({
      where: { id: stream.id },
      data: { lastAuditLogOid: 2n ** 62n }
    });

    let recovered = await syncOnce(stream.id);
    expect(recovered.result).toEqual({
      status: 'success',
      recordsSynced: 0,
      successfulBatchCount: 1,
      shouldContinue: false
    });

    let row = await db.auditLogStream.findUniqueOrThrow({ where: { id: stream.id } });
    expect(row).toMatchObject({
      accessStatus: 'ok',
      errorMessage: null,
      consecutiveErrorCount: 0,
      isPausedDueToError: false,
      lastAuditLogOid: 2n ** 62n
    });

    let events = await listStreamEvents(stream.oid);
    let recoveredEvents = events.filter(event => event.type == 'recovered');
    expect(recoveredEvents.length).toBeGreaterThanOrEqual(1);
    expect(recoveredEvents[0]!.oid).toBeGreaterThan(
      events.find(event => event.type == 'error')!.oid
    );

    let runCount = await db.auditLogStreamRun.count({
      where: { auditLogStreamOid: stream.oid }
    });

    let replayedSuccess = await syncOnce(stream.id, recovered.runId);
    expect(replayedSuccess.result).toEqual(recovered.result);

    let replayedError = await syncOnce(stream.id, failed.runId);
    expect(replayedError.result).toEqual({
      status: 'error',
      recordsSynced: 0,
      successfulBatchCount: 0,
      shouldContinue: false
    });

    expect(
      await db.auditLogStreamRun.count({ where: { auditLogStreamOid: stream.oid } })
    ).toBe(runCount);
    expect(await listStreamEvents(stream.oid)).toHaveLength(events.length);
    expect(recorder.requests).toEqual([]);
  });

  it('pauses a stream after too many consecutive errors until it is resumed', async () => {
    let { fixture, stream } = await createLoopbackStream();
    await db.auditLogStream.update({
      where: { id: stream.id },
      data: {
        accessStatus: 'error',
        consecutiveErrorCount: AUDIT_LOG_STREAM_MAX_CONSECUTIVE_ERRORS - 1
      }
    });

    let paused = await syncOnce(stream.id);
    expect(paused.result.status).toBe('error');

    let row = await db.auditLogStream.findUniqueOrThrow({ where: { id: stream.id } });
    expect(row).toMatchObject({
      isPausedDueToError: true,
      consecutiveErrorCount: AUDIT_LOG_STREAM_MAX_CONSECUTIVE_ERRORS,
      status: 'active'
    });

    let events = await listStreamEvents(stream.oid);
    expect(events.map(event => event.type)).toContain('error_paused');
    expect(events.map(event => event.type)).not.toContain('error');
    expect(events.find(event => event.type == 'error_paused')!.errorDetails).toMatchObject({
      provider: 'splunk',
      code: 'unknown_error'
    });

    let skipped = await syncOnce(stream.id);
    expect(skipped.result.status).toBe('skipped');
    expect(await db.auditLogStreamRun.findUnique({ where: { id: skipped.runId } })).toBeNull();

    let resumed = await auditLogStreamService.resumeAuditLogStream({
      organization: fixture.organization,
      auditLogStream: row,
      auditScope: fixture.auditScope
    });
    expect(resumed).toMatchObject({ isPausedDueToError: false, consecutiveErrorCount: 0 });
    expect(
      await db.auditLogDirtyTracker.findUnique({
        where: { organizationOid: fixture.organization.oid }
      })
    ).not.toBeNull();

    await expectServiceError(
      auditLogStreamService.resumeAuditLogStream({
        organization: fixture.organization,
        auditLogStream: resumed,
        auditScope: fixture.auditScope
      }),
      'bad_request'
    );
    expect(recorder.requests).toEqual([]);
  });

  it('skips inactive and unknown streams without recording a run', async () => {
    let { stream } = await createLoopbackStream('inactive');

    let inactive = await syncOnce(stream.id);
    let unknown = await syncOnce(uniqueId('als_missing'));

    expect(inactive.result).toEqual({
      status: 'skipped',
      recordsSynced: 0,
      successfulBatchCount: 0,
      shouldContinue: false
    });
    expect(unknown.result.status).toBe('skipped');
    expect(
      await db.auditLogStreamRun.count({ where: { auditLogStreamOid: stream.oid } })
    ).toBe(0);

    let row = await db.auditLogStream.findUniqueOrThrow({ where: { id: stream.id } });
    expect(row).toMatchObject({ isStarted: false, accessStatus: 'ok' });
  });

  it('cleans up finished runs after a day and failed runs after two weeks', async () => {
    let { stream } = await createLoopbackStream('inactive');
    let createRun = async (status: 'running' | 'success' | 'error', ageMs: number) =>
      await db.auditLogStreamRun.create({
        data: {
          id: await ID.generateId('auditLogStreamRun'),
          status,
          batchIdentifier: uniqueId('e2e-batch'),
          batchNumber: 1,
          successfulBatchCount: 0,
          recordsSynced: 0,
          auditLogStreamOid: stream.oid,
          createdAt: new Date(Date.now() - ageMs)
        }
      });

    let expired = [
      await createRun('success', 2 * DAY_MS),
      await createRun('running', 2 * DAY_MS),
      await createRun('error', 15 * DAY_MS)
    ];
    let kept = [
      await createRun('success', 60 * 60 * 1000),
      await createRun('error', 3 * DAY_MS)
    ];

    await triggerCron('audit/stream/run/cleanup');

    await eventually(
      async () =>
        expect(
          await db.auditLogStreamRun.count({
            where: { id: { in: expired.map(run => run.id) } }
          })
        ).toBe(0),
      { timeoutMs: 60_000, intervalMs: 1_000 }
    );
    expect(
      await db.auditLogStreamRun.count({ where: { id: { in: kept.map(run => run.id) } } })
    ).toBe(kept.length);
  }, 90_000);
});

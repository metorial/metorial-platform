import { randomBytes } from 'node:crypto';
import { isServiceError } from '@lowerdeck/error';
import { db, type QueryExport } from '@mtsrc/agent-tracking-db';
import { exportColumnsOf, type ExportFormat, gzipMember, serializeRows } from './exportFormat';
import { exportSortOf, parseRowsCursor, type RowsCursor, serializeRowsCursor } from './rows';
import { queryService } from '../services/query';
import { type ExportStore, ExportUploadNotFoundError } from './exportStore';

export let exportLeaseMs = 2 * 60_000;
export let exportPageSize = 5000;
export let exportPartBytes = 16 * 1024 * 1024;
export let exportYieldMs = 60_000;
export let exportMaxRows = 10_000_000;
export let exportMaxBytes = 5 * 1024 * 1024 * 1024;
export let exportMaxAttempts = 5;
export let exportRetentionMs = 7 * 24 * 60 * 60_000;

export type ExportRunOutcome = 'busy' | 'yield' | 'completed' | 'failed' | 'lost';

export type ExportRunOptions = {
  exportId: string;
  store: ExportStore;
  pageSize?: number;
  partBytes?: number;
  yieldMs?: number;
  maxRows?: number;
  // Test hook: throwing here simulates a worker dying between a step and its checkpoint.
  onStep?: (
    step: 'uploadStarted' | 'partUploaded',
    d: { part?: number }
  ) => Promise<void> | void;
};

let activeStatuses = ['queued', 'running'] as const;

let claim = async (exportId: string, owner: string, now: Date) =>
  (
    await db.queryExport.updateMany({
      where: {
        id: exportId,
        status: { in: [...activeStatuses] },
        OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: now } }]
      },
      data: {
        status: 'running',
        leaseOwner: owner,
        leaseExpiresAt: new Date(now.getTime() + exportLeaseMs),
        attempts: { increment: 1 }
      }
    })
  ).count == 1;

let guarded = (exportId: string, owner: string) => ({
  id: exportId,
  leaseOwner: owner,
  status: 'running' as const
});

let release = async (exportId: string, owner: string) => {
  await db.queryExport.updateMany({
    where: { id: exportId, leaseOwner: owner },
    data: { leaseOwner: null, leaseExpiresAt: null }
  });
};

let fail = async (record: QueryExport, owner: string, error: string, store: ExportStore) => {
  let failed = await db.queryExport.updateMany({
    where: guarded(record.id, owner),
    data: { status: 'failed', error, leaseOwner: null, leaseExpiresAt: null }
  });
  if (!failed.count || !record.uploadId) return;

  await store.abort(record.objectKey, record.uploadId).catch(() => {});
  await db.queryExport.updateMany({
    where: { id: record.id, status: 'failed' },
    data: { uploadId: null }
  });
};

let errorMessageOf = (error: unknown) => {
  if (isServiceError(error)) return error.data.message;
  return error instanceof Error ? error.message : String(error);
};

// Reads the export's rows from its checkpoint, part by part, into one durable multipart upload.
// Every write to the export row is guarded by the lease, so a worker that lost it changes nothing.
export let runExportChunk = async (options: ExportRunOptions): Promise<ExportRunOutcome> => {
  let owner = randomBytes(12).toString('hex');
  let started = Date.now();
  if (!(await claim(options.exportId, owner, new Date()))) return 'busy';

  try {
    return await runClaimed(options, owner, started);
  } catch (error) {
    await release(options.exportId, owner);
    throw error;
  }
};

let runClaimed = async (
  options: ExportRunOptions,
  owner: string,
  started: number
): Promise<ExportRunOutcome> => {
  let { store } = options;
  let pageSize = options.pageSize ?? exportPageSize;
  let partBytes = options.partBytes ?? exportPartBytes;
  let maxRows = options.maxRows ?? exportMaxRows;

  let record = await db.queryExport.findUniqueOrThrow({
    where: { id: options.exportId },
    include: { organization: true }
  });

  if (record.attempts > exportMaxAttempts) {
    await fail(
      record,
      owner,
      `The export made no progress in ${exportMaxAttempts} attempts.`,
      store
    );
    return 'failed';
  }

  let prepared;
  try {
    prepared = await queryService.prepare({
      organization: record.organization,
      scope: { projectIds: record.scope.projectIds, instanceIds: record.scope.instanceIds },
      query: record.query,
      now: record.asOf
    });
  } catch (error) {
    if (!isServiceError(error)) throw error;
    await fail(record, owner, errorMessageOf(error), store);
    return 'failed';
  }

  let bound = prepared.bound;
  if (bound.range.to > record.asOf) bound.range = { ...bound.range, to: record.asOf };

  let format = record.format as ExportFormat;
  let columns = exportColumnsOf(bound.select, bound.labels);
  let sort = exportSortOf(bound);

  let uploadId = record.uploadId;
  if (!uploadId) {
    uploadId = await store.start(record.objectKey, {
      contentType: format == 'csv' ? 'text/csv' : 'application/x-ndjson',
      metadata: {
        'export-id': record.id,
        format,
        'as-of': record.asOf.toISOString(),
        query: JSON.stringify(record.query)
      }
    });
    await options.onStep?.('uploadStarted', {});

    let saved = await db.queryExport.updateMany({
      where: guarded(record.id, owner),
      data: { uploadId }
    });
    if (!saved.count) {
      await store.abort(record.objectKey, uploadId).catch(() => {});
      return 'lost';
    }
  }

  let parts = [...record.parts];
  let cursor: RowsCursor | undefined = record.cursor
    ? parseRowsCursor(record.cursor)
    : undefined;
  let rows = Number(record.rows);
  let bytes = Number(record.bytes);

  for (;;) {
    let members: Buffer[] = [];
    let size = 0;
    let partRows = 0;
    let after = cursor;
    let exhausted = false;

    while (size < partBytes) {
      let page = await queryService.readRows({
        organization: record.organization,
        bound,
        scope: prepared.scope,
        catalog: prepared.catalog,
        now: record.asOf,
        sort,
        limit: pageSize,
        ...(after ? { after } : {})
      });

      let header = format == 'csv' && !parts.length && !members.length;
      if (page.rows.length || header) {
        let member = gzipMember(
          serializeRows({ format, columns, rows: page.rows, labels: page.labels, header })
        );
        members.push(member);
        size += member.length;
        partRows += page.rows.length;
      }

      after = page.last ?? after;
      if (!page.hasMore) {
        exhausted = true;
        break;
      }
    }

    if (rows + partRows > maxRows || bytes + size > exportMaxBytes) {
      await fail(
        record,
        owner,
        `The export exceeds the limit of ${maxRows.toLocaleString('en-US')} rows or ${exportMaxBytes / 1024 ** 3} GB.`,
        store
      );
      return 'failed';
    }

    // An export with no rows still needs one part to complete the upload.
    if (!members.length && !parts.length) members.push(gzipMember(''));

    if (members.length) {
      let number = parts.length + 1;
      let uploaded = await store.uploadPart(
        record.objectKey,
        uploadId,
        number,
        Buffer.concat(members)
      );
      await options.onStep?.('partUploaded', { part: number });

      let receipt = { number, etag: uploaded.etag, size: uploaded.size, rows: partRows };
      let committed = await db.queryExport.updateMany({
        where: guarded(record.id, owner),
        data: {
          parts: [...parts, receipt],
          ...(after ? { cursor: serializeRowsCursor(after) } : {}),
          rows: { increment: partRows },
          bytes: { increment: uploaded.size },
          attempts: 0,
          lastProgressAt: new Date(),
          leaseExpiresAt: new Date(Date.now() + exportLeaseMs)
        }
      });
      if (!committed.count) return 'lost';

      parts.push(receipt);
      rows += partRows;
      bytes += uploaded.size;
    }

    cursor = after;
    if (exhausted) break;

    if (Date.now() - started > (options.yieldMs ?? exportYieldMs)) {
      await release(record.id, owner);
      return 'yield';
    }
  }

  let expectedSize = parts.reduce((total, part) => total + part.size, 0);
  try {
    await store.complete(
      record.objectKey,
      uploadId,
      parts.map(part => ({ part: part.number, etag: part.etag }))
    );
  } catch (error) {
    if (!(error instanceof ExportUploadNotFoundError)) throw error;

    // An earlier attempt may have completed the upload before it could record that.
    let head = await store.head(record.objectKey);
    if (head?.size != expectedSize) {
      await fail(record, owner, 'The upload was lost before it could be completed.', store);
      return 'failed';
    }
  }

  let now = new Date();
  let completed = await db.queryExport.updateMany({
    where: guarded(record.id, owner),
    data: {
      status: 'completed',
      uploadId: null,
      completedAt: now,
      expiresAt: new Date(now.getTime() + exportRetentionMs),
      leaseOwner: null,
      leaseExpiresAt: null
    }
  });

  return completed.count ? 'completed' : 'lost';
};

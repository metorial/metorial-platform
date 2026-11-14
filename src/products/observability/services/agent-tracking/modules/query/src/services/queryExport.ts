import {
  badRequestError,
  notFoundError,
  ServiceError,
  tooManyRequestsError
} from '@lowerdeck/error';
import { Service } from '@lowerdeck/service';
import { db, getId, type Organization, type QueryExport } from '@mtsrc/agent-tracking-db';
import type { QueryScope } from '@mtsrc/agent-tracking-module-usage';
import { getExportStore } from '../lib/exportStore';
import { privacyOf } from '../lib/resolve';
import { exportExtensions, type ExportFormat } from '../lib/exportFormat';
import { exportChunkQueue } from '../queues/exportChunk';
import { queryService } from './query';

export let maxRunningExports = 3;

export let exportDownloadSeconds = 15 * 60;

export let maxListedExports = 100;

let unavailable = () =>
  new ServiceError(
    badRequestError({
      code: 'exports_unavailable',
      message: 'Query exports need object storage, which is not configured.'
    } as any)
  );

let invalid = (message: string, pointer: string) =>
  new ServiceError(
    badRequestError({
      code: 'invalid_query',
      message: `${pointer}: ${message}`,
      errors: [{ code: 'not_exportable', message, pointer }]
    } as any)
  );

export let presentQueryExport = (
  record: QueryExport,
  download: { url: string; expiresAt: Date } | null = null
) => ({
  object: 'agent_tracking#query_export' as const,
  id: record.id,
  status: record.status,
  format: record.format,
  query: record.query,
  scope: record.scope,
  asOf: record.asOf,
  rows: Number(record.rows),
  bytes: Number(record.bytes),
  parts: record.parts.length,
  error: record.error,
  createdBy: record.createdBy,
  createdAt: record.createdAt,
  completedAt: record.completedAt,
  expiresAt: record.expiresAt,
  download
});

class QueryExportServiceImpl {
  async createQueryExport(d: {
    organization: Organization;
    scope?: QueryScope;
    query: unknown;
    format: ExportFormat;
    createdBy?: string;
  }) {
    let asOf = new Date();
    let { bound, scope } = await queryService.prepare({
      organization: d.organization,
      scope: d.scope,
      query: d.query,
      now: asOf
    });

    if (bound.mode != 'rows')
      throw invalid('Only rows-mode queries can be exported.', '/mode');
    if (privacyOf(d.organization).hideIndividuals) {
      throw invalid('This organization hides individual data, so exports are off.', '/mode');
    }
    if (bound.orderBy.length) {
      throw invalid(
        'Exports are sorted by time so they can resume; sort the file afterwards.',
        '/orderBy'
      );
    }
    if (bound.cursor)
      throw invalid('Exports read every row, so they take no cursor.', '/cursor');

    let store = getExportStore();
    if (!store) throw unavailable();

    let running = await db.queryExport.count({
      where: { organizationOid: d.organization.oid, status: { in: ['queued', 'running'] } }
    });
    if (running >= maxRunningExports) {
      throw new ServiceError(
        tooManyRequestsError({
          message: `At most ${maxRunningExports} exports can run at once.`
        })
      );
    }

    let ids = getId('queryExport');
    let { cursor: _, limit: __, ...query } = bound.canonical as Record<string, unknown>;

    let record = await db.queryExport.create({
      data: {
        ...ids,
        format: d.format,
        query,
        scope,
        asOf,
        objectKey: `exports/${d.organization.id}/${ids.id}.${exportExtensions[d.format]}`,
        selectsPersonal: bound.select.some(field => field.sensitivity == 'personal'),
        createdBy: d.createdBy ?? null,
        organizationOid: d.organization.oid
      }
    });

    await exportChunkQueue.add({ exportId: record.id });

    return presentQueryExport(record);
  }

  private async find(d: { organization: Organization; exportId: string }) {
    let record = await db.queryExport.findFirst({
      where: { id: d.exportId, organizationOid: d.organization.oid }
    });
    if (!record) throw new ServiceError(notFoundError('query_export', d.exportId));

    return record;
  }

  async getQueryExport(d: { organization: Organization; exportId: string }) {
    let record = await this.find(d);
    if (record.status != 'completed') return presentQueryExport(record);

    let store = getExportStore();
    if (!store) throw unavailable();

    let url = await store.downloadUrl(record.objectKey, exportDownloadSeconds);
    return presentQueryExport(record, {
      url,
      expiresAt: new Date(Date.now() + exportDownloadSeconds * 1000)
    });
  }

  async listQueryExports(d: { organization: Organization; limit?: number }) {
    let records = await db.queryExport.findMany({
      where: { organizationOid: d.organization.oid },
      orderBy: [{ createdAt: 'desc' }, { oid: 'desc' }],
      take: Math.min(d.limit ?? 50, maxListedExports)
    });

    return {
      object: 'agent_tracking#query_export_list' as const,
      items: records.map(record => presentQueryExport(record))
    };
  }

  async cancelQueryExport(d: { organization: Organization; exportId: string }) {
    let record = await this.find(d);

    await db.queryExport.updateMany({
      where: { id: record.id, status: { in: ['queued', 'running'] } },
      data: { status: 'cancelled', leaseOwner: null, leaseExpiresAt: null }
    });

    return presentQueryExport(await this.find(d));
  }

  // Finding one user's rows inside a 7-day file isn't worth it, so user erasure drops every export
  // of the organization that selected personal fields. The reconciler deletes the objects.
  async expirePersonalExports(d: { organizationId: string }) {
    let organization = { id: d.organizationId };

    await db.queryExport.updateMany({
      where: { organization, selectsPersonal: true, status: { in: ['queued', 'running'] } },
      data: { status: 'cancelled', leaseOwner: null, leaseExpiresAt: null }
    });
    await db.queryExport.updateMany({
      where: { organization, selectsPersonal: true, status: 'completed' },
      data: { expiresAt: new Date() }
    });
  }
}

export let queryExportService = Service.create(
  'queryExportService',
  () => new QueryExportServiceImpl()
).build();

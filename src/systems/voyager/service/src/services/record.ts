import { canonicalize } from '@lowerdeck/canonicalize';
import { notFoundError, ServiceError } from '@lowerdeck/error';
import { Hash } from '@lowerdeck/hash';
import { Paginator } from '@lowerdeck/pagination';
import { Service } from '@lowerdeck/service';
import type { Index, Tenant } from '../../prisma/generated/client';
import { defaultBackend } from '../backends';
import { db } from '../db';
import { getId } from '../id';
import { deleteRecordQueue, indexRecordQueue } from '../queues/record';

let include = {};

class recordServiceImpl {
  async indexRecord(d: {
    index: Index;
    input: {
      documentId: string;
      tenantIds?: string[];
      body: string | { [key: string]: any };
      fields: { [key: string]: any };
      metadata?: { [key: string]: any };
    };
  }) {
    let uniqueTenants = [...new Set(d.input.tenantIds || [])];

    let tenantFilter = uniqueTenants.length
      ? {
          where: {
            OR: [{ id: { in: d.input.tenantIds } }, { identifier: { in: d.input.tenantIds } }]
          },
          select: { oid: true }
        }
      : undefined;

    let tenantOids = tenantFilter
      ? (await db.tenant.findMany(tenantFilter)).map(t => t.oid)
      : [];

    if (tenantOids.length !== uniqueTenants.length) {
      await db.tenant.createMany({
        skipDuplicates: true,
        data: uniqueTenants.map(t => ({
          ...getId('tenant'),
          identifier: t
        }))
      });

      tenantOids = tenantFilter
        ? (await db.tenant.findMany(tenantFilter)).map(t => t.oid)
        : [];
    }

    let hash = await Hash.sha256(canonicalize([d.input.body, d.input.fields]));

    let data = {
      hash,
      body: d.input.body,
      fields: d.input.fields,
      tenantOids: tenantOids,
      metadata: d.input.metadata || {},
      isTenantSpecific: !!d.input.tenantIds?.length
    };

    let record = await db.record.upsert({
      where: {
        indexOid_documentId: {
          indexOid: d.index.oid,
          documentId: d.input.documentId
        }
      },
      update: data,
      create: {
        ...getId('record'),
        indexOid: d.index.oid,
        documentId: d.input.documentId,
        ...data
      },
      include
    });

    await indexRecordQueue.add({ recordId: record.id });

    return record;
  }

  async searchRecords(d: {
    index: Index;
    tenant?: Tenant;
    query: string;
    filters?: { [key: string]: any };
  }) {
    let res = await defaultBackend.searchRecords(d.index, {
      query: d.query,
      filters: d.filters,
      tenantOids: d.tenant ? [d.tenant.oid] : undefined
    });

    let records = await db.record.findMany({
      where: {
        indexOid: d.index.oid,
        documentId: { in: res.records.map(r => r.documentId) }
      },
      include
    });

    let recordsByDocumentId = new Map(records.map(record => [record.documentId, record]));

    let orderedRecords = res.records
      .map(record => recordsByDocumentId.get(record.documentId))
      .filter(record => record !== undefined);

    return orderedRecords;
  }

  async getRecordById(d: { id: string; tenant: Tenant }) {
    let func = await db.record.findFirst({
      where: {
        id: d.id,
        tenantOids: { has: d.tenant.oid }
      },
      include
    });
    if (!func) throw new ServiceError(notFoundError('event_destination'));
    return func;
  }

  async listRecords(d: { tenant: Tenant }) {
    return Paginator.create(({ prisma }) =>
      prisma(
        async opts =>
          await db.record.findMany({
            ...opts,
            where: {
              OR: [
                { tenantOids: { has: d.tenant.oid }, isTenantSpecific: true },
                { isTenantSpecific: false }
              ]
            },
            include
          })
      )
    );
  }

  async deleteRecords(d: { index: Index; documentIds: string[] }) {
    let recordsToDelete = await db.record.findMany({
      where: {
        indexOid: d.index.oid,
        documentId: { in: d.documentIds }
      }
    });

    await deleteRecordQueue.addMany(recordsToDelete.map(r => ({ recordId: r.id })));
  }
}

export let recordService = Service.create(
  'recordService',
  () => new recordServiceImpl()
).build();

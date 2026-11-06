import { uniqueId } from '@lowerdeck/testing-tools';
import { describe, expect, it } from 'vitest';
import { db } from '../src/db';
import { voyager } from './client';
import { createSourceWithIndex, indexRecord } from './fixtures';

describe('voyager record', () => {
  it('indexes a global record and persists it', async () => {
    let { source, index } = await createSourceWithIndex();
    let target = { sourceId: source.id, indexId: index.id };
    let documentId = uniqueId('doc');

    let record = await indexRecord(target, {
      documentId,
      body: 'Hello world',
      fields: { kind: 'greeting' },
      metadata: { origin: 'e2e' }
    });

    expect(record).toMatchObject({
      object: 'voyager#record',
      documentId,
      body: 'Hello world',
      fields: { kind: 'greeting' },
      metadata: { origin: 'e2e' },
      isTenantSpecific: false
    });
    expect(record.id).toMatch(/^vrc_/);
    expect(record.hash).toEqual(expect.any(String));

    let row = await db.record.findUniqueOrThrow({
      where: { id: record.id },
      include: { index: true }
    });
    expect(row).toMatchObject({
      documentId,
      isTenantSpecific: false,
      tenantOids: [],
      body: 'Hello world',
      fields: { kind: 'greeting' }
    });
    expect(row.index.id).toBe(index.id);
  });

  it('defaults metadata to an empty object and stores object bodies', async () => {
    let { source, index } = await createSourceWithIndex();

    let record = await indexRecord(
      { sourceId: source.id, indexId: index.id },
      { body: { title: 'Title', summary: 'Summary' } }
    );

    expect(record.metadata).toEqual({});
    expect(record.body).toEqual({ title: 'Title', summary: 'Summary' });
  });

  it('updates a record in place when the document is indexed again', async () => {
    let { source, index } = await createSourceWithIndex();
    let target = { sourceId: source.id, indexId: index.id };
    let documentId = uniqueId('doc');

    let first = await indexRecord(target, { documentId, body: 'first', fields: { v: 1 } });
    let second = await indexRecord(target, { documentId, body: 'second', fields: { v: 2 } });

    expect(second.id).toBe(first.id);
    expect(second.hash).not.toBe(first.hash);
    expect(second).toMatchObject({ body: 'second', fields: { v: 2 } });

    let rows = await db.record.findMany({ where: { index: { id: index.id }, documentId } });
    expect(rows).toHaveLength(1);
  });

  it('derives the hash from body and fields only', async () => {
    let { source, index } = await createSourceWithIndex();
    let target = { sourceId: source.id, indexId: index.id };

    let a = await indexRecord(target, {
      body: 'same',
      fields: { x: 1, y: 2 },
      metadata: { n: 1 }
    });
    let b = await indexRecord(target, {
      body: 'same',
      fields: { y: 2, x: 1 },
      metadata: { n: 2 }
    });
    let c = await indexRecord(target, { body: 'different', fields: { x: 1, y: 2 } });

    expect(b.hash).toBe(a.hash);
    expect(c.hash).not.toBe(a.hash);
  });

  it('keeps the same document id separate per index', async () => {
    let { source: sourceA, index: indexA } = await createSourceWithIndex();
    let { source: sourceB, index: indexB } = await createSourceWithIndex();
    let documentId = uniqueId('doc');

    let a = await indexRecord({ sourceId: sourceA.id, indexId: indexA.id }, { documentId });
    let b = await indexRecord({ sourceId: sourceB.id, indexId: indexB.id }, { documentId });

    expect(a.id).not.toBe(b.id);
    expect(await db.record.count({ where: { documentId } })).toBe(2);
  });

  it('creates tenants from tenant identifiers and marks the record tenant specific', async () => {
    let { source, index } = await createSourceWithIndex();
    let target = { sourceId: source.id, indexId: index.id };
    let tenantA = uniqueId('tenant');
    let tenantB = uniqueId('tenant');

    let record = await indexRecord(target, { tenantIds: [tenantA, tenantB, tenantA] });
    expect(record.isTenantSpecific).toBe(true);

    let tenants = await db.tenant.findMany({
      where: { identifier: { in: [tenantA, tenantB] } }
    });
    expect(tenants).toHaveLength(2);

    let row = await db.record.findUniqueOrThrow({ where: { id: record.id } });
    expect([...row.tenantOids].sort()).toEqual(tenants.map(t => t.oid).sort());
  });

  it('accepts existing tenants referenced by id or identifier', async () => {
    let { source, index } = await createSourceWithIndex();
    let target = { sourceId: source.id, indexId: index.id };
    let byId = await voyager.tenant.upsert({ identifier: uniqueId('tenant') });
    let byIdentifier = await voyager.tenant.upsert({ identifier: uniqueId('tenant') });

    let record = await indexRecord(target, {
      tenantIds: [byId.id, byIdentifier.identifier]
    });

    let row = await db.record.findUniqueOrThrow({ where: { id: record.id } });
    let tenants = await db.tenant.findMany({
      where: { id: { in: [byId.id, byIdentifier.id] } }
    });
    expect([...row.tenantOids].sort()).toEqual(tenants.map(t => t.oid).sort());
  });

  it('treats an empty tenant list as a global record', async () => {
    let { source, index } = await createSourceWithIndex();
    let record = await indexRecord(
      { sourceId: source.id, indexId: index.id },
      { tenantIds: [] }
    );

    expect(record.isTenantSpecific).toBe(false);
  });

  it('gets a record only for a tenant it belongs to', async () => {
    let { source, index } = await createSourceWithIndex();
    let target = { sourceId: source.id, indexId: index.id };
    let owner = await voyager.tenant.upsert({ identifier: uniqueId('tenant') });
    let other = await voyager.tenant.upsert({ identifier: uniqueId('tenant') });

    let record = await indexRecord(target, { tenantIds: [owner.id] });

    expect(
      await voyager.record.get({ tenantId: owner.id, recordId: record.id })
    ).toMatchObject({
      id: record.id,
      documentId: record.documentId
    });
    await expect(
      voyager.record.get({ tenantId: other.id, recordId: record.id })
    ).rejects.toThrow();
  });

  it('rejects unknown tenants and records on get', async () => {
    let { source, index } = await createSourceWithIndex();
    let tenant = await voyager.tenant.upsert({ identifier: uniqueId('tenant') });
    let record = await indexRecord(
      { sourceId: source.id, indexId: index.id },
      { tenantIds: [tenant.id] }
    );

    await expect(
      voyager.record.get({ tenantId: uniqueId('missing'), recordId: record.id })
    ).rejects.toThrow();
    await expect(
      voyager.record.get({ tenantId: tenant.id, recordId: uniqueId('missing') })
    ).rejects.toThrow();
  });

  it('does not return global records through get', async () => {
    let { source, index } = await createSourceWithIndex();
    let tenant = await voyager.tenant.upsert({ identifier: uniqueId('tenant') });
    let record = await indexRecord({ sourceId: source.id, indexId: index.id });

    await expect(
      voyager.record.get({ tenantId: tenant.id, recordId: record.id })
    ).rejects.toThrow();
  });

  it('rejects indexing into an unknown source or index', async () => {
    let { source, index } = await createSourceWithIndex();

    await expect(
      indexRecord({ sourceId: uniqueId('missing'), indexId: index.id })
    ).rejects.toThrow();
    await expect(
      indexRecord({ sourceId: source.id, indexId: uniqueId('missing') })
    ).rejects.toThrow();
  });

  it('does not index into an index of another source', async () => {
    let { index } = await createSourceWithIndex();
    let { source: otherSource } = await createSourceWithIndex();

    await expect(
      indexRecord({ sourceId: otherSource.id, indexId: index.id })
    ).rejects.toThrow();
  });

  it('rejects invalid input', async () => {
    let { source, index } = await createSourceWithIndex();
    let target = { sourceId: source.id, indexId: index.id };

    await expect(
      voyager.record.index({ ...target, documentId: uniqueId('doc'), body: 'x' } as any)
    ).rejects.toThrow();
    await expect(
      voyager.record.index({ ...target, documentId: uniqueId('doc'), fields: {} } as any)
    ).rejects.toThrow();
    await expect(
      voyager.record.index({
        ...target,
        documentId: uniqueId('doc'),
        fields: {},
        body: 42
      } as any)
    ).rejects.toThrow();
    await expect(
      voyager.record.index({ ...target, fields: {}, body: 'x' } as any)
    ).rejects.toThrow();
  });
});
